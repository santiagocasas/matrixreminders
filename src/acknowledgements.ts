export function isAcknowledgementLike(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return [
    'done',
    'done.',
    'ok',
    'okay',
    'yes',
    'y',
    'completed',
    'finished',
    'sent',
    'resolved'
  ].includes(normalized)
}
