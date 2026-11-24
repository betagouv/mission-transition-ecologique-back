/**
 * Whether an upstream program is over: its end date (`date_cloture`) is before
 * today. Upstream carries no "archived" status, only that date, so the sync
 * archives an expired program to show it as such in the back office; AGIR keeps
 * reading the end date. The end date itself is the last valid day. Days are
 * Paris calendar days, the team's and the upstream data's time zone.
 */
export class ProgramExpiry {
  private static readonly CALENDAR = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  /** @param today Paris calendar day, `YYYY-MM-DD`. */
  constructor(private readonly today: string) {}

  static at(now: Date = new Date()): ProgramExpiry {
    return new ProgramExpiry(ProgramExpiry.calendarDay(now))
  }

  isExpired(endDate: string | undefined): boolean {
    if (!endDate) return false
    const day = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : ProgramExpiry.calendarDay(new Date(endDate))
    return day < this.today
  }

  private static calendarDay(date: Date): string {
    return ProgramExpiry.CALENDAR.format(date)
  }
}
