import { docs } from '@/.source'
import { loader } from 'fumadocs-core/source'

// fumadocs-mdx 11.10 exposes `files` as a thunk while fumadocs-core 15.8 consumes an array —
// normalize so the pairing works regardless of which shape this minor returns.
const raw = docs.toFumadocsSource() as { files: unknown }
const files = (
  typeof raw.files === 'function' ? (raw.files as () => unknown[])() : raw.files
) as never[]

// baseUrl '/' — the app itself is mounted at /docs via Next basePath.
export const source = loader({
  baseUrl: '/',
  source: { files },
})
