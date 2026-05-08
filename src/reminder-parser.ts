import * as chrono from 'chrono-node'
import logger from './logger'

export interface ParsedReminder {
  text: string
  title: string
  parsedText: string
  startTime: Date
  endTime: Date
  rawDates: any[]
  hasExplicitDate: boolean
}

export interface ParseOptions {
  defaultTomorrowIfMissing?: boolean
}

export class ReminderParser {
  parse(message: string, options: ParseOptions = {}): ParsedReminder | null {
    try {
      const cleanMessage = this.normalizeCommandPrefix(message)
      const europeanDate = this.parseEuropeanDate(cleanMessage)
      if (europeanDate) return europeanDate

      const results = chrono.casual.parse(cleanMessage)

      let hasExplicitDate = results && results.length > 0
      let startTime: Date
      let parsedText = ''
      let title = cleanMessage

      if (hasExplicitDate) {
        const result = results[0]
        startTime = result.start.date()
        parsedText = result.text || ''

        if (parsedText) {
          const escaped = parsedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          title = cleanMessage.replace(new RegExp(escaped, 'i'), '').trim()
        }
      } else if (options.defaultTomorrowIfMissing) {
        startTime = this.tomorrowAtHour(9)
        parsedText = 'tomorrow (default)'
        hasExplicitDate = false
      } else {
        logger.warn({ message }, 'No dates found in message')
        return null
      }

      title = this.normalizeTitle(title)
      if (!title) title = cleanMessage || 'Reminder'

      const endTime = this.calculateEndTime(startTime)

      return {
        text: message,
        title,
        parsedText,
        startTime,
        endTime,
        rawDates: results || [],
        hasExplicitDate
      }
    } catch (error) {
      logger.error({ error, message }, 'Failed to parse reminder')
      return null
    }
  }

  private normalizeCommandPrefix(message: string): string {
    let m = message.trim()
    m = m.replace(/^#save\s+/i, '')
    m = m.replace(/^event\s*:?\s+/i, '')
    m = m.replace(/^reminder\s*:?\s+/i, '')
    m = m.replace(/^remind\s*:\s+/i, '')
    return m.trim()
  }

  private parseEuropeanDate(cleanMessage: string): ParsedReminder | null {
    const dateMatch = cleanMessage.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?\b/)
    if (!dateMatch) return null

    const day = Number(dateMatch[1])
    const month = Number(dateMatch[2])
    const yearText = dateMatch[3]
    const now = new Date()
    let year = yearText ? Number(yearText) : now.getFullYear()
    if (year < 100) year += 2000

    const timeMatch = cleanMessage.match(/\b(?:at\s*)?(\d{1,2})(?::|h)(\d{2})\b/i)
    const hour = timeMatch ? Number(timeMatch[1]) : 9
    const minute = timeMatch ? Number(timeMatch[2]) : 0

    let startTime = new Date(year, month - 1, day, hour, minute, 0, 0)
    if (!yearText && startTime < now) {
      startTime = new Date(year + 1, month - 1, day, hour, minute, 0, 0)
      year += 1
    }

    if (
      startTime.getFullYear() !== year ||
      startTime.getMonth() !== month - 1 ||
      startTime.getDate() !== day ||
      hour > 23 ||
      minute > 59
    ) {
      return null
    }

    let title = cleanMessage
      .replace(dateMatch[0], ' ')
      .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig, ' ')

    if (timeMatch) title = title.replace(timeMatch[0], ' ')

    title = this.normalizeTitle(title)
      .replace(/^on\s+/i, '')
      .replace(/^to\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!title) title = cleanMessage

    return {
      text: cleanMessage,
      title,
      parsedText: dateMatch[0],
      startTime,
      endTime: this.calculateEndTime(startTime),
      rawDates: [],
      hasExplicitDate: true
    }
  }

  private normalizeTitle(title: string): string {
    return title
      .replace(/^remind me to\s+/i, '')
      .replace(/^remind\s+me\s+/i, '')
      .replace(/^to\s+/i, '')
      .trim()
  }

  private tomorrowAtHour(hour: number): Date {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(hour, 0, 0, 0)
    return d
  }

  private calculateEndTime(startTime: Date): Date {
    const endTime = new Date(startTime)
    endTime.setHours(endTime.getHours() + 1)
    return endTime
  }
}
