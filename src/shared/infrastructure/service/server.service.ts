// External packages
import { Hono, type Context, type Handler, type MiddlewareHandler } from 'hono'
import { prettyJSON } from 'hono/pretty-json'
import { secureHeaders } from 'hono/secure-headers'
import { trimTrailingSlash } from 'hono/trailing-slash'
import { Scalar } from '@scalar/hono-api-reference'
import { OpenAPIHono, createRoute, type RouteConfig } from '@hono/zod-openapi'
import type { HTTPResponseError } from 'hono/types'
import { timeout } from 'hono/timeout'
import { serveStatic } from 'hono/bun'

// Internal types
import type { App } from '../../../features/app/domain/entity/app.entity'
import type { HonoContextType } from '../di/context'

// Internal services and constants
import type { EnvService } from './env.service'
import type { LoggerService } from './logger.service'
import index from '../index.html'
import { HttpError } from '../../domain/entity/http-error.entity'
import { TriggerError } from '../../../features/trigger/domain/entity/trigger-error.entity'
import { join } from 'path'

export type HonoType = { Variables: HonoContextType }

export class ServerService {
  private server: Bun.Server<unknown> | null = null
  private readonly app: Hono<HonoType>
  private readonly openapi: OpenAPIHono<HonoType>
  private readonly pageRoutes = new Map<string, () => Promise<string>>()

  constructor(
    private readonly env: EnvService,
    private readonly logger: LoggerService,
    private readonly apiRoutes: Hono<HonoType>
  ) {
    this.logger = this.logger.child('server-service')
    this.logger.debug('init server')
    this.app = new Hono<HonoType>()
    this.openapi = new OpenAPIHono<HonoType>()
    this.app.use(secureHeaders())
    this.app.use(trimTrailingSlash())
    this.app.use(prettyJSON())
    this.app.use('/api', timeout(30000))
    this.app.use('/static/*', serveStatic({ root: './static' }))
    this.app.onError((error, c) => this.onError(error, c))
  }

  use(middleware: MiddlewareHandler) {
    this.app.use(middleware)
  }

  registerPageRoute(path: string, handler: () => Promise<string>) {
    this.pageRoutes.set(path, handler)
    this.logger.debug(`Registered page route: ${path}`)
  }

  on(methods: string[], path: string, handler: Handler) {
    this.app.on(methods, path, handler)
  }

  onError(error: Error | HTTPResponseError, c: Context<HonoType>) {
    this.logger.error(error.message)
    if (error instanceof TriggerError) {
      return c.json({ error: error.message, success: false }, error.status)
    } else if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status)
    }
    return c.json({ error: error.message }, 500)
  }

  addOpenAPIRoute(routeConfig: RouteConfig) {
    const route = createRoute(routeConfig)
    this.openapi.openapi(route, (c) => {
      return c.json({}, 200)
    })
  }

  addOpenAPIDoc(app: App) {
    this.openapi.doc('/schema', {
      openapi: '3.0.0',
      info: {
        title: app.schema.name,
        version: app.schema.appVersion,
        description: app.schema.description,
      },
      servers: [
        {
          url: this.env.get('BASE_URL') + '/api',
          description: this.env.get('NODE_ENV') === 'development' ? 'Local server' : undefined,
        },
      ],
    })
    this.openapi.get('/scalar', Scalar({ url: '/openapi/schema', theme: 'alternate' }))
  }

  staticFiles = async (req: Request) => {
    const path = req.url.match(/\/static\/(.+)/)
    if (!path || !path[1]) {
      return new Response('Not found', { status: 404 })
    }
    const filePath = join(process.cwd(), 'public', path[1])
    const file = Bun.file(filePath)
    return (await file.exists()) ? new Response(file) : new Response('Not found', { status: 404 })
  }

  start() {
    this.app.route('/openapi', this.openapi)
    this.app.route('/api', this.apiRoutes)

    // Build dynamic routes object
    const routes: Record<
      string,
      | {
          GET?: (req: Request) => Response | Promise<Response>
          POST?: (req: Request) => Response | Promise<Response>
          PATCH?: (req: Request) => Response | Promise<Response>
          PUT?: (req: Request) => Response | Promise<Response>
          DELETE?: (req: Request) => Response | Promise<Response>
        }
      | Bun.HTMLBundle
    > = {
      '/static/*': {
        GET: this.staticFiles,
      },
      '/openapi/*': {
        GET: this.app.fetch,
      },
      '/api/*': {
        GET: this.app.fetch,
        POST: this.app.fetch,
        PATCH: this.app.fetch,
        PUT: this.app.fetch,
        DELETE: this.app.fetch,
      },
    }

    // Add registered page routes
    for (const [path, handler] of this.pageRoutes) {
      routes[path] = {
        GET: async () => {
          try {
            const html = await handler()
            return new Response(html, {
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=300', // 5 minutes cache
              },
            })
          } catch (error) {
            this.logger.error(`Error rendering page ${path}: ` + error)
            return new Response('Internal Server Error', { status: 500 })
          }
        },
      }
    }

    // Fallback to SPA for unmatched routes
    routes['/*'] = index

    this.server = Bun.serve({
      routes,
      port: Number(this.env.get('PORT')),
      development: this.env.get('NODE_ENV') !== 'production',
    })
  }

  async stop() {
    if (this.server) {
      await this.server.stop()
    }
  }
}
