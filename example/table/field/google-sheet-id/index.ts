import type { AppSchema } from '@/types'

export const inGuides = true

export default {
  name: 'Configure a table with a google_sheet_id field',
  description: 'Table with a google_sheet_id field that opens Google Sheets',
  tables: [
    {
      id: 1,
      name: 'CRM Files',
      fields: [
        {
          id: 1,
          name: 'name',
          type: 'single-line-text',
        },
        {
          id: 2,
          name: 'google_sheet_id',
          type: 'single-line-text',
        },
      ],
    },
  ],
} satisfies AppSchema
