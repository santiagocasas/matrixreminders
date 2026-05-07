import test from 'node:test'
import assert from 'node:assert/strict'
import { detectIntent, isReadOnlyCalendarQuery } from '../src/command-intents'
import { isAcknowledgementLike } from '../src/acknowledgements'

test('detectIntent recognizes today, week, and help commands', () => {
  assert.equal(detectIntent('today'), 'today')
  assert.equal(detectIntent('  week  '), 'week')
  assert.equal(detectIntent('help'), 'help')
})

test('detectIntent still recognizes legacy reminder commands', () => {
  assert.equal(detectIntent('EVENT: Team sync tomorrow 10am'), 'event')
  assert.equal(detectIntent('REMINDER: call mom tomorrow'), 'reminder')
  assert.equal(detectIntent('DELETE: bad Luca event'), 'delete')
  assert.equal(detectIntent('#save buy milk'), 'reminder')
  assert.equal(detectIntent('DONE: buy milk'), 'done')
})

test('detectIntent treats natural-language calendar queries as read-only', () => {
  assert.equal(detectIntent("What's on today?"), 'today')
  assert.equal(detectIntent('what is on this week'), 'week')
  assert.equal(isReadOnlyCalendarQuery('what do I have today'), true)
  assert.equal(isReadOnlyCalendarQuery('what do I have this week'), true)
})

test('detectIntent does not treat plain natural-language reminders as direct bot commands', () => {
  assert.equal(detectIntent('remind me to send mail to Luca by tomorrow morning'), 'none')
  assert.equal(detectIntent('please remind me tomorrow morning to send mail'), 'none')
})

test('only explicit acknowledgement-like replies count as reminder acknowledgements', () => {
  assert.equal(isAcknowledgementLike('done'), true)
  assert.equal(isAcknowledgementLike('ok'), true)
  assert.equal(isAcknowledgementLike('sent'), true)
  assert.equal(isAcknowledgementLike('remind me to send email to Luca by tomorrow morning'), false)
  assert.equal(isAcknowledgementLike('what is on today'), false)
})
