import { and, eq, SQL } from 'drizzle-orm'
import type { DatabaseService } from '../../../../shared/infrastructure/service/database.service'
import { Kysely, PostgresDialect, type Dialect, ExpressionWrapper } from 'kysely'
import type { SqlBool } from 'kysely'
import { BunWorkerDialect } from 'kysely-bun-worker'
import type { Table } from '../../domain/entity/table.entity'
import type { ViewRow } from '../../domain/object-value/view-row.object-value'
import type { RecordFieldRow } from '../../domain/object-value/record-field-row.object-value'
import type { ConditionsSchema } from '../../../action/domain/schema/condition'

type Base<I, D> = {
  create(data: I): Promise<void>
  update(id: D, data: Partial<Omit<I, 'id'>>): Promise<void>
}

type DatabaseTable<I, S> = Base<I, number> & {
  list(): Promise<S[]>
  get(id: number): Promise<S | undefined>
}

type DatabaseTableField<I, S> = Base<I, number> & {
  listByTableId(tableId: number): Promise<S[]>
  get(fieldId: number, tableId: number): Promise<S | undefined>
}

type DatabaseRecord<I, S> = Base<I, string> & {
  get(id: string): Promise<S | undefined>
}

type DatabaseRecordField<I, S> = Base<I, string> & {
  listByRecordId(recordId: string): Promise<RecordFieldRow[]>
  get(id: string): Promise<S | undefined>
}

export class TableDatabaseService {
  private readonly databaseView: Kysely<{
    [key: string]: ViewRow
  }>

  constructor(private readonly database: DatabaseService) {
    let dialect: Dialect
    if (database.provider === 'postgres') {
      dialect = new PostgresDialect({
        pool: database.postgresPool,
      })
    } else {
      dialect = new BunWorkerDialect({
        url: database.url,
      })
    }
    this.databaseView = new Kysely({
      dialect,
    })
  }

  get provider() {
    return this.database.provider
  }

  get schema() {
    return this.database.schema
  }

  get record() {
    if (this.database.provider === 'postgres') {
      const schema = this.database.postgresSchema
      const db = this.database.postgres
      return {
        get: async (id: string) => db.query.record.findFirst({ where: eq(schema.record.id, id) }),
      }
    } else {
      const schema = this.database.sqliteSchema
      const db = this.database.sqlite
      return {
        get: async (id: string) => db.query.record.findFirst({ where: eq(schema.record.id, id) }),
      }
    }
  }

  get transaction() {
    if (this.database.provider === 'postgres') {
      const schema = this.database.postgresSchema
      const db = this.database.postgres
      return async (
        callback: (tx: {
          execute: (query: SQL) => Promise<void>
          table: DatabaseTable<typeof schema.table.$inferInsert, typeof schema.table.$inferSelect>
          table_field: DatabaseTableField<
            typeof schema.field.$inferInsert,
            typeof schema.field.$inferSelect
          >
          record: DatabaseRecord<
            typeof schema.record.$inferInsert,
            typeof schema.record.$inferSelect
          >
          recordField: DatabaseRecordField<
            typeof schema.recordField.$inferInsert,
            typeof schema.recordField.$inferSelect
          >
        }) => Promise<void>
      ) =>
        db.transaction(async (tx) => {
          await callback({
            execute: async (query) => {
              await tx.execute(query)
            },
            table: {
              create: async (data) => {
                await tx.insert(schema.table).values(data)
              },
              update: async (id, data) => {
                await tx.update(schema.table).set(data).where(eq(schema.table.id, id))
              },
              get: async (id) => tx.query.table.findFirst({ where: eq(schema.table.id, id) }),
              list: async () => tx.select().from(schema.table),
            },
            table_field: {
              create: async (data) => {
                await tx.insert(schema.field).values(data)
              },
              update: async (id, data) => {
                await tx.update(schema.field).set(data).where(eq(schema.field.id, id))
              },
              get: async (fieldId, tableId) =>
                tx.query.field.findFirst({
                  where: and(eq(schema.field.id, fieldId), eq(schema.field.table_id, tableId)),
                }),
              listByTableId: async (tableId) =>
                tx.select().from(schema.field).where(eq(schema.field.table_id, tableId)),
            },
            record: {
              create: async (data) => {
                await tx.insert(schema.record).values(data)
              },
              update: async (id, data) => {
                await tx.update(schema.record).set(data).where(eq(schema.record.id, id))
              },
              get: async (id) => tx.query.record.findFirst({ where: eq(schema.record.id, id) }),
            },
            recordField: {
              create: async (data) => {
                await tx.insert(schema.recordField).values(data)
              },
              update: async (id, data) => {
                await tx.update(schema.recordField).set(data).where(eq(schema.recordField.id, id))
              },
              get: async (id) =>
                tx.query.recordField.findFirst({ where: eq(schema.recordField.id, id) }),
              listByRecordId: async (recordId) =>
                tx
                  .select({
                    id: schema.recordField.id,
                    name: schema.field.name,
                    value: schema.recordField.value,
                  })
                  .from(schema.recordField)
                  .innerJoin(schema.field, eq(schema.recordField.table_field_id, schema.field.id))
                  .where(eq(schema.recordField.record_id, recordId)),
            },
          })
        })
    } else {
      const schema = this.database.sqliteSchema
      const db = this.database.sqlite
      return (
        callback: (tx: {
          execute: (query: SQL) => Promise<void>
          table: DatabaseTable<typeof schema.table.$inferInsert, typeof schema.table.$inferSelect>
          table_field: DatabaseTableField<
            typeof schema.field.$inferInsert,
            typeof schema.field.$inferSelect
          >
          record: DatabaseRecord<
            typeof schema.record.$inferInsert,
            typeof schema.record.$inferSelect
          >
          recordField: DatabaseRecordField<
            typeof schema.recordField.$inferInsert,
            typeof schema.recordField.$inferSelect
          >
        }) => Promise<void>
      ) =>
        db.transaction(async (tx) => {
          await callback({
            execute: async (query) => {
              tx.run(query)
            },
            table: {
              create: async (data) => tx.insert(schema.table).values(data),
              update: async (id, data) =>
                tx.update(schema.table).set(data).where(eq(schema.table.id, id)),
              get: async (id) => tx.query.table.findFirst({ where: eq(schema.table.id, id) }),
              list: async () => tx.select().from(schema.table),
            },
            table_field: {
              create: async (data) => tx.insert(schema.field).values(data),
              update: async (id, data) =>
                tx.update(schema.field).set(data).where(eq(schema.field.id, id)),
              get: async (fieldId, tableId) =>
                tx.query.field.findFirst({
                  where: and(eq(schema.field.id, fieldId), eq(schema.field.table_id, tableId)),
                }),
              listByTableId: async (tableId) =>
                tx.select().from(schema.field).where(eq(schema.field.table_id, tableId)),
            },
            record: {
              create: async (data) => tx.insert(schema.record).values(data),
              update: async (id, data) =>
                tx.update(schema.record).set(data).where(eq(schema.record.id, id)),
              get: async (id) => tx.query.record.findFirst({ where: eq(schema.record.id, id) }),
            },
            recordField: {
              create: async (data) => tx.insert(schema.recordField).values(data),
              update: async (id, data) =>
                tx.update(schema.recordField).set(data).where(eq(schema.recordField.id, id)),
              get: async (id) =>
                tx.query.recordField.findFirst({ where: eq(schema.recordField.id, id) }),
              listByRecordId: async (recordId) =>
                tx
                  .select({
                    id: schema.recordField.id,
                    name: schema.field.name,
                    value: schema.recordField.value,
                  })
                  .from(schema.recordField)
                  .innerJoin(schema.field, eq(schema.recordField.table_field_id, schema.field.id))
                  .where(eq(schema.recordField.record_id, recordId)),
            },
          })
        })
    }
  }

  view(table: Table) {
    const view = this.databaseView.selectFrom(table.slug)
    return {
      get: async (id: string): Promise<ViewRow | undefined> => {
        const record = await view
          .selectAll()
          .where('_archived_at', 'is', null)
          .where('_id', '=', id)
          .executeTakeFirst()
        return record ? this.postProcessViewRecord(table, record) : undefined
      },
      list: async (filter?: ConditionsSchema): Promise<ViewRow[]> => {
        let query = view.selectAll().where('_archived_at', 'is', null)

        if (filter) {
          query = query.where(({ and, or, not, eb, exists }) => {
            const buildWhere = (
              condition: ConditionsSchema
            ): ExpressionWrapper<{ [key: string]: ViewRow }, string, SqlBool> => {
              if ('and' in condition) {
                return and(condition.and.map(buildWhere))
              }
              if ('or' in condition) {
                return or(condition.or.map(buildWhere))
              }
              switch (condition.operator) {
                case 'contains':
                  return eb(condition.target, 'like', `%${condition.value}%`)
                case 'does-not-contain':
                  return not(eb(condition.target, 'like', `%${condition.value}%`))
                case 'exists':
                  return exists(condition.target)
                case 'does-not-exist':
                  return not(exists(condition.target))
                case 'is-true':
                  if (this.provider === 'postgres') {
                    return eb(condition.target, '=', true)
                  } else {
                    return eb(condition.target, '=', 1)
                  }
                case 'is-false':
                  if (this.provider === 'postgres') {
                    return eb(condition.target, '=', false)
                  } else {
                    return eb(condition.target, '=', 0)
                  }
                default: {
                  const _exhaustiveCheck: never = condition
                  throw new Error(`Unhandled case: ${_exhaustiveCheck}`)
                }
              }
            }
            return buildWhere(filter)
          })
        }

        query = query.orderBy('_created_at', 'desc')

        const records = await query.execute()
        return this.postProcessViewRecords(table, records)
      },
      listByIds: async (ids: string[]): Promise<ViewRow[]> => {
        const records = await view
          .selectAll()
          .where('_archived_at', 'is', null)
          .where('_id', 'in', ids)
          .execute()
        return this.postProcessViewRecords(table, records)
      },
    }
  }

  isViewRow(record: unknown): record is ViewRow {
    return (
      typeof record === 'object' &&
      record !== null &&
      '_id' in record &&
      '_created_at' in record &&
      '_updated_at' in record &&
      '_archived_at' in record
    )
  }

  postProcessViewRecord(
    table: Table,
    record: {
      [key: string]: unknown
    }
  ): ViewRow {
    if (!this.isViewRow(record)) {
      throw new Error('Invalid view row')
    }
    if (this.provider === 'sqlite') {
      for (const field of table.fields) {
        if (field.schema.type === 'checkbox') {
          record[field.slug] = record[field.slug] === 1
        }
      }
      return {
        ...record,
        _created_at: new Date(Number(record._created_at) * 1000).toISOString(),
        _updated_at: new Date(Number(record._updated_at) * 1000).toISOString(),
        _archived_at: record._archived_at
          ? new Date(Number(record._archived_at) * 1000).toISOString()
          : null,
      }
    }
    return record
  }

  postProcessViewRecords(
    table: Table,
    records: {
      [key: string]: unknown
    }[]
  ): ViewRow[] {
    return records.map((record) => this.postProcessViewRecord(table, record))
  }
}
