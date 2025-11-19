import {
  createRoute,
  Navigate,
  useNavigate,
  useParams,
  Link as RouterLink,
} from '@tanstack/react-router'
import Layout from '../../../../app/interface/page/admin/layout'
import { DataTable } from '../../../../../shared/interface/component/data-table.component'
import { client } from '../../../../../shared/interface/lib/client.lib'
import { queryOptions, useQuery, useSuspenseQuery, useMutation } from '@tanstack/react-query'
import { Suspense } from 'react'
import { adminRoute } from '../../../../app/interface/page/router'
import type { ListTablesDto } from '../../../application/dto/list-table.dto'
import type { ListRecordsDto } from '../../../application/dto/list-records.dto'
import { TypographyP } from '../../../../../shared/interface/ui/typography.ui'
import { TableSkeleton } from '../../../../../shared/interface/ui/table.ui'
import { queryClient } from '../../../../../shared/interface/lib/query.lib'
import {
  CircleChevronDown,
  File,
  LetterText,
  Link,
  Mail,
  Maximize2,
  Phone,
  Plus,
  SquareCheck,
  Text,
  Trash,
  ChevronDown,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Checkbox } from '../../../../../shared/interface/ui/checkbox.ui'
import { toast } from 'sonner'
import type { DeleteMultipleRecordsDto } from '../../../application/dto/delete-multiple-records.dto'

const tableRecordsQueryOptions = (tableId: string) =>
  queryOptions<ListRecordsDto>({
    queryKey: ['tableRecordsData', tableId],
    queryFn: () => client.tables[`:tableId`].$get({ param: { tableId } }).then((res) => res.json()),
  })

export const tablesQueryOptions = () =>
  queryOptions<ListTablesDto>({
    queryKey: ['tablesData'],
    queryFn: () => client.tables.$get().then((res) => res.json()),
  })

const RecordsDataTable = () => {
  const navigate = useNavigate()
  const { tableId } = useParams({ from: '/admin/tables/$tableId' })
  const {
    data: { tables },
  } = useSuspenseQuery(tablesQueryOptions())
  const {
    data: { records },
  } = useSuspenseQuery(tableRecordsQueryOptions(tableId))
  const table = tables.find((table) => table.id === tableId)
  if (!table) {
    return <Navigate to="/404" />
  }

  const deleteRecordsMutation = useMutation({
    mutationFn: async (rows: string[]) => {
      const response = await client.tables[`:tableId`].$delete({
        param: { tableId },
        query: { ids: rows },
      })
      return await response.json()
    },
    onSuccess: (data: DeleteMultipleRecordsDto) => {
      if (data.records.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['tableRecordsData', tableId] })
        toast.success(`${data.records.length} records deleted`)
      }
    },
  })

  const columns: ColumnDef<Record<string, string>>[] = table.fields.map((field) => ({
    accessorKey: field.name,
    header: () => {
      switch (field.type) {
        case 'single-line-text':
          return (
            <div className="flex items-center gap-2">
              <Text className="size-4" />
              <span>{field.name}</span>
            </div>
          )
        case 'long-text':
          return (
            <div className="flex items-center gap-2">
              <LetterText className="size-4" />
              <span>{field.name}</span>
            </div>
          )
        case 'checkbox':
          return (
            <div className="flex items-center gap-2">
              <SquareCheck className="size-4" />
              <span>{field.name}</span>
            </div>
          )
        case 'single-select':
          return (
            <div className="flex items-center gap-2">
              <CircleChevronDown className="size-4" />
              <span>{field.name}</span>
            </div>
          )
        case 'single-attachment':
          return (
            <div className="flex items-center gap-2">
              <File className="size-4" />
              <span>{field.name}</span>
            </div>
          )
        case 'email':
          return (
            <div className="flex items-center gap-2">
              <Mail className="size-4" />
              <span>{field.name}</span>
            </div>
          )
        case 'phone-number':
          return (
            <div className="flex items-center gap-2">
              <Phone className="size-4" />
              <span>{field.name}</span>
            </div>
          )
        case 'url':
          return (
            <div className="flex items-center gap-2">
              <Link className="size-4" />
              <span>{field.name}</span>
            </div>
          )
        default: {
          const _exhaustiveCheck: never = field.type
          throw new Error(`Unhandled case: ${_exhaustiveCheck}`)
        }
      }
    },
    cell: ({ row }) => {
      switch (field.type) {
        case 'checkbox':
          return <Checkbox checked={row.getValue(field.name)} />
        default: {
          const value = row.getValue(field.name)
          // Special handling for google_sheet_id field
          if (field.name === 'google_sheet_id' && value) {
            return (
              <a
                href={`https://docs.google.com/spreadsheets/d/${value}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {value as string}
              </a>
            )
          }
          return (value as string) ?? null
        }
      }
    },
  }))

  columns.unshift(
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      size: 30,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'number',
      header: () => <span className="text-center">#</span>,
      cell: ({ row }) => (
        <div className="relative flex items-center justify-center">
          <span className="group-hover:opacity-0">{row.index + 1}.</span>
          <RouterLink
            className="hover:bg-muted absolute flex items-center justify-center rounded-full p-1 opacity-0 group-hover:opacity-100"
            to={`/admin/tables/$tableId/records/$recordId`}
            params={{ tableId, recordId: row.original._id! }}
          >
            <Maximize2 className="size-4 cursor-pointer" />
          </RouterLink>
        </div>
      ),
      size: 40,
      enableSorting: false,
      enableHiding: false,
    }
  )

  columns.push(
    {
      id: 'createdAt',
      accessorKey: '_createdAt',
      header: 'created_at',
      cell: ({ row }) => {
        const date = new Date(row.original._createdAt!)
        return date.toLocaleString()
      },
    },
    {
      id: 'id',
      accessorKey: '_id',
      header: 'id',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original._id}</span>,
    }
  )

  return (
    <DataTable
      verticalSeparator
      fullPage
      columns={columns}
      data={records.map((record) => ({
        ...record.fields,
        _id: record.id,
        _createdAt: record.createdAt,
      }))}
      actions={[
        {
          label: 'Create',
          icon: <Plus />,
          onClick: () => {
            navigate({ to: `/admin/tables/${tableId}/record/new` })
          },
        },
        {
          label: 'Actions',
          icon: <ChevronDown />,
          variant: 'outline',
          activeOnSelectedRows: true,
          actions: [
            {
              label: 'Delete',
              icon: <Trash />,
              onClick: (rows) => {
                deleteRecordsMutation.mutate(rows.map((row) => row.original._id!))
              },
            },
          ],
        },
      ]}
      pageSizes={[50, 100, 200]}
    />
  )
}

const TablesPage = () => {
  const { data } = useQuery(tablesQueryOptions())
  const { tableId } = useParams({ from: '/admin/tables/$tableId' })
  const table = data?.tables.find((table) => table.id === tableId)
  return (
    <Layout
      breadcrumbs={[
        { title: 'Tables', url: '/admin/tables' },
        { title: table?.name ?? '', url: '/admin/tables/$tableId' },
      ]}
    >
      <Suspense
        fallback={
          <div className="flex flex-col gap-4 p-6">
            <TableSkeleton />
          </div>
        }
      >
        <RecordsDataTable />
      </Suspense>
    </Layout>
  )
}

const TablesRedirect = () => {
  const { data } = useSuspenseQuery(tablesQueryOptions())
  const firstTable = data.tables[0]
  if (firstTable) {
    return (
      <Navigate
        to="/admin/tables/$tableId"
        params={{ tableId: firstTable.id }}
      />
    )
  }
  return (
    <Layout breadcrumbs={[{ title: 'Tables', url: '/admin/tables' }]}>
      <div className="flex flex-col gap-4 p-6">
        <TypographyP>No tables found</TypographyP>
      </div>
    </Layout>
  )
}

export const tablesAdminRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/tables/$tableId',
  loader: async ({ context: { queryClient }, params: { tableId } }) => {
    const { tables } = await queryClient.ensureQueryData(tablesQueryOptions())
    const { records } = await queryClient.ensureQueryData(tableRecordsQueryOptions(tableId))
    return {
      tables,
      records,
    }
  },
  component: TablesPage,
  head: ({ loaderData, params: { tableId } }) => {
    const table = loaderData?.tables.find((table) => table.id === tableId)
    return {
      meta: [
        {
          title: `Table "${table?.name}" - Admin`,
        },
        {
          name: 'description',
          content: `Table "${table?.name}" page for admin`,
        },
      ],
    }
  },
})

export const tablesRedirectAdminRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/tables',
  loader: async ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(tablesQueryOptions())
  },
  component: TablesRedirect,
  head: () => ({
    meta: [
      {
        title: 'Tables - Admin',
      },
    ],
  }),
})
