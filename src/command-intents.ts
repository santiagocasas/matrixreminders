export type Intent =
  | 'event'
  | 'meet'
  | 'reminder'
  | 'delete'
  | 'done'
  | 'today'
  | 'week'
  | 'help'
  | 'none'

export function isReadOnlyCalendarQuery(message: string): boolean {
  const lower = message.trim().toLowerCase()
  return (
    /\bwhat('?s| is) on today\b/.test(lower) ||
    /\bwhat do i have today\b/.test(lower) ||
    /\btoday('?s)? schedule\b/.test(lower) ||
    /\bwhat('?s| is) on this week\b/.test(lower) ||
    /\bwhat do i have this week\b/.test(lower) ||
    /\bwhat('?s| is) on the week\b/.test(lower) ||
    /\bthis week('?s)? schedule\b/.test(lower)
  )
}

export function detectIntent(message: string): Intent {
  const m = message.trim()
  const lower = m.toLowerCase()

  if (lower === 'today' || lower === '!today') return 'today'
  if (lower === 'week' || lower === '!week' || lower === 'this week') return 'week'
  if (lower === 'help' || lower === '!help') return 'help'
  if (lower.startsWith('meet:') || lower.startsWith('meet ')) return 'meet'
  if (lower.startsWith('event:') || lower.startsWith('event ')) return 'event'
  if (lower.startsWith('reminder:') || lower.startsWith('reminder ')) return 'reminder'
  if (lower.startsWith('remind:') || lower.startsWith('remind ')) return 'reminder'
  if (lower.startsWith('remind me ')) return 'reminder'
  if (lower.startsWith('delete:') || lower.startsWith('delete ')) return 'delete'
  if (lower.startsWith('#save ')) return 'reminder'
  if (lower.startsWith('done:')) return 'done'
  if (/\bwhat('?s| is) on today\b/.test(lower) || /\bwhat do i have today\b/.test(lower) || /\btoday('?s)? schedule\b/.test(lower)) return 'today'
  if (/\bwhat('?s| is) on this week\b/.test(lower) || /\bwhat do i have this week\b/.test(lower) || /\bwhat('?s| is) on the week\b/.test(lower) || /\bthis week('?s)? schedule\b/.test(lower)) return 'week'

  return 'none'
}
