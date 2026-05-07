# Reminder Bot Setup Guide

## Overview

The reminder bot connects Matrix to Google Calendar. You can:
- Send reminders in natural language (e.g., "Remind me to call John tomorrow at 3pm")
- Get daily summaries at 8am of your upcoming events

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
    time: "08:00"
    timezone: "America/New_York"
```

### 3. Run the Bot

```bash
cd /home/casas/matrixreminders
npm install
npm start
```

The bot will authenticate with Google on first run.

## Usage

In your Matrix room, send messages like:

```
Remind me to call John tomorrow at 3pm
#save Meeting with Sarah next Friday at 10am
```

The bot will parse these and create calendar events.

## Daily Summary

At 8am every day, the bot will post a summary of:
- Today's events
- Upcoming events
- Time reminders
