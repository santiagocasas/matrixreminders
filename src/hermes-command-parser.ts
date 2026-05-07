import { HermesCalendarCommand } from './types'

type LegacyHermesReminderCommand = {
  type?: string
  title?: string
  datetime?: string
  timezone?: string
  source_text?: string
}

export type HermesCommandParseResult =
  | { ok: true; command: HermesCalendarCommand }
  | { ok: false; error: string }

const START_MARKER = 'HERMES_CALENDAR_JSON_BEGIN'
const END_MARKER = 'HERMES_CALENDAR_JSON_END'

export function parseHermesCommandBlock(message: string): HermesCommandParseResult | null {
  const start = message.indexOf(START_MARKER)
  const end = message.indexOf(END_MARKER)

  if (start === -1 || end === -1 || end <= start) return null

  const raw = message.slice(start + START_MARKER.length, end).trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Invalid JSON in Hermes command block.' }
  }

  return validateHermesCommand(parsed)
}

function normalizeHermesCommand(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input

  const legacy = input as LegacyHermesReminderCommand
  if (legacy.type === 'reminder_create' && typeof legacy.title === 'string' && typeof legacy.datetime === 'string') {
    return {
      type: 'calendar_command',
      version: 1,
      action: 'create_reminder',
      title: legacy.title,
      description: legacy.source_text || 'Created from Hermes structured reminder command',
      reminders: [
        {
          title: legacy.title,
          at: legacy.datetime
        }
      ]
    } satisfies HermesCalendarCommand
  }

  return input
}

function validateHermesCommand(input: unknown): HermesCommandParseResult {
  input = normalizeHermesCommand(input)
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Hermes command must be a JSON object.' }
  }

  const command = input as Partial<HermesCalendarCommand>
  const validActions = new Set(['create_event', 'create_reminder', 'create_event_with_reminder'])

  if (command.type !== 'calendar_command') {
    return { ok: false, error: 'Hermes command type must be calendar_command.' }
  }
  if (command.version !== 1) {
    return { ok: false, error: 'Hermes command version must be 1.' }
  }
  if (!command.action || !validActions.has(command.action)) {
    return { ok: false, error: 'Unsupported Hermes command action.' }
  }
  if (!command.title || typeof command.title !== 'string') {
    return { ok: false, error: 'Hermes command title is required.' }
  }

  if (command.action === 'create_event' || command.action === 'create_event_with_reminder') {
    if (!isIsoString(command.start) || !isIsoString(command.end)) {
      return { ok: false, error: 'Event commands require ISO start and end timestamps.' }
    }
  }

  if (command.action === 'create_reminder') {
    if (!command.reminders || !Array.isArray(command.reminders) || command.reminders.length === 0) {
      return { ok: false, error: 'Reminder commands require at least one reminder entry.' }
    }
  }

  if (command.reminders) {
    if (!Array.isArray(command.reminders)) {
      return { ok: false, error: 'reminders must be an array.' }
    }
    for (const reminder of command.reminders) {
      if (!reminder || typeof reminder !== 'object') {
        return { ok: false, error: 'Each reminder must be an object.' }
      }
      if (typeof reminder.title !== 'string' || !reminder.title.trim()) {
        return { ok: false, error: 'Each reminder needs a title.' }
      }
      if (!isIsoString(reminder.at)) {
        return { ok: false, error: 'Each reminder needs an ISO timestamp in at.' }
      }
    }
  }

  return { ok: true, command: command as HermesCalendarCommand }
}

function isIsoString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}
