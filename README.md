# Reminder Bot Setup Guide

## Overview

The reminder bot connects Matrix to Google Calendar. You can:
- Send reminders in natural language (e.g., "Remind me to call John tomorrow at 3pm")
- Use European dates like `11.05` or `11.05.2026`
- Get deterministic 8am briefings in the Reminders chat

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google Calendar API**
4. Create OAuth credentials (Desktop app type)
5. Download the credentials JSON file

### 2. Configure Reminder Bot

Copy `config.yaml.example` and add your Google credentials:

```yaml
reminder:
  google:
    credentials_path: "/path/to/credentials.json"
    token_path: "./token.json"
    calendar_id: "primary"
  
  matrix:
    homeserver: "https://matrix.example.org"
    access_token: "YOUR_ACCESS_TOKEN"
    room_id: "!reminderRoomId:example.org"
  
  summary:
    enabled: true
    time: "08:00"
    timezone: "Europe/Berlin"
```

### 3. Run the Bot

```bash
cd matrixreminders
npm install
npm start
```

The bot will authenticate with Google on first run.

## Usage

In your Matrix room, send messages like:

```
Remind me to call John tomorrow at 3pm
Remind me on 11.05 to make an HNO appointment
REMINDER: 11.05 09:00 make an HNO appointment
EVENT: dentist 11.05 14:30
#save Meeting with Sarah next Friday at 10am
DONE: make an HNO appointment
```

The bot will parse these and create calendar events. Reminders also go into the pending-reminder store, so the bot can nudge until you reply with `DONE: <title>`.

Dates can be natural language (`tomorrow`, `next Monday`) or European numeric dates (`DD.MM`, `DD.MM.YYYY`). If a reminder has no time, it defaults to `09:00`.

## Daily Summary

At the configured time, the bot posts a deterministic briefing in the Reminders chat:
- Work-hours handoff note
- Reminders due today
- Today's calendar events

Hermes can separately run an LLM-powered day analysis in the HermesAgent chat. The reminder bot remains responsible for reliable factual delivery.
