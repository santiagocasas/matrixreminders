const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { google } = require('googleapis')

const CONFIG_PATH = path.join(process.cwd(), 'config.yaml')

function readConfigValue(key) {
  const text = fs.readFileSync(CONFIG_PATH, 'utf8')
  const m = text.match(new RegExp(`${key}:\\s*"([^"]+)"`))
  if (!m) throw new Error(`Missing key in config.yaml: ${key}`)
  return m[1]
}

async function main() {
  const credentialsPath = readConfigValue('credentials_path')
  const tokenPath = readConfigValue('token_path')

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
  const { client_secret, client_id, redirect_uris } = credentials.installed

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris && redirect_uris.length ? redirect_uris[0] : 'http://localhost'
  )

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent'
  })

  console.log('\nOpen this URL in your browser:\n')
  console.log(authUrl)
  console.log('\nAfter allowing access, paste the "code" parameter value here.\n')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question('Authorization code: ', async (code) => {
    try {
      const { tokens } = await oAuth2Client.getToken(code.trim())
      fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2))
      console.log(`\nSaved token to: ${tokenPath}`)
      rl.close()
      process.exit(0)
    } catch (err) {
      console.error('\nFailed to exchange code for token:', err.message || err)
      rl.close()
      process.exit(1)
    }
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
