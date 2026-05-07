import fs from 'fs'

const exampleConfig = `
reminder:
  google:
    credentials_path: "/home/casas/matrixreminders/credentials.json"
    token_path: "/home/casas/matrixreminders/token.json"
    calendar_id: "primary"
    timezone: "America/New_York"
  
  matrix:
    homeserver: "https://matrix.example.org"
    access_token: "syt_YOUR_ACCESS_TOKEN_HERE"
    room_id: "!yourRoomId:example.org"
  
  summary:
    time: "08:00"
    timezone: "America/New_York"
`

fs.writeFileSync('config.yaml.example', exampleConfig.trim())
console.log('Created config.yaml.example')
