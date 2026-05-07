const { GoogleCalendarWrapper } = require('./dist/google-calendar');
const fs = require('fs');
const path = require('path');

// Load config
const configPath = path.join(__dirname, 'config.yaml');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

// Create calendar wrapper
const calendar = new GoogleCalendarWrapper(config);

// Authorize (will use existing token.json)
calendar.authorize().then(async () => {
  const now = new Date();
  const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

  const event = await calendar.createEvent(
    'Test event from Hermes',
    'Created via Hermes agent',
    startTime,
    endTime
  );

  if (event) {
    console.log('Event created:', event.htmlLink);
  } else {
    console.log('Failed to create event');
  }
}).catch(console.error);