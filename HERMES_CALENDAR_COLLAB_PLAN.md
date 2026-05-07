# Hermes + Calendar Bot Collaboration Plan

Goal
- Keep Hermes as planning/assistant brain.
- Keep Reminder bot as deterministic calendar executor.
- Avoid duplicate replies and identity conflicts.

Phase 1: Identity separation
1. Create dedicated Matrix account for reminder bot (example: `@reminder-bot:matrix.example.org`).
2. Keep Hermes on current bot account.
3. Use separate access tokens and separate process services.

Phase 2: Room topology
1. ROOM_A (Private reminder room): user + reminder bot only.
2. ROOM_B (Planning room): user + Hermes only.
3. ROOM_C (Coordination room): user + Hermes + reminder bot.

Phase 3: Command contract
- In ROOM_C, user writes natural language to Hermes.
- Hermes outputs normalized command message for reminder bot:
  EVENT: <title> | DATE: <iso/date phrase>
  REMINDER: <title> | DATE: <iso/date phrase or omitted>
- Reminder bot only executes explicit EVENT:/REMINDER: lines.

Phase 4: Safety and state
1. Add idempotency key per command to avoid duplicate calendar creation.
2. Add per-room allowlist in reminder bot config.
3. Add acknowledgement flow: reminder bot posts event link; Hermes summarizes.

Phase 5: Daily operating loop
1. 08:00 reminder bot posts strict daily agenda from Google Calendar.
2. Hermes adds prioritization suggestions and schedule strategy.
3. End-of-day Hermes asks closure questions; reminder bot marks carry-overs.

Acceptance criteria
- No duplicate replies.
- No cross-bot loop.
- Calendar event creation only happens from reminder bot.
- Hermes can help plan but cannot accidentally create duplicate events.
