export interface SourceProject {
  id: number
  slug: string
  title: string
  nameTag: string
  shortDescription: string
  image?: string
  titleLongDescription?: string
  longDescription: string
  titleMoreDescription?: string
  moreDescription?: string
  themes: string[]
  mainTheme: string
  programs?: string[]
  titleLinkedProjects?: string
  descriptionLinkedProjects?: string
  linkedProjects?: number[]
  highlightPriority?: string
  sectors?: string[]
  metaTitle?: string
  metaDescription?: string
  // Ignored: priority (object), titleFaq, faqs
}
