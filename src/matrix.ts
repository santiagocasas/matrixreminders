import { MatrixClient } from 'matrix-bot-sdk'
import logger from './logger'
import { IConfig, ReminderMatrixConfig } from './types'
import { PendingReminder } from './pending-store'

export class MatrixClientWrapper {
  private client!: MatrixClient
  private config: ReminderMatrixConfig

  constructor(config: IConfig) {
    this.config = config.reminder.matrix
  }

  get rawClient(): MatrixClient {
    return this.client
  }

  async connect(): Promise<void> {
    try {
      this.client = new MatrixClient(
        this.config.homeserver,
        this.config.access_token
      )

      await this.client.start()
      logger.info(`Connected to Matrix at ${this.config.homeserver}`)
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Matrix')
      throw error
    }
  }

  async sendMessage(message: string): Promise<void> {
    try {
      const content = {
        msgtype: 'm.text',
        body: message
      }
      await this.client.sendMessage(this.config.room_id, content)
      logger.info(`Message sent to room ${this.config.room_id}`)
    } catch (error) {
      logger.error({ error }, 'Failed to send Matrix message')
      throw error
    }
  }

  async sendFormattedSummary(events: any[]): Promise<void> {
    const message = this.formatCalendarAgenda('📅 Daily Summary', events)
    await this.sendMessage(message)
  }

  async sendMorningBriefing(dateLabel: string, events: any[], reminders: PendingReminder[]): Promise<void> {
    const lines = [`Good morning! Here's your deterministic briefing for ${dateLabel}:`, '']

    lines.push('Work Hours')
    lines.push('Handled separately in the work-hours bot.')
    lines.push('')

    lines.push('Reminders')
    if (reminders.length === 0) {
      lines.push('No reminders due today.')
    } else {
      reminders.forEach((reminder) => {
        lines.push(`- ${reminder.title} (reply DONE: ${reminder.title} when complete)`)
      })
    }
    lines.push('')

    lines.push('Schedule')
    if (events.length === 0) {
      lines.push('No calendar events today.')
    } else {
      events.forEach((event) => {
        const time = this.formatEventStart(event.start || {})
        lines.push(`- ${time}: ${event.summary || '(no title)'}`)
        if (event.location) lines.push(`  Location: ${event.location}`)
      })
    }

    await this.sendMessage(lines.join('\n'))
  }

  async sendTodayAgenda(events: any[]): Promise<void> {
    const message = this.formatCalendarAgenda('📅 Today', events)
    await this.sendMessage(message)
  }

  async sendWeekAgenda(events: any[]): Promise<void> {
    const message = this.formatCalendarAgenda('📅 This Week', events)
    await this.sendMessage(message)
  }

  async sendHelp(): Promise<void> {
    await this.sendMessage(
      [
        'Reminders + calendar help',
        '',
        'Reminder syntax:',
        '- Remind me to send the invoice tomorrow at 14:00',
        '- Remind me on 11.05 to make an HNO appointment',
        '- REMINDER: 11.05 09:00 make an HNO appointment',
        '- DONE: make an HNO appointment',
        '',
        'Calendar syntax:',
        '- EVENT: dentist 11.05 14:30',
        '- EVENT: trip to Berlin 09.05 to 11.05',
        '- What\'s on today?',
        '- What\'s on this week?',
        '',
        'Deterministic commands:',
        '- today',
        '- week',
        '- help',
        '- EVENT: <text>',
        '- REMINDER: <text>',
        '- DELETE: <title fragment>',
        '- #save <text>',
        '- DONE: <title>',
        '',
        'Dates: use natural dates like tomorrow/next Monday, or European dates like DD.MM / DD.MM.YYYY. If no time is given, reminders default to 09:00.'
      ].join('\n')
    )
  }

  private formatCalendarAgenda(title: string, events: any[]): string {
    let message = `${title}\n\n`

    if (events.length === 0) {
      return message + 'No events scheduled.'
    }

    events.forEach((event, index) => {
      const start = event.start || {}
      const time = this.formatEventStart(start)
      message += `${index + 1}. [${time}] ${event.summary || '(no title)'}\n`
      if (event.location) {
        message += `   Location: ${event.location}\n`
      }
      if (event.description) {
        message += `   ${String(event.description).slice(0, 180)}\n`
      }
      message += '\n'
    })

    return message.trimEnd()
  }

  private formatEventStart(start: { dateTime?: string; date?: string }): string {
    if (start.dateTime) {
      const dt = new Date(start.dateTime)
      return dt.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Berlin'
      })
    }
    if (start.date) {
      return `${start.date} all-day`
    }
    return '?'
  }
}
