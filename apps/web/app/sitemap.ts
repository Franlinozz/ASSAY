import type { MetadataRoute } from 'next'
import { SITE } from '../lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    '',
    '/standard',
    '/evaluation',
    '/pricing',
    '/agents',
    '/verify',
    '/gallery',
    '/studio',
  ].map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }))
}
