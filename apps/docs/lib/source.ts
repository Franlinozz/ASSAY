import { docs } from '@/.source/server'
import { loader } from 'fumadocs-core/source'

// Normalize the generated collection shape at the source boundary.
const raw = docs.toFumadocsSource() as { files: unknown }
const files = (
  typeof raw.files === 'function' ? (raw.files as () => unknown[])() : raw.files
) as never[]

// baseUrl '/' — the app itself is mounted at /docs via Next basePath.
export const source = loader({
  baseUrl: '/',
  source: { files },
})
