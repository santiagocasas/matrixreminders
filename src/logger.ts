import pino from 'pino'
import fs from 'fs'
import path from 'path'

const logDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label })
    }
  },
  pino.destination(path.join(logDir, 'app.log'))
)

export default logger
