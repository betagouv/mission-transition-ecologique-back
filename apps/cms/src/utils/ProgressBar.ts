export class ProgressBar {
  private current = 0

  constructor(
    private readonly total: number,
    private readonly width = 40,
  ) {
    this.render()
  }

  tick(): void {
    this.current = Math.min(this.current + 1, this.total)
    this.render()
  }

  done(): void {
    this.current = this.total
    this.render()
    process.stdout.write('\n')
  }

  private render(): void {
    const pct = this.total === 0 ? 1 : this.current / this.total
    const filled = Math.round(pct * this.width)
    const bar = '█'.repeat(filled) + '░'.repeat(this.width - filled)
    const percent = Math.round(pct * 100).toString().padStart(3)
    process.stdout.write(`[${bar}] ${percent}% (${this.current}/${this.total})\r`)
  }
}