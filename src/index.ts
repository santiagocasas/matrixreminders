// @ts-nocheck
import logger from './logger'
import { loadConfig } from './config'
import { MatrixClientWrapper } from './matrix'
import { GoogleCalendarWrapper } from './google-calendar'
import { ReminderParser } from './reminder-parser'
import { PendingReminderStore } from './pending-store'
import { detectIntent, Intent } from './command-intents'
import { parseHermesCommandBlock } from './hermes-command-parser'
import { HermesCalendarCommand, HermesReminderSpec } from './types'
import { isAcknowledgementLike } from './acknowledgements'

async function main() {
  try {
    logger.info('=== Matrix Reminder Bot Starting ===')

    const config = loadConfig()

    const matrixClient = new MatrixClientWrapper(config)
    await matrixClient.connect()

    const calendarClient = new GoogleCalendarWrapper(config)
    await calendarClient.authorize()

    const parser = new ReminderParser()
    const pendingStore = new PendingReminderStore()
    const botUserId = await matrixClient.rawClient.getUserId()

    logger.info({ botUserId }, 'Reminder Bot is ready')

    matrixClient.rawClient.on('room.message', async (roomId: string, event: any) => {
      try {
        if (roomId !== config.reminder.matrix.room_id) return
        if (event?.type !== 'm.room.message') return

        const msgType = event?.content?.msgtype
        if (msgType !== 'm.text') return

        const sender = event?.sender
        if (!sender || sender === botUserId) return

        const message = String(event?.content?.body || '').trim()
        if (!message) return

        const hermesCommand = parseHermesCommandBlock(message)
        if (hermesCommand) {
          if (!hermesCommand.ok) {
            await matrixClient.sendMessage(`⚠️ ${hermesCommand.error}`)
            return
          }
          await handleHermesCommand(hermesCommand.command, roomId, sender, calendarClient, pendingStore, matrixClient)
          return
        }

        const intent = detectIntent(message)

        if (intent === 'help') {
          await matrixClient.sendHelp()
          return
        }

        if (intent === 'today') {
          const { start, end } = getTodayRange()
          const events = await calendarClient.getEvents(start, end)
          await matrixClient.sendTodayAgenda(events)
          return
        }

        if (intent === 'week') {
          const { start, end } = getWeekRange()
          const events = await calendarClient.getEvents(start, end)
          await matrixClient.sendWeekAgenda(events)
          return
        }

        if (intent === 'delete') {
          const fragment = message.replace(/^delete\s*:\s*/i, '').replace(/^delete\s+/i, '').trim()
          if (!fragment) {
            await matrixClient.sendMessage('⚠️ Use DELETE: <title fragment>')
            return
          }
          const { start, end } = getDeleteSearchRange()
          const matches = await calendarClient.findEventsByTitleFragment(fragment, start, end)
          if (matches.length === 0) {
            await matrixClient.sendMessage(`⚠️ No calendar event found matching: ${fragment}`)
            return
          }
          if (matches.length > 1) {
            const lines = matches.slice(0, 5).map((ev, idx) => `${idx + 1}. ${ev.summary}`)
            await matrixClient.sendMessage(`⚠️ Multiple calendar events match '${fragment}'. Please be more specific:\n${lines.join('\n')}`)
            return
          }
          const match = matches[0]
          const deleted = await calendarClient.deleteEvent(match.id)
          if (!deleted) {
            await matrixClient.sendMessage(`❌ Failed to delete calendar event: ${match.summary}`)
            return
          }
          await matrixClient.sendMessage(`🗑️ Deleted calendar event: ${match.summary}`)
          return
        }

        // DONE: <fragment> - acknowledge a specific pending reminder
        if (intent === 'done') {
          const fragment = message.replace(/^done:\s*/i, '').trim()
          const match = pendingStore.findByTitleFragment(fragment)
          if (match) {
            pendingStore.markAcknowledgedById(match.id)
            await matrixClient.sendMessage(`✅ Cleared: ${match.title}`)
          } else {
            await matrixClient.sendMessage(`⚠️ No matching reminder found for: ${fragment}`)
          }
          return
        }

        // Only explicit acknowledgement-like replies should clear active nudges.
        if (intent === 'none') {
          if (isAcknowledgementLike(message)) {
            const cleared = pendingStore.markAcknowledged(roomId, sender)
            if (cleared > 0) {
              await matrixClient.sendMessage(`✅ Got your reply. Stopped ${cleared} nudge(s). Use DONE: <title> to clear specific reminders.`)
            }
          }
          return
        }

        const parsed = parser.parse(message, {
          defaultTomorrowIfMissing: intent === 'reminder'
        })

        if (!parsed) {
          await matrixClient.sendMessage(
            '⚠️ Could not parse date. Use: "EVENT: Team sync tomorrow 10am", "REMINDER: call mom", or ask "what\'s on today?".'
          )
          return
        }

        // Idempotency check for reminders
        if (intent === 'reminder' && pendingStore.hasPending(parsed.title)) {
          await matrixClient.sendMessage(
            `⚠️ Reminder already exists: ${parsed.title}. Use DONE: ${parsed.title} to clear it first.`
          )
          return
        }

        const eventResult = await calendarClient.createEvent(
          parsed.title,
          `Type: ${intent}. From ${sender}. Original: ${message}`,
          parsed.startTime,
          parsed.endTime
        )

        if (!eventResult) {
          await matrixClient.sendMessage('❌ Failed to create calendar event. Check logs.')
          return
        }

        if (intent === 'event') {
          await matrixClient.sendMessage(
            `📅 Event created: ${parsed.title} on ${parsed.startTime.toLocaleDateString('de-DE')} at ${parsed.startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
          )
        } else {
          // reminder - add to pending store for nudging
          const dueDate = formatLocalDate(parsed.startTime)
          pendingStore.add({
            roomId,
            sender,
            title: parsed.title,
            dueDate,
            active: true
          })
          await matrixClient.sendMessage(
            `🔔 Reminder set: ${parsed.title} for ${parsed.startTime.toLocaleDateString('de-DE')} at ${parsed.startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} (I will nudge you until you confirm with DONE: ${parsed.title})`
          )
        }
      } catch (error) {
        logger.error({ error }, 'Error handling Matrix message')
      }
    })

    scheduleDailySummary(config, calendarClient, pendingStore, matrixClient)
    schedulePendingNudges(config, pendingStore, matrixClient)
  } catch (error) {
    logger.error({ error }, 'Failed to start reminder bot')
    process.exit(1)
  }
}

async function handleHermesCommand(
  command: HermesCalendarCommand,
  roomId: string,
  sender: string,
  calendarClient: GoogleCalendarWrapper,
  pendingStore: PendingReminderStore,
  matrixClient: MatrixClientWrapper
) {
  const created: string[] = []

  if (command.action === 'create_event' || command.action === 'create_event_with_reminder') {
    const startTime = new Date(command.start!)
    const endTime = new Date(command.end!)
    const eventResult = await calendarClient.createEvent(
      command.title,
      command.description || 'Created from Hermes structured command',
      startTime,
      endTime
    )

    if (!eventResult) {
      await matrixClient.sendMessage(`❌ Failed to create event: ${command.title}`)
      return
    }
    created.push(`📅 Event created: ${command.title}`)
  }

  if (command.action === 'create_reminder' || command.action === 'create_event_with_reminder') {
    const reminders = command.reminders || []
    if (reminders.length === 0) {
      await matrixClient.sendMessage('⚠️ No reminders found in Hermes command.')
      return
    }

    for (const reminder of reminders) {
      const duplicate = pendingStore.hasPending(reminder.title)
      if (duplicate) {
        created.push(`⚠️ Reminder already exists: ${reminder.title}`)
        continue
      }
      const reminderTime = new Date(reminder.at)
      const reminderEnd = new Date(reminderTime.getTime() + 60 * 60 * 1000)
      const reminderEvent = await calendarClient.createEvent(
        reminder.title,
        `Reminder created from Hermes structured command for ${command.title}`,
        reminderTime,
        reminderEnd
      )
      if (!reminderEvent) {
        created.push(`❌ Failed to create reminder event: ${reminder.title}`)
        continue
      }
      pendingStore.add({
        roomId,
        sender,
        title: reminder.title,
        dueDate: formatLocalDate(reminderTime),
        active: true
      })
      created.push(`🔔 Reminder set: ${reminder.title} for ${reminderTime.toLocaleDateString('de-DE')} at ${reminderTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`)
    }
  }

  await matrixClient.sendMessage(created.join('\n'))
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function getDayRangeInTimeZone(timezone: string) {
  const now = new Date()
  const parts = getDateParts(now, timezone)
  const start = zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, timezone)
  const end = zonedTimeToUtc(parts.year, parts.month, parts.day + 1, 0, 0, timezone)
  return { start, end }
}

function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const actual = getDateTimeParts(utcGuess, timezone)
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0)
  const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0)
  return new Date(utcGuess.getTime() - (actualAsUtc - wanted))
}

function getDateParts(date: Date, timezone: string) {
  const parts = getDateTimeParts(date, timezone)
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day
  }
}

function getDateTimeParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  })
  const values = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute)
  }
}

function getLocalDateString(date: Date, timezone: string): string {
  const parts = getDateParts(date, timezone)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function getLocalDateLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function getLocalClock(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  return formatter.format(date)
}

function getWeekRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

function getDeleteSearchRange() {
  const start = new Date()
  start.setFullYear(start.getFullYear() - 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setFullYear(end.getFullYear() + 2)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function schedulePendingNudges(config: any, store: PendingReminderStore, matrixClient: MatrixClientWrapper) {
  logger.info('Persistent nudge loop enabled (every 30 min)')

  setInterval(async () => {
    try {
      const hour = new Date().getHours()
      // Only nudge between 08:00 and 21:00
      if (hour < 8 || hour > 21) return

      const overdue = store.overdueAndNudgeable()
      for (const r of overdue) {
        const dueDate = new Date(r.dueDate + 'T09:00:00')
        const minsAgo = Math.round((Date.now() - dueDate.getTime()) / 60000)
        const humanAgo = minsAgo < 60
          ? `${minsAgo} min ago`
          : `${Math.round(minsAgo / 60)}h ago`

        await matrixClient.sendMessage(
          `🔔 Nudge: [${r.title}] was due ${humanAgo}. Reply DONE: ${r.title} when complete.`
        )
        store.touchNudge(r.id)
      }
    } catch (error) {
      logger.error({ error }, 'Pending nudge loop failed')
    }
  }, 30 * 60 * 1000)
}

function scheduleDailySummary(
  config: any,
  calendarClient: GoogleCalendarWrapper,
  pendingStore: PendingReminderStore,
  matrixClient: MatrixClientWrapper
) {
  const summaryTime = config.reminder.summary.time || '08:00'
  const timezone = config.reminder.summary.timezone || config.reminder.google.timezone || 'UTC'
  const enabled = config.reminder.summary.enabled !== false
  let lastSentDate: string | null = null

  logger.info(`Scheduled daily summary at ${summaryTime} (${timezone})`)

  if (!enabled) {
    logger.info('Daily summary disabled by config')
    return
  }

  setInterval(async () => {
    try {
      const now = new Date()
      const localClock = getLocalClock(now, timezone)
      const localDate = getLocalDateString(now, timezone)

      if (localClock === summaryTime && lastSentDate !== localDate) {
        const { start, end } = getDayRangeInTimeZone(timezone)
        const events = await calendarClient.getEvents(start, end)
        const reminders = pendingStore.dueToday(localDate)
        await matrixClient.sendMorningBriefing(getLocalDateLabel(now, timezone), events, reminders)
        lastSentDate = localDate
      }
    } catch (error) {
      logger.error({ error }, 'Daily summary failed')
    }
  }, 60000)
}

main()
