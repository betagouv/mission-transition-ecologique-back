import { SlugRedirects } from './SlugRedirects'

/** Project slug redirects: the `project_redirects` table of upstream `redirects.json`. */
export class ProjectRedirects extends SlugRedirects {
  constructor(raw: unknown) {
    super(raw, 'project_redirects')
  }
}
