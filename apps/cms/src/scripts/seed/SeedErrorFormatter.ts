import { ValidationError } from 'payload'

/**
 * Readable seed error: the field errors of a Payload `ValidationError`, or the
 * message followed by its causes (a failed Drizzle query hides the Postgres
 * error, e.g. a deadlock or a constraint, in `cause`).
 */
export class SeedErrorFormatter {
  static format(err: unknown): string {
    if (err instanceof ValidationError) {
      return err.data.errors.map((error) => `${error.path} : ${error.message}`).join(', ')
    }
    const messages: string[] = []
    let current: unknown = err
    while (current !== undefined && messages.length < 5) {
      messages.push(current instanceof Error ? current.message : String(current))
      current = current instanceof Error ? current.cause : undefined
    }
    return messages.join(' ← ')
  }
}
