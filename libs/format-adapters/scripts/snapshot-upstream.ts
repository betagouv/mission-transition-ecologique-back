// Refreshes the versioned copy of the upstream files (`static/upstream/`), the
// development fallback used when GitHub is unreachable. Reads GitHub strictly (no
// fallback): a failed download must not overwrite the copy with itself. Projects
// are written as upstream publishes them, unvalidated: a validated copy would
// reorder the keys, and the import validates what it reads anyway.
//
// Run from the repo root: `pnpm data:snapshot`, then commit the diff.
import { LocalJsonSnapshot } from '../src/tee/LocalJsonSnapshot'
import { UPSTREAM_FILES } from '../src/tee/UpstreamFile'
import { UpstreamJsonSource } from '../src/tee/UpstreamJsonSource'

async function main(): Promise<void> {
  const source = new UpstreamJsonSource()
  const snapshot = new LocalJsonSnapshot()
  process.stdout.write(`Source : ${source.describe()}\n`)

  const loaders = {
    programs: () => source.programs<unknown[]>(),
    projects: () => source.raw('projects'),
    redirects: () => source.redirects<unknown>(),
    operators: () => source.operators(),
  }

  for (const file of UPSTREAM_FILES) {
    const data = await loaders[file]()
    if (data === null) {
      process.stdout.write(`${file} : absent en amont (404), copie inchangée\n`)
      continue
    }
    snapshot.write(file, data)
    const count = Array.isArray(data) ? `${data.length.toString()} entrées` : 'objet'
    process.stdout.write(`${file} : ${count} → ${snapshot.path(file)}\n`)
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Snapshot impossible : ${(error as Error).message}\n`)
  process.exit(1)
})
