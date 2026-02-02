import type { AppSchema } from '@/types'

export default {
  name: 'Display a form with a logo',
  description: 'Form with a logo displayed above the title',
  forms: [
    {
      id: 1,
      name: 'contact-us',
      title: 'Contact us',
      description: 'Please fill in the form below to contact us.',
      logo: '/static/logo.png',
      path: '/contact-us',
      action: '/api/tables/Contacts',
      inputs: [
        {
          label: 'Name',
          name: 'name',
          type: 'single-line-text',
        },
      ],
    },
  ],
  tables: [
    {
      id: 1,
      name: 'Contacts',
      fields: [
        {
          id: 1,
          name: 'name',
          type: 'single-line-text',
        },
      ],
    },
  ],
} satisfies AppSchema
