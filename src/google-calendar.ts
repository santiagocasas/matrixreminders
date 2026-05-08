// @ts-nocheck
import fs from 'fs'
import { google } from 'googleapis'
import logger from './logger'
import { IConfig, ReminderGoogleConfig } from './types'

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: { date?: string; dateTime: string; timeZone: string }
  end: { date?: string; dateTime: string; timeZone: string }
  htmlLink: string
  hangoutLink?: string
}

export interface CreateEventOptions {
  attendees?: string[]
  createMeet?: boolean
}

export class GoogleCalendarWrapper {
  private auth: any
  private calendar: any
  private config: ReminderGoogleConfig

  constructor(config: IConfig) {
    this.config = config.reminder.google
  }

  async authorize(): Promise<void> {
    try {
      const { credentials_path, token_path } = this.config
      const credentials = JSON.parse(fs.readFileSync(credentials_path, 'utf-8'))
      const { client_secret, client_id, redirect_uris } = credentials.installed
      const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris?.[0]
      )

      if (fs.existsSync(token_path)) {
        const token = JSON.parse(fs.readFileSync(token_path, 'utf-8'))
        oAuth2Client.setCredentials(token)
      } else {
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['https://www.googleapis.com/auth/calendar.events']
        })
        logger.info({ authUrl }, 'First run: open this URL and generate token.json')
        throw new Error('Missing token.json - complete Google OAuth first')
      }

      this.auth = oAuth2Client
      this.calendar = google.calendar({ version: 'v3', auth: oAuth2Client })
      logger.info('Google Calendar authorized successfully')
    } catch (error) {
      logger.error({ error }, 'Google Calendar authorization failed')
      throw error
    }
  }

  async createEvent(
    summary: string,
    description: string,
    startTime: Date,
    endTime: Date,
    options: CreateEventOptions = {}
  ): Promise<CalendarEvent | null> {
    try {
      const event = {
        summary,
        description,
        start: {
          dateTime: this.formatCalendarDateTime(startTime),
          timeZone: this.config.timezone || 'UTC'
        },
        end: {
          dateTime: this.formatCalendarDateTime(endTime),
          timeZone: this.config.timezone || 'UTC'
        },
        ...(options.attendees?.length ? { attendees: options.attendees.map((email) => ({ email })) } : {}),
        ...(options.createMeet ? {
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            }
          }
        } : {})
      }

      const res = await this.calendar.events.insert({
        calendarId: this.config.calendar_id,
        resource: event,
        sendUpdates: options.attendees?.length ? 'all' : 'none',
        conferenceDataVersion: options.createMeet ? 1 : 0
      })

      logger.info(`Event created: ${res.data.htmlLink}`)
      return res.data as CalendarEvent
    } catch (error) {
      logger.error({ error }, 'Failed to create calendar event')
      return null
    }
  }

  async getEvents(startTime: Date, endTime: Date): Promise<CalendarEvent[]> {
    try {
      const res = await this.calendar.events.list({
        calendarId: this.config.calendar_id,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      })

      return (res.data.items || []) as CalendarEvent[]
    } catch (error) {
      logger.error({ error }, 'Failed to get calendar events')
      return []
    }
  }

  private formatCalendarDateTime(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    const second = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`
  }

  async findEventsByTitleFragment(fragment: string, startTime: Date, endTime: Date): Promise<CalendarEvent[]> {
    try {
      const events = await this.getEvents(startTime, endTime)
      const normalized = fragment.trim().toLowerCase()
      return events.filter((event) => String(event.summary || '').toLowerCase().includes(normalized))
    } catch (error) {
      logger.error({ error, fragment }, 'Failed to find calendar events by title fragment')
      return []
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      await this.calendar.events.delete({
        calendarId: this.config.calendar_id,
        eventId
      })
      logger.info({ eventId }, 'Event deleted')
      return true
    } catch (error) {
      logger.error({ error, eventId }, 'Failed to delete calendar event')
      return false
    }
  }
}
