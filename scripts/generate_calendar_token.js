const fs = require('fs')
const path = require('path')
const readline = require('readline/promises')
const { stdin: input, stdout: output } = require('process')
const { google } = require('googleapis')

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json')
const TOKEN_PATH = path.join(process.cwd(), 'token.json')
const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

function extractAuthorizationCode(input) {
  const value = input.trim()

  if (!value) {
    throw new Error('Authorization code cannot be empty')
  }

  try {
    const parsedUrl = new URL(value)
    const code = parsedUrl.searchParams.get('code')
    if (code) return code
  } catch (_) {
    // The pasted value may be just the query string or the raw code.
  }

  if (value.startsWith('code=') || value.includes('&code=')) {
    const params = new URLSearchParams(value.startsWith('?') ? value.slice(1) : value)
    const code = params.get('code')
    if (code) return code
  }

  return value
}

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Missing credentials file: ${CREDENTIALS_PATH}`)
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'))
  const client = credentials.installed || credentials.web

  if (!client?.client_id || !client?.client_secret || !client?.redirect_uris?.length) {
    throw new Error('credentials.json must contain client_id, client_secret, and redirect_uris')
  }

  return client
}

async function main() {
  const { client_id, client_secret, redirect_uris } = loadCredentials()
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  })

  console.log('\nGoogle Calendar OAuth token generator')
  console.log('=====================================')
  console.log(`\nThis script will read:  ${CREDENTIALS_PATH}`)
  console.log(`This script will write: ${TOKEN_PATH}`)
  console.log('\n1. Open this URL in your browser:\n')
  console.log(authUrl)
  console.log('\n2. Sign in with the Google account that owns or can edit the target calendar.')
  console.log('3. If Google says the app is not verified, click "Advanced", then "Go to <app name> (unsafe)".')
  console.log('4. Approve the Calendar permission request.')
  console.log('5. Copy the single-use authorization code from the browser and paste it below.\n')

  const rl = readline.createInterface({ input, output })

  try {
    const answer = await rl.question('Authorization code, redirected URL, or query string: ')
    const code = extractAuthorizationCode(answer)
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      console.warn('\nWarning: Google did not return a refresh_token.')
      console.warn('Confirm the OAuth app is In Production, then revoke the app access from your Google Account and run this script again.')
    }

    fs.writeFileSync(TOKEN_PATH, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 })
    console.log(`\nSaved OAuth token payload to ${TOKEN_PATH}`)
  } finally {
    rl.close()
  }
}

main().catch((error) => {
  console.error('\nFailed to generate token.json')
  console.error(error.message || error)
  process.exitCode = 1
})
