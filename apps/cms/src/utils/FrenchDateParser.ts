/** Convert DD/MM/YYYY to an ISO 8601 string (YYYY-MM-DD). */
export class FrenchDateParser {
  static parse(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    const parts = raw.trim().split('/')
    if (parts.length !== 3) return undefined
    const [day, month, year] = parts
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
}
