import type { ComponentType } from 'react'
import { notFound } from 'next/navigation'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from 'fumadocs-ui/page'
import type { TOCItemType } from 'fumadocs-core/server'
import { source } from '@/lib/source'

// The files-shape shim in lib/source.ts loses fumadocs-mdx's inferred page types — restate the
// compiled-MDX page data shape explicitly (title/description from frontmatter, body/toc compiled).
interface DocData {
  title: string
  description?: string
  full?: boolean
  toc: TOCItemType[]
  body: ComponentType<{ components?: Record<string, unknown> }>
}

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()
  const data = page.data as unknown as DocData
  const MDX = data.body
  return (
    <DocsPage toc={data.toc} full={data.full ?? false}>
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description ?? ''}</DocsDescription>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()
  const data = page.data as unknown as DocData
  return { title: data.title, description: data.description ?? '' }
}
