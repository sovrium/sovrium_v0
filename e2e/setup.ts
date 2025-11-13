import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { createServer } from 'http'
import { createTemplateDatabase } from './template-database'
import { createSqliteTemplateDatabase } from './template-database-sqlite'

export let container: StartedPostgreSqlContainer
export let testServer: ReturnType<typeof createServer>

async function globalSetup() {
  // Configure Docker socket for Colima if not already set
  const os = await import('os')
  const fs = await import('fs')
  const homeDir = os.homedir()
  const colimaSocket = `${homeDir}/.colima/default/docker.sock`

  // Check if Colima socket exists
  if (fs.existsSync(colimaSocket)) {
    // Set the Docker host to use Colima socket
    process.env.DOCKER_HOST = `unix://${colimaSocket}`
    // Disable Ryuk container which has issues with Colima
    process.env.TESTCONTAINERS_RYUK_DISABLED = 'true'
  }

  container = await new PostgreSqlContainer('postgres:16.9').start()

  // Save container info to be used in tests
  process.env.POSTGRES_HOST = container.getHost()
  process.env.POSTGRES_PORT = container.getPort().toString()
  process.env.POSTGRES_USERNAME = container.getUsername()
  process.env.POSTGRES_PASSWORD = container.getPassword()

  // Create PostgreSQL template database with migrations
  await createTemplateDatabase({
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
  })

  // Create SQLite template database with migrations
  await createSqliteTemplateDatabase()

  // Test server
  testServer = createServer(async (req, res) => {
    const { url, method, headers } = req
    let body = ''
    for await (const chunk of req) {
      body += chunk
    }
    let json = null
    try {
      json = JSON.parse(body)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      json = null
    }
    const response = JSON.stringify(
      {
        url,
        method,
        headers,
        body,
        json,
      },
      null,
      2
    )
    res.writeHead(200, {
      'Content-Type': 'application/json',
    })
    res.end(response)
  })
  await new Promise<void>((resolve) => {
    testServer.listen(6000, resolve)
  })
}

export default globalSetup
