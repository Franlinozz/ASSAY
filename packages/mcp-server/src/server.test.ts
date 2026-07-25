import { describe, it, expect } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildServer } from './server'
import { makeCtx } from './pipelines'
import { TOOL_NAMES } from './config'
import { testRuntime } from './testutil'

async function connectedClient() {
  const rig = testRuntime()
  const server = buildServer({ pipe: makeCtx(rig.store, rig.router, rig.cfg, rig.fetcher) })
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '0' })
  await Promise.all([server.connect(serverT), client.connect(clientT)])
  return { client, rig }
}

describe('MCP server', () => {
  it('exposes exactly the shipped Assay tools by name', async () => {
    const { client } = await connectedClient()
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([...TOOL_NAMES].sort())
    expect(names).toHaveLength(TOOL_NAMES.length)
  })

  it('every tool advertises a marketplace description', async () => {
    const { client } = await connectedClient()
    const { tools } = await client.listTools()
    for (const t of tools) expect((t.description ?? '').length).toBeGreaterThan(40)
  })

  it('runs a free tool (asy_job_status) end to end over MCP', async () => {
    const { client } = await connectedClient()
    const res = (await client.callTool({
      name: 'asy_job_status',
      arguments: { jobId: 'job_nope' },
    })) as { content: Array<{ text: string }> }
    expect(res.content[0]!.text).toContain('No job')
  })
})
