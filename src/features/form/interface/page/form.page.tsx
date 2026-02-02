import { Form } from '../../../../shared/interface/component/form.component'
import { createRoute, Navigate } from '@tanstack/react-router'
import { rootRoute } from '../../../../shared/interface/page/root.layout'
import {
  TypographyH1,
  TypographyH3,
  TypographyP,
} from '../../../../shared/interface/ui/typography.ui'
import { client } from '../../../../shared/interface/lib/client.lib'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { GetFormDto } from '../../application/dto/get-form.dto'
import { Suspense, useState } from 'react'
import { FormSkeleton } from '../../../../shared/interface/ui/form.ui'
import type { ErrorDto } from '../../../../shared/application/dto/error.dto'
import { Button } from '../../../../shared/interface/ui/button.ui'

const FormDataPage = () => {
  const { path } = formRoute.useParams()
  const { data } = useSuspenseQuery(formQueryOptions(path))
  const [isSubmitted, setIsSubmitted] = useState(false)

  if ('error' in data) {
    if (data.status === 404) {
      return <Navigate to="/404" />
    }
    return <div>Error: {data.error}</div>
  }

  const { form } = data

  const onSubmit = async (values: Record<string, string | File>) => {
    const { action } = form
    if (action.startsWith('/api/tables/')) {
      const tableId = action.replace('/api/tables/', '')
      const response = await client.tables[':tableId'].form.$post({
        param: { tableId },
        form: values,
      })
      if (response.status === 201) {
        setIsSubmitted(true)
      } else {
        const data = await response.json()
        throw new Error('error' in data ? String(data.error) : 'Failed to submit form')
      }
    } else if (action.startsWith('/api/automations/')) {
      const automationIdOrPath = action.replace('/api/automations/', '')
      const response = await client.automations[':automationIdOrPath'].form[':formId'].$post({
        param: { automationIdOrPath, formId: form.id.toString() },
        form: values,
      })
      if (response.status === 200) {
        setIsSubmitted(true)
      } else {
        const data = (await response.json()) as { error: string }
        throw new Error('error' in data ? String(data.error) : 'Failed to submit form')
      }
    } else if (action.startsWith('http')) {
      const response = await fetch(action, {
        method: 'POST',
        body: JSON.stringify(values),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.status === 200) {
        setIsSubmitted(true)
      } else {
        throw new Error(response.statusText || 'Failed to submit form')
      }
    }
  }

  if (isSubmitted) {
    return (
      <div className="p-8 text-center">
        <TypographyH3>{form.successMessage ?? 'Thank you for your submission'}</TypographyH3>
        <Button
          onClick={() => setIsSubmitted(false)}
          className="mt-4"
        >
          New submission
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-8">
        {form.logo && (
          <div className="mb-4">
            <img
              src={form.logo}
              alt=""
              className="h-12 w-auto"
            />
          </div>
        )}
        <div className="mb-2">
          <TypographyH1 className="text-left">{form.title}</TypographyH1>
        </div>
        <div className="text-gray-600">
          <TypographyP>{form.description}</TypographyP>
        </div>
      </div>
      <div className="p-8">
        <Form
          inputs={form.inputs}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}

const FormPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <Suspense fallback={<FormSkeleton />}>
          <FormDataPage />
        </Suspense>
      </div>
    </div>
  )
}

const formQueryOptions = (path: string) =>
  queryOptions<GetFormDto | ErrorDto>({
    queryKey: ['formData'],
    queryFn: async () => {
      const response = await client.forms[':pathOrId'].$get({ param: { pathOrId: path } })
      const data = await response.json()
      return { ...data, status: response.status }
    },
  })

export const formRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forms/$path',
  component: FormPage,
  loader: async ({ context: { queryClient }, params: { path } }) =>
    queryClient.ensureQueryData(formQueryOptions(path)),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData && 'form' in loaderData ? `${loaderData.form.title} - Form` : '',
      },
      {
        name: 'description',
        content: loaderData && 'form' in loaderData ? loaderData.form.description : '',
      },
    ],
  }),
})
