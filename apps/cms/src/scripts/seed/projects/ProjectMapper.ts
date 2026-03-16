import type { editorConfigFactory } from '@payloadcms/richtext-lexical'
import { convertMarkdownToLexical } from '@payloadcms/richtext-lexical'
import type { SourceProject } from './types'
import type { Project } from '../../../../payload-types'

type Theme = NonNullable<Project['mainTheme']>
type Sector = NonNullable<Project['sectors']>[number]

type EditorConfig = Awaited<ReturnType<typeof editorConfigFactory.default>>

export class ProjectMapper {
  constructor(
    private readonly editorConfig: EditorConfig,
    private readonly programIdBySlug: Map<string, number>,
  ) {}

  map(project: SourceProject) {
    if (!project.title || !project.nameTag || !project.shortDescription || !project.longDescription || !project.mainTheme) {
      process.stderr.write(
        `[ProjectMapper] Missing required field(s) for project "${project.slug ?? '(no slug)'}": title=${project.title}, nameTag=${project.nameTag}, shortDescription=${project.shortDescription}, longDescription=${String(Boolean(project.longDescription))}, mainTheme=${project.mainTheme}\n`,
      )
      return null
    }

    const longDescription = this.toRichText(project.longDescription)

    const moreDescription = project.moreDescription
      ? this.toRichText(project.moreDescription)
      : undefined

    const resolvedProgramIds = project.programs
      ?.map((slug) => {
        const id = this.programIdBySlug.get(slug)
        if (id === undefined) {
          process.stderr.write(
            `[ProjectMapper] Warning: program slug "${slug}" not found in programIdBySlug — skipping\n`,
          )
        }
        return id
      })
      .filter((id): id is number => id !== undefined)

    const programs = resolvedProgramIds !== undefined && resolvedProgramIds.length > 0
      ? resolvedProgramIds
      : undefined

    const highlightPriority =
      project.highlightPriority !== undefined ? Number(project.highlightPriority) : undefined

    return {
      slug: project.slug,
      title: project.title,
      nameTag: project.nameTag,
      shortDescription: project.shortDescription,
      image: project.image,
      titleLongDescription: project.titleLongDescription,
      longDescription,
      titleMoreDescription: project.titleMoreDescription,
      moreDescription,
      mainTheme: project.mainTheme as Theme,
      themes: project.themes as Theme[],
      sectors: project.sectors as Sector[] | undefined,
      highlightPriority,
      programs,
      titleLinkedProjects: project.titleLinkedProjects,
      descriptionLinkedProjects: project.descriptionLinkedProjects,
      metaTitle: project.metaTitle,
      metaDescription: project.metaDescription,
    }
  }

  private toRichText(markdown: string) {
    return convertMarkdownToLexical({ editorConfig: this.editorConfig, markdown })
  }
}
