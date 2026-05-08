export interface ReminderGoogleConfig {
  credentials_path: string
  token_path: string
  calendar_id: string
  timezone?: string
}

export interface ReminderMatrixConfig {
  homeserver: string
  access_token: string
  room_id: string
}

export interface HermesReminderSpec {
  title: string
  at: string
}

export interface HermesCalendarCommand {
  type: 'calendar_command'
  version: 1
  action: 'create_event' | 'create_reminder' | 'create_event_with_reminder'
  title: string
  start?: string
  end?: string
  description?: string
  reminders?: HermesReminderSpec[]
}

export interface IConfig {
  reminder: {
    google: ReminderGoogleConfig
    matrix: ReminderMatrixConfig
    summary: {
      time: string
      timezone: string
      enabled?: boolean
    }
  }
}
