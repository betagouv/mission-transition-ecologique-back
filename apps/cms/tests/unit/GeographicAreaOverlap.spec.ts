import { describe, it, expect } from 'vitest'
import { GeographicAreaOverlap } from '@/services/geography/GeographicAreaOverlap'

const paca = { id: 1, name: "Provence-Alpes-Côte d'Azur", parentArea: null }
const occitanie = { id: 2, name: 'Occitanie' }
const bouchesDuRhone = { id: 10, name: 'Bouches-du-Rhône', parentArea: 1 }

describe('GeographicAreaOverlap', () => {
  it('finds a department selected together with its region', () => {
    const covered = GeographicAreaOverlap.find([paca, bouchesDuRhone])
    expect(covered).toEqual([{ area: bouchesDuRhone, coveredBy: paca }])
    expect(GeographicAreaOverlap.describe(covered[0])).toBe(
      "Bouches-du-Rhône est déjà couvert par Provence-Alpes-Côte d'Azur",
    )
  })

  it('accepts a department outside the selected regions', () => {
    expect(GeographicAreaOverlap.find([occitanie, bouchesDuRhone])).toEqual([])
  })

  it('reads a populated parent area and ids of mixed types', () => {
    const populated = { id: '10', name: 'Bouches-du-Rhône', parentArea: { id: 1 } }
    expect(GeographicAreaOverlap.find([populated, paca])).toHaveLength(1)
  })
})
