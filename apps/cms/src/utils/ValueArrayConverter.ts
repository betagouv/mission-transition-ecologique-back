/** Convert an array of strings to Payload array-of-{value} format. */
export class ValueArrayConverter {
  static from(items: string[] | undefined): Array<{ value: string }> {
    if (!items || items.length === 0) return []
    return items.map((v) => ({ value: v }))
  }
}
