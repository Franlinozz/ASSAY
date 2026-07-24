// @xyndicate/providers — every touchpoint with the outside world, always degradable, fake-first.
export * from './types'
export * from './gaps'
export * from './governor'
export * from './prompts'
export * from './router'
export * from './fetcher'
export * from './ingest'
export * from './text'
export * from './extract'
export * from './decompose'
export * from './coverage'
export { FakeAdapter, FakeFetcher, createFakeAdapters, SAMPLE_RESUME_TEXT, resetFakeRepairDemo } from './fake/index'
export { PERSONAS, personaBySlug, fakePersonaExtractionFor } from './fake/personas'
export type { PersonaFixture, PersonaLink, PersonaExtraction } from './fake/personas'
export { createLiveAdapters } from './live/index'

import type { RouterOptions } from './router'
import { ModelRouter } from './router'
import { Governor, governorFromEnv } from './governor'
import { createFakeAdapters, FakeFetcher } from './fake/index'
import { createLiveAdapters } from './live/index'
import { createFetcher, type Fetcher } from './fetcher'

export type ProviderMode = 'fake' | 'live'

export function providerMode(): ProviderMode {
  return process.env['ASY_PROVIDER_MODE'] === 'live' ? 'live' : 'fake'
}

// FAKES ARE THE DEFAULT. In live mode only providers with a key present are wired; if none are,
// the router degrades every call honestly rather than silently falling back to fakes.
export function createRouter(opts: RouterOptions = {}): ModelRouter {
  const adapters = providerMode() === 'live' ? createLiveAdapters() : createFakeAdapters()
  const governor: Governor = opts.governor ?? governorFromEnv()
  return new ModelRouter(adapters, { ...opts, governor })
}

export function createModeFetcher(): Fetcher {
  return providerMode() === 'live' ? createFetcher() : new FakeFetcher()
}
