import { filter } from 'rxjs'
import z from 'zod'

export function zodFilter<T extends z.ZodType>(schema: T) {
  return filter((value): value is z.infer<T> => schema.safeParse(value).success)
}
