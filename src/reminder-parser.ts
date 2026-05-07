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
    return m.trim()
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
