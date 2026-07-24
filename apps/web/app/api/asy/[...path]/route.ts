import { NextRequest, NextResponse } from 'next/server'
import { ASY_API } from '../../../../lib/site'

export const dynamic = 'force-dynamic'
// Uploads arrive as base64 in JSON (≤8MB doc → ~11MB body); allow room.
export const maxDuration = 60

// Same-origin proxy to the Studio API on the MCP server. The browser never talks to
// api.assayed.xyz directly (no CORS surface); the capability token rides in the query string.
// Only the Studio + recruiter paths are forwarded — nothing else on the MCP server is exposed.
const ALLOW = /^(studio\/dossier|d\/[^/]+(\/.*)?|d-state\/[^/]+|s-api\/[^/]+)$/

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const rel = path.join('/')
  if (!ALLOW.test(rel)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const search = req.nextUrl.search
  const url = `${ASY_API}/${rel}${search}`
  const init: RequestInit = {
    method: req.method,
    headers: { 'content-type': req.headers.get('content-type') ?? 'application/json' },
    cache: 'no-store',
  }
  if (req.method === 'POST') init.body = await req.text()
  try {
    const res = await fetch(url, init)
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json(
      { error: 'the studio is unreachable right now — please retry' },
      { status: 502 },
    )
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path)
}
