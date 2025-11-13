import type { AppSchema } from '@/types'

export const inGuides = true

export default {
  name: 'Run TypeScript code action',
  description: 'Automation with run TypeScript code action',
  automations: [
    {
      id: 1,
      name: 'run-typescript',
      editUrl: 'https://github.com/sovrium/sovrium_v0/blob/main/example/automation/admin.ts',
      trigger: {
        service: 'http',
        event: 'post',
        params: {
          path: '/run-typescript',
        },
      },
      actions: [
        {
          service: 'code',
          action: 'run-typescript',
          name: 'params',
          params: {
            code: String(function () {
              const message: string = 'Hello, world!'
              return { message }
            }),
          },
        },
      ],
    },
  ],
} satisfies AppSchema
