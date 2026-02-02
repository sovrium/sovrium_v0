import type { Form } from '../../domain/entity/form.entity'
import { toInputDto, type InputDto } from './input.dto'

export type FormDto = {
  id: number
  name: string
  path: string
  action: string
  inputs: InputDto[]
  title?: string
  description?: string
  logo?: string
  successMessage?: string
}

export function toFormDto(form: Form): FormDto {
  return {
    id: form.schema.id,
    name: form.schema.name,
    title: form.schema.title,
    path: form.path,
    action: form.schema.action,
    description: form.schema.description,
    logo: form.schema.logo,
    inputs: form.schema.inputs.map(toInputDto),
    successMessage: form.schema.successMessage,
  }
}
