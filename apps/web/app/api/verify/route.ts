import { NextRequest, NextResponse } from 'next/server'
import { ASY_API } from '../../../lib/site'

export const dynamic = 'force-dynamic'

interface VerifyData {
  ok: boolean
  found: boolean
  leaf?: string
  sealStatus?: string
  anchoredAt?: string | null
  chainId?: number
  registry?: string
  explorerLink?: string
  gap?: string
}

// The /verify page's live on-chain check — calls the FREE asy_verify tool over MCP JSON-RPC
// (the exact call an agent would make; the page and the endpoint share one code path).
export async function POST(req: NextRequest): Promise<NextResponse> {
  let input: { dossierId?: string; leaf?: string }
  try {
    input = (await req.json()) as { dossierId?: string; leaf?: string }
  } catch {
    return NextResponse.json({ error: 'malformed request' }, { status: 400 })
  }
  const dossierId = typeof input.dossierId === 'string' ? input.dossierId.trim() : ''
  const leaf = typeof input.leaf === 'string' ? input.leaf.trim() : ''
  if (!dossierId && !leaf)
    return NextResponse.json({ error: 'provide a dossierId or a leaf' }, { status: 400 })

  try {
    const res = await fetch(`${ASY_API}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'asy_verify',
          arguments: { ...(dossierId ? { dossierId } : {}), ...(leaf ? { leaf } : {}) },
        },
      }),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`mcp ${res.status}`)
    const rpc = (await res.json()) as {
      result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean }
    }
    const text = rpc.result?.content?.find((c) => c.type === 'text')?.text ?? ''
    const split = text.indexOf('\n\n')
    const summary = split > 0 ? text.slice(0, split) : text
    let data: VerifyData | null = null
    if (split > 0) {
      try {
        data = JSON.parse(text.slice(split + 2)) as VerifyData
      } catch {
        data = null
      }
    }
    if (!data)
      return NextResponse.json({ error: 'verification unavailable right now' }, { status: 502 })
    return NextResponse.json({ summary, ...data, refused: rpc.result?.isError === true })
  } catch {
    // Sanitized gap only (guardrail #9).
    return NextResponse.json(
      { error: 'chain:rpc — verification unavailable right now' },
      { status: 502 },
    )
  }
}
