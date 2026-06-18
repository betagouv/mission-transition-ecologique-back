'use client'

import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import type { CanonicalProgramData, CanonicalProgramInput } from '@tee-backoffice/canonical'

/**
 * Demo page proving `@tee-backoffice/canonical` is consumable from the Next.js
 * front end: it builds a raw input object, validates it through the package's
 * public API, uses the value object's getters/methods, and demonstrates the
 * deep-immutability guarantee (frozen original vs shallow vs deep copy).
 *
 * Marked `'use client'` on purpose — validation and the `CanonicalProgram`
 * methods run in the browser bundle, not just on the server.
 */

// A raw, unvalidated object — exactly what a DTO/ETL layer would produce.
const rawProgram: CanonicalProgramInput = {
  id: 'a1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'diagnostic-energie-pme',
  source: 'ADEME',
  date_mise_a_jour: '2026-03-19T17:00:00+01:00',
  titre: 'Diagnostic énergie PME',
  promesse: 'Réduisez votre facture énergétique',
  description: 'Un diagnostic financé pour les PME industrielles.',
  statut: 'actif',
  date_ouverture: '2026-01-01',
  date_cloture: '2026-12-31',
  types_aides: ['financement', 'formation'],
  montant: 'Jusqu’à 70 % des dépenses',
  duree: '8 jours de formation',
  operateurs: {
    contact: { nom: 'Bpifrance', nom_normalise: 'BPIFRANCE', siren: '320252489' },
    autres: [{ nom: 'Région Bretagne' }],
  },
  contact_question: { type: 'email', valeur: 'contact@ademe.fr' },
  url_source: 'https://entreprises.ademe.fr/diagnostic',
  eligibilite: {
    effectif: { texte: ['Jusqu’à 250 salariés'], structure: { intervalles: [{ min: 0, max: 249 }] } },
    secteur_activite: { texte: ['Industrie'], structure: { inclusions: ['C'], exclusions: ['33.20'] } },
  },
  themes: ['energie', 'batiment'],
  autres_donnees: { ademe_id_dsp: 'DSP-000123' },
}

const result = new CanonicalProgramValidator().validate(rawProgram)

/** Run a mutation and report whether the runtime allowed it. */
function attempt(label: string, fn: () => void): { label: string; ok: boolean; detail: string } {
  try {
    fn()
    return { label, ok: true, detail: 'autorisé' }
  } catch (error) {
    return { label, ok: false, detail: `bloqué (${(error as Error).name})` }
  }
}

export default function CanonicalDemoPage() {
  if (!result.success) {
    return (
      <section style={styles.page}>
        <h1>Canonical — échec de validation</h1>
        <pre style={styles.json}>{JSON.stringify(result.errors, null, 2)}</pre>
      </section>
    )
  }

  // `program` is a CanonicalProgram value object. `data` is its validated,
  // typed output (CanonicalProgramData) — deeply frozen at runtime.
  const { program } = result
  const data: CanonicalProgramData = program.data

  // Shallow copy: a NEW top-level object, but nested values are the SAME frozen
  // references as the original.
  const shallow: CanonicalProgramData = { ...data }

  // Deep copy: fully independent and mutable (CanonicalProgram.toMutable()).
  const deep: CanonicalProgramData = program.toMutable()

  // Note: CanonicalProgramData is NOT a `readonly` type — TypeScript allows all
  // these assignments. The protection is the runtime deep-freeze, which is why
  // some of these throw even though they compile.
  const outcomes = [
    attempt('original.themes.push("eau")', () => void data.themes?.push('eau')),
    attempt('shallow.titre = … (racine)', () => {
      shallow.titre = 'Modifié via copie shallow'
    }),
    attempt('shallow.themes.push("eau") (imbriqué, gelé)', () => void shallow.themes?.push('eau')),
    attempt('deep.titre = …', () => {
      deep.titre = 'Modifié via copie deep'
    }),
    attempt('deep.themes.push("eau")', () => void deep.themes?.push('eau')),
  ]

  return (
    <section style={styles.page}>
      <article style={styles.card}>
        <div style={styles.badgeRow}>
          <span style={styles.badge}>{program.statut}</span>
          {program.isActive() && <span style={styles.badgeOk}>actif</span>}
          {Object.isFrozen(program.data) && <span style={styles.badgeFrozen}>🔒 gelé</span>}
        </div>
        <h1 style={styles.title}>{program.data.titre}</h1>
        <p style={styles.subtitle}>
          {program.operateurContact.nom} · <code>{program.slug}</code>
        </p>
      </article>

      <h2 style={styles.heading}>Immutabilité — original gelé vs copie shallow vs copie deep</h2>
      <ul style={styles.outcomes}>
        {outcomes.map((o) => (
          <li key={o.label} style={o.ok ? styles.ok : styles.bad}>
            {o.ok ? '✅' : '❌'} <code>{o.label}</code> — {o.detail}
          </li>
        ))}
      </ul>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}></th>
            <th style={styles.th}>titre</th>
            <th style={styles.th}>themes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.td}>original (gelé)</td>
            <td style={styles.td}>{program.data.titre}</td>
            <td style={styles.td}>{program.data.themes?.join(', ')}</td>
          </tr>
          <tr>
            <td style={styles.td}>shallow {'{...data}'}</td>
            <td style={styles.td}>{shallow.titre}</td>
            <td style={styles.td}>{shallow.themes?.join(', ')}</td>
          </tr>
          <tr>
            <td style={styles.td}>deep toMutable()</td>
            <td style={styles.td}>{deep.titre}</td>
            <td style={styles.td}>{deep.themes?.join(', ')}</td>
          </tr>
        </tbody>
      </table>
      <p style={styles.note}>
        La copie <strong>shallow</strong> change son <code>titre</code> (objet racine distinct) mais ne peut
        pas muter <code>themes</code> (même tableau gelé). La copie <strong>deep</strong> est totalement
        indépendante. Dans les deux cas, l’original reste intact.
      </p>

      <h2 style={styles.heading}>Données validées (CanonicalProgram.toJSON)</h2>
      <pre style={styles.json}>{JSON.stringify(program.toJSON(), null, 2)}</pre>
    </section>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 720, margin: '3rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif' },
  card: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    background: '#fff',
  },
  badgeRow: { display: 'flex', gap: 8, marginBottom: 8 },
  badge: { fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: '#eef2ff', color: '#3730a3' },
  badgeOk: { fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: '#dcfce7', color: '#166534' },
  badgeFrozen: { fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: '#fef9c3', color: '#854d0e' },
  title: { margin: '0.25rem 0 0', fontSize: 24 },
  subtitle: { margin: '0.25rem 0 0', color: '#475569' },
  heading: { marginTop: '2rem', fontSize: 14, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5 },
  outcomes: { listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 },
  ok: { color: '#166534' },
  bad: { color: '#b91c1c' },
  table: { borderCollapse: 'collapse', width: '100%', marginTop: '1rem', fontSize: 14 },
  th: { textAlign: 'left', borderBottom: '2px solid #e2e8f0', padding: '6px 8px', color: '#64748b' },
  td: { borderBottom: '1px solid #f1f5f9', padding: '6px 8px' },
  note: { fontSize: 13, color: '#475569', marginTop: '0.75rem' },
  json: { background: '#0f172a', color: '#e2e8f0', padding: '1rem', borderRadius: 8, overflowX: 'auto', fontSize: 13, lineHeight: 1.5 },
}
