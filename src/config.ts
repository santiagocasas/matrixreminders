import yaml from 'js-yaml'
import fs from 'fs'
import path from 'path'
import { IConfig } from './types'
import logger from './logger'

export function loadConfig(): IConfig {
  const configPath = path.join(process.cwd(), 'config.yaml')
  const content = fs.readFileSync(configPath, 'utf-8')
  const config = yaml.load(content) as IConfig
  logger.info('Config loaded successfully')
  return config
}
