import { z } from 'zod'

/**
 * Output guard for `DetailDispositif` (proposition 1, R2DA). Strategy: map what
 * the canonical has, omit the rest. `.strict()` everywhere so a parasitic key
 * (e.g. an empty `{}` or a leaked internal field) fails the guard instead of
 * silently shipping. Only the subset we actually emit is modeled here.
 */

const dateDispositifSchema = z
  .object({
    dateDebut: z.string().optional(),
    dateFin: z.string().optional(),
  })
  .strict()

const secteurActiviteSchema = z
  .object({
    listeSecteurActivite: z.array(z.string()).min(1),
  })
  .strict()

const secteurGeographiqueSchema = z
  .object({
    typeSecteur: z.string().optional(),
    listeRegion: z.array(z.string()).min(1),
  })
  .strict()

const elligibiliteSchema = z
  .object({
    texteElligibilite: z.string().optional(),
    secteurActivite: secteurActiviteSchema.optional(),
    secteurGeographique: secteurGeographiqueSchema.optional(),
  })
  .strict()

const vignetteSchema = z
  .object({
    urlImage: z.string(),
    alt: z.string().optional(),
  })
  .strict()

const documentationSchema = z
  .object({
    vignette: vignetteSchema.optional(),
  })
  .strict()

const descriptionSchema = z
  .object({
    organisme: z.string().optional(),
    descriptionCourte: z.string().optional(),
    descriptionLongue: z.string().optional(),
    partenaires: z.array(z.string()).min(1).optional(),
    montantAide: z.string().optional(),
    thematique: z.array(z.string()).min(1).optional(),
    mailContact: z.string().optional(),
  })
  .strict()

const etapeDepotSchema = z
  .object({
    ordreEtape: z.number().int().positive(),
    libelleEtape: z.string(),
    lienEtape: z.string().optional(),
  })
  .strict()

export const agirDetailSchema = z
  .object({
    idDispositif: z.string(),
    idFonctionnel: z.string(),
    titre: z.string(),
    source: z.string(),
    dateDispositif: dateDispositifSchema,
    dateDerniereModification: z.string().optional(),
    etatDispositif: z.string(),
    typeDispositif: z.string().optional(),
    elligibilite: elligibiliteSchema.optional(),
    documentation: documentationSchema.optional(),
    description: descriptionSchema.optional(),
    etapeDepot: z.array(etapeDepotSchema).min(1).optional(),
  })
  .strict()
