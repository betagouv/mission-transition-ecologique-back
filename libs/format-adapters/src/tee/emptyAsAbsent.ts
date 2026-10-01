/** Baserow exports an empty cell as '' or null: both mean "absent", not a broken file. */
export const emptyAsAbsent = (value: unknown): unknown => (value === '' || value === null ? undefined : value)
