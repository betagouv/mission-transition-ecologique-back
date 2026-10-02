import { SlugRedirects } from './SlugRedirects'

/** Program slug redirects: the `program_redirects` table of upstream `redirects.json`. */
export class ProgramRedirects extends SlugRedirects {
  constructor(raw: unknown) {
    super(raw, 'program_redirects')
  }
}
