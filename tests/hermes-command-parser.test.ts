import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHermesCommandBlock } from '../src/hermes-command-parser'

test('parseHermesCommandBlock extracts valid structured command from marker block', () => {
  const message = `I parsed your request.\n\nHERMES_CALENDAR_JSON_BEGIN
{
  "type": "calendar_command",
  "version": 1,
  "action": "create_event_with_reminder",
  "title": "Workshop",
  "start": "2026-05-09T09:00:00+02:00",
  "end": "2026-05-11T18:00:00+02:00",
  "reminders": [
    {
      "title": "Workshop reminder",
      "at": "2026-05-06T14:00:00+02:00"
    }
  ]
}
HERMES_CALENDAR_JSON_END`

  const result = parseHermesCommandBlock(message)
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error('expected ok result')
  assert.equal(result.command.action, 'create_event_with_reminder')
  assert.equal(result.command.title, 'Workshop')
  assert.equal(result.command.reminders?.[0]?.title, 'Workshop reminder')
})

test('parseHermesCommandBlock accepts legacy Hermes reminder_create schema', () => {
  const message = `HERMES_CALENDAR_JSON_BEGIN
{
  "type": "reminder_create",
  "title": "Do UK Tax returns",
  "datetime": "2026-04-26T09:00:00+02:00",
  "timezone": "CEST",
  "default_applied": "date_without_time_defaults_to_09:00",
  "source_text": "can you remind me to do my UK Tax returns next Sunday?"
}
HERMES_CALENDAR_JSON_END`

  const result = parseHermesCommandBlock(message)
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error('expected ok result')
  assert.equal(result.command.action, 'create_reminder')
  assert.equal(result.command.title, 'Do UK Tax returns')
  assert.equal(result.command.reminders?.[0]?.at, '2026-04-26T09:00:00+02:00')
})

test('parseHermesCommandBlock rejects invalid JSON payloads cleanly', () => {
  const message = `HERMES_CALENDAR_JSON_BEGIN
  {not valid json}
  HERMES_CALENDAR_JSON_END`

  const result = parseHermesCommandBlock(message)
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('expected error result')
  assert.match(result.error, /invalid json/i)
})

test('parseHermesCommandBlock returns null when no markers are present', () => {
  const result = parseHermesCommandBlock('Remind me tomorrow at 9')
  assert.equal(result, null)
})
