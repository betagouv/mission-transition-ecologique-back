import { AdemePivotExporter } from './AdemePivotExporter'
import { fullProgram, indisponibleProgram, minimalProgram } from '../__fixtures__/canonical-programs'

describe('AdemePivotExporter', () => {
  const exporter = new AdemePivotExporter()

  describe('programme complet', () => {
    const out = exporter.export(fullProgram)

    it('remplace id par le slug (jamais le cuid2)', () => {
      expect(out.id).toBe('diagnostic-energie-pme')
    })

    it('remonte ademe_id_dsp et n’émet pas le reste de autres_donnees', () => {
      expect(out.ademe_id_dsp).toBe('DSP-000123')
      expect(out).not.toHaveProperty('autres_donnees')
      expect(JSON.stringify(out)).not.toContain('operateur_ref_interne')
    })

    it('mappe source et statut, supprime statut_edition/statut_dispositif', () => {
      expect(out.source).toBe('ademe')
      expect(out.statut).toBe('actif')
      expect(out).not.toHaveProperty('statut_edition')
      expect(out).not.toHaveProperty('statut_dispositif')
      expect(out).not.toHaveProperty('remplace_par')
    })

    it('garde montant/durée en objet { type, valeur }', () => {
      expect(out.montant).toEqual({ type: 'montant du financement', valeur: 'Jusqu’à 70 % des dépenses' })
      expect(out.duree).toEqual({ type: 'durée de l’accompagnement', valeur: '8 jours de formation' })
    })

    it('garde contact_question typé et themes français', () => {
      expect(out.contact_question).toEqual({ type: 'email', valeur: 'contact@ademe.fr' })
      expect(out.themes).toEqual(['energie', 'batiment'])
    })

    it('garde éligibilité, variantes, opérateurs et étapes (forme canonical)', () => {
      expect(out.eligibilite?.secteur_activite?.structure?.inclusions).toEqual(['C'])
      expect(out.variantes).toHaveLength(1)
      expect(out.operateurs.contact.nom).toBe('Bpifrance')
      expect(out.etapes_activation).toHaveLength(1)
    })

    it('n’expose aucun champ hors liste blanche', () => {
      const allowed = new Set([
        'id',
        'ademe_id_dsp',
        'source',
        'date_mise_a_jour',
        'titre',
        'promesse',
        'description',
        'description_longue',
        'illustration',
        'meta',
        'statut',
        'date_ouverture',
        'date_cloture',
        'types_aides',
        'montant',
        'duree',
        'operateurs',
        'contact_question',
        'url_source',
        'etapes_activation',
        'eligibilite',
        'themes',
        'variantes',
      ])
      expect(Object.keys(out).every((key) => allowed.has(key))).toBe(true)
    })
  })

  describe('programme minimal', () => {
    const out = exporter.export(minimalProgram)

    it('omet ademe_id_dsp absent et les champs optionnels', () => {
      expect(out).not.toHaveProperty('ademe_id_dsp')
      expect(out).not.toHaveProperty('montant')
      expect(out).not.toHaveProperty('eligibilite')
      expect(out.id).toBe('aide-decarbonation-industrie')
      expect(out.source).toBe('tee')
    })
  })

  it('mappe temporairement_indisponible → indisponible', () => {
    expect(exporter.export(indisponibleProgram).statut).toBe('indisponible')
  })
})
