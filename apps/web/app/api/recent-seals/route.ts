import { NextResponse } from 'next/server'
import { ASY_API } from '../../../lib/site'

export const dynamic = 'force-dynamic'

// Proxies the MCP server's anonymized recent-seals strip (no PII leaves the API: truncated ids,
// seal status, standard version, coarse day only). Degrades to an empty strip, never an error.
export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(`${ASY_API}/d-api`, { next: { revalidate: 60 } })
    if (!res.ok) return NextResponse.json({ recent: [] })
    const body = (await res.json()) as { recent?: unknown[] }
    return NextResponse.json({ recent: Array.isArray(body.recent) ? body.recent : [] })
  } catch {
    return NextResponse.json({ recent: [] })
  }
}
