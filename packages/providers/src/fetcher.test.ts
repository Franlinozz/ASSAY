import { describe, it, expect, vi } from 'vitest'
import { createFetcher, isBlockedIp, type FetcherDeps, type TransportResponse } from './fetcher'

const HTML = '<html><head><title>Hello</title></head><body><p>world</p></body></html>'

function makeDeps(over: Partial<FetcherDeps> = {}): FetcherDeps {
  return {
    transport: vi.fn(async (): Promise<TransportResponse> => ({
      status: 200,
      contentType: 'text/html',
      body: HTML,
    })),
    lookup: vi.fn(async () => ['93.184.216.34']),
    now: () => 0,
    ...over,
  }
}

describe('fetcher SSRF guards', () => {
  it('blocks the cloud-metadata IP literal without any transport call', async () => {
    const deps = makeDeps()
    const r = await createFetcher(deps).fetch('http://169.254.169.254/latest/meta-data/')
    expect(r.ok).toBe(false)
    expect(r.gap).toBe('FETCH_BLOCKED')
    expect(deps.transport).not.toHaveBeenCalled()
  })

  it('blocks loopback, private and CGNAT literals', async () => {
    const f = createFetcher(makeDeps())
    for (const url of [
      'http://127.0.0.1/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://172.16.0.1/',
      'http://100.100.0.1/',
    ]) {
      expect((await f.fetch(url)).gap).toBe('FETCH_BLOCKED')
    }
  })

  it('blocks non-http(s) schemes (file://, ftp://)', async () => {
    const deps = makeDeps()
    const f = createFetcher(deps)
    expect((await f.fetch('file:///etc/passwd')).gap).toBe('FETCH_BLOCKED')
    expect((await f.fetch('ftp://example.com/x')).gap).toBe('FETCH_BLOCKED')
    expect(deps.transport).not.toHaveBeenCalled()
  })

  it('blocks a hostname that resolves to a private IP (DNS rebinding)', async () => {
    const deps = makeDeps({ lookup: vi.fn(async () => ['127.0.0.1']) })
    const r = await createFetcher(deps).fetch('https://rebind.example/')
    expect(r.gap).toBe('FETCH_BLOCKED')
    expect(deps.transport).not.toHaveBeenCalled()
  })

  it('allows a public https URL and extracts title + excerpt', async () => {
    const deps = makeDeps()
    const r = await createFetcher(deps).fetch('https://good.example/page')
    expect(r.ok).toBe(true)
    expect(r.status).toBe(200)
    expect(r.title).toBe('Hello')
    expect(r.textExcerpt).toContain('world')
    expect(deps.lookup).toHaveBeenCalledWith('good.example')
  })

  it('caches within the TTL (second call does not re-transport)', async () => {
    const deps = makeDeps()
    const f = createFetcher(deps)
    await f.fetch('https://good.example/page')
    await f.fetch('https://good.example/page')
    expect(deps.transport).toHaveBeenCalledTimes(1)
  })

  it('isBlockedIp classifies ranges correctly', () => {
    expect(isBlockedIp('93.184.216.34')).toBe(false)
    expect(isBlockedIp('169.254.169.254')).toBe(true)
    expect(isBlockedIp('10.1.2.3')).toBe(true)
    expect(isBlockedIp('::1')).toBe(true)
    expect(isBlockedIp('fd00::1')).toBe(true)
    expect(isBlockedIp('2606:2800:220:1:248:1893:25c8:1946')).toBe(false)
  })
})
