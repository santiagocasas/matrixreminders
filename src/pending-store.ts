import fs from 'fs'
import path from 'path'
import logger from './logger'

export interface PendingReminder {
  id: string
  roomId: string
  sender: string
  title: string
  dueDate: string // YYYY-MM-DD in local timezone
  active: boolean
  createdAt: string
  lastNudgedAt?: string
}

interface StoreShape {
  reminders: PendingReminder[]
}

export class PendingReminderStore {
  private filePath: string

  constructor(filePath = path.join(process.cwd(), 'data', 'pending-reminders.json')) {
    this.filePath = filePath
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    if (!fs.existsSync(this.filePath)) {
      this.save({ reminders: [] })
    }
  }

  private load(): StoreShape {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as StoreShape
      if (!parsed.reminders) return { reminders: [] }
      return parsed
    } catch (error) {
      logger.error({ error }, 'Failed to load pending reminder store')
      return { reminders: [] }
    }
  }

  private save(data: StoreShape): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2))
  }

  add(reminder: Omit<PendingReminder, 'id' | 'createdAt'>): PendingReminder {
    const data = this.load()
    const full: PendingReminder = {
      ...reminder,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString()
    }
    data.reminders.push(full)
    this.save(data)
    return full
  }

  markAcknowledged(roomId: string, sender: string): number {
    const data = this.load()
    let count = 0
    data.reminders = data.reminders.map((r) => {
      if (r.active && r.roomId === roomId && r.sender === sender) {
        count += 1
        return { ...r, active: false }
      }
      return r
    })
    this.save(data)
    return count
  }

  hasPending(title: string): boolean {
    const normalised = title.toLowerCase().trim()
    return this.load().reminders.some((r) => r.active && r.title.toLowerCase().trim() === normalised)
  }

  findByTitleFragment(fragment: string): PendingReminder | undefined {
    const normalised = fragment.toLowerCase().trim()
    return this.load().reminders.find((r) => r.active && r.title.toLowerCase().includes(normalised))
  }

  markAcknowledgedById(id: string): void {
    const data = this.load()
    data.reminders = data.reminders.map((r) => (r.id === id ? { ...r, active: false } : r))
    this.save(data)
  }

  dueToday(localDate: string): PendingReminder[] {
    return this.load().reminders.filter((r) => r.active && r.dueDate === localDate)
  }

  active(): PendingReminder[] {
    return this.load().reminders.filter((r) => r.active)
  }

  overdueAndNudgeable(): PendingReminder[] {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    return this.load().reminders.filter((r) => {
      if (!r.active) return false
      const dueMs = new Date(r.dueDate + 'T09:00:00').getTime()
      if (dueMs > now.getTime()) return false // not yet due
      if (!r.lastNudgedAt) return true
      return new Date(r.lastNudgedAt) < oneHourAgo
    })
  }

  touchNudge(id: string): void {
    const data = this.load()
    data.reminders = data.reminders.map((r) =>
      r.id === id ? { ...r, lastNudgedAt: new Date().toISOString() } : r
    )
    this.save(data)
  }
}
