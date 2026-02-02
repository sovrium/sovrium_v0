// Third-party imports
import { z } from 'zod/v4'
import pkg from '../../../../../package.json'

// Form domain imports
import { inputSchema } from './input'

export const formSchema = z
  .object({
    id: z
      .number()
      .int()
      .positive()
      .describe('Unique identifier for the form')
      .meta({
        title: 'Form ID',
        readOnly: true,
        examples: [1, 2, 100],
      }),
    path: z
      .string()
      .trim()
      .min(1)
      .describe('URL path where the form is accessible')
      .meta({
        title: 'Form Path',
        placeholder: '/contact',
        examples: ['/contact', '/signup', '/feedback', '/order'],
        pattern: '^/[a-z0-9-/]*$',
        help: 'Must start with / and use lowercase letters, numbers, hyphens',
      }),
    action: z
      .string()
      .trim()
      .min(1)
      .describe('API endpoint or action to handle form submission')
      .meta({
        title: 'Submit Action',
        placeholder: '/api/submit-form',
        examples: ['/api/contact', '/api/register', 'https://api.example.com/form'],
        help: 'The endpoint that will process the form data',
      }),
    name: z
      .string()
      .trim()
      .min(1)
      .describe('Internal name for the form')
      .meta({
        title: 'Form Name',
        placeholder: 'Enter form name',
        examples: ['Contact Form', 'Registration Form', 'Feedback Survey'],
      }),
    title: z
      .string()
      .trim()
      .optional()
      .describe('Display title shown to users')
      .meta({
        title: 'Display Title',
        placeholder: 'Form title visible to users',
        examples: ['Contact Us', 'Create Your Account', 'We Value Your Feedback'],
      }),
    description: z
      .string()
      .trim()
      .optional()
      .describe('Help text or instructions for the form')
      .meta({
        title: 'Form Description',
        placeholder: 'Describe the purpose of this form',
        examples: [
          'Fill out this form to get in touch with our team',
          'Please provide your details to create an account',
        ],
        uiSchema: { 'ui:widget': 'textarea', 'ui:rows': 2 },
      }),
    logo: z
      .string()
      .trim()
      .optional()
      .describe('URL of the logo image displayed above the form title')
      .meta({
        title: 'Form Logo',
        placeholder: '/static/logo.png',
        examples: ['/static/logo.png', 'https://example.com/logo.png'],
        help: 'URL or path to the logo image (e.g., /static/logo.png)',
      }),
    inputs: z
      .array(inputSchema)
      .default([])
      .describe('List of form fields for user input')
      .meta({
        title: 'Form Fields',
        minItems: 1,
        uiSchema: {
          'ui:ArrayFieldTemplate': 'collapsible',
          'ui:options': { orderable: true, removable: true, addable: true },
        },
      }),
    successMessage: z
      .string()
      .trim()
      .optional()
      .describe('Message displayed after successful form submission')
      .meta({
        title: 'Success Message',
        placeholder: 'Thank you for your submission!',
        examples: [
          'Thank you! We will get back to you soon.',
          'Your account has been created successfully!',
          'Form submitted successfully.',
        ],
        uiSchema: { 'ui:widget': 'textarea', 'ui:rows': 2 },
      }),
  })
  .strict()
  .meta({
    title: 'User Form',
    description: 'A form for collecting user input with customizable fields and actions',
    version: pkg.version,
  })

export type FormSchema = z.infer<typeof formSchema>
