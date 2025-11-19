import type { Context } from 'hono'
import type { HonoType } from '../../../../shared/infrastructure/service'

export class BucketController {
  static async listObjects(c: Context<HonoType>, data: { bucketId: string }) {
    const app = c.get('app')
    const listObjectsUseCase = c.get('listObjectsUseCase')
    const listObjectsDto = await listObjectsUseCase.execute(app, data.bucketId)
    return c.json(listObjectsDto, 200)
  }

  static async uploadObject(c: Context<HonoType>, data: { bucketId: string; key: string }) {
    const app = c.get('app')
    const uploadObjectUseCase = c.get('uploadObjectUseCase')
    const result = await uploadObjectUseCase.execute(app, data.bucketId, data.key, c.req.raw)
    return c.text(result, 201)
  }

  static async downloadObject(c: Context<HonoType>, data: { bucketId: string; key: string }) {
    const app = c.get('app')
    const downloadObjectUseCase = c.get('downloadObjectUseCase')
    const object = await downloadObjectUseCase.execute(app, data.bucketId, data.key)
    return new Response(object.data as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': object.contentType || 'application/octet-stream',
        'Content-Length': object.size?.toString() || '0',
      },
    })
  }

  static async deleteObject(c: Context<HonoType>, data: { bucketId: string; key: string }) {
    const app = c.get('app')
    const deleteObjectUseCase = c.get('deleteObjectUseCase')
    const result = await deleteObjectUseCase.execute(app, data.bucketId, data.key)
    return c.text(result, 200)
  }
}
