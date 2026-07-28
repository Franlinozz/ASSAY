import type { Brief, Claim, Profile } from './types'
import { PRODUCT, TOOL_PRICES } from './constants'

// The FACTS BLOCK (gotcha #14): the authoritative context injected into every writer prompt.
// It lists candidate facts, only CONFIRMED claims (with their IDs and tiers), the brief, and
// real product constants — plus the hard rule that none of it may be invented or placeholdered.

export interface FactsConstants {
  agentId?: string
  baseUrl?: string
  prices?: Record<string, number>
  productName?: string
}

export interface FactsInput {
  profile: Profile
  brief?: Brief
  claims?: Claim[]
  constants?: FactsConstants
}

export function buildFactsBlock(input: FactsInput): string {
  const { profile, brief, claims = [], constants = {} } = input
  const confirmed = claims.filter((c) => c.status === 'confirmed')
  const lines: string[] = []

  lines.push('=== FACTS BLOCK (authoritative — never invent, placeholder, or embellish these) ===')

  lines.push('CANDIDATE')
  lines.push(`  Name: ${profile.fullName}`)
  if (profile.headline) lines.push(`  Headline: ${profile.headline}`)
  const contactBits: string[] = []
  if (profile.contact.email) contactBits.push(`email ${profile.contact.email}`)
  if (profile.contact.phone) contactBits.push(`phone ${profile.contact.phone}`)
  if (profile.contact.links.length) contactBits.push(`links ${profile.contact.links.join(', ')}`)
  if (contactBits.length) lines.push(`  Contact: ${contactBits.join(' | ')}`)
  lines.push(`  Timezone: ${profile.timezone}`)

  if (profile.experiences.length) {
    lines.push('EXPERIENCE')
    for (const e of profile.experiences) {
      const end = e.endYm ?? 'present'
      const loc = e.location ? ` [${e.location}]` : ''
      lines.push(`  - ${e.org} — ${e.title} (${e.startYm} → ${end})${loc}`)
    }
  }

  if (profile.skills.length) lines.push(`SKILLS: ${profile.skills.join(', ')}`)

  lines.push('CONFIRMED CLAIMS (cite only these claim IDs; each carries an evidence tier)')
  if (confirmed.length === 0) {
    lines.push('  (none yet — do not write claims; return questions instead)')
  } else {
    for (const c of confirmed) {
      const figures = c.numericFacts.map((f) => `${f.value}${f.unit ?? ''}`).join(', ')
      const figureStr = figures ? ` (figures: ${figures})` : ''
      lines.push(`  - [${c.id} | ${c.strength}] ${c.text}${figureStr}`)
    }
  }

  if (brief && brief.decomposed.length) {
    lines.push('BRIEF REQUIREMENTS')
    for (const r of brief.decomposed) {
      const kw = r.keywords.length ? ` — keywords: ${r.keywords.join(', ')}` : ''
      lines.push(`  - [${r.kind}] ${r.text}${kw}`)
    }
  }

  lines.push('PRODUCT')
  lines.push(`  Name: ${constants.productName ?? PRODUCT.name}`)
  if (constants.agentId) lines.push(`  Agent ID: ${constants.agentId}`)
  lines.push(`  Base URL: ${constants.baseUrl ?? PRODUCT.baseUrl}`)
  const prices = constants.prices ?? TOOL_PRICES
  const priceStr = Object.entries(prices)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')
  lines.push(`  Prices (USDT): ${priceStr}`)

  lines.push('RULES')
  lines.push('  - Every sentence you write must cite at least one confirmed claim ID above.')
  lines.push("  - Never state a number that is not listed in a claim's figures.")
  lines.push('  - Never invent employers, titles, dates, credentials, links, or metrics.')
  lines.push(
    '  - If something cannot be supported by a claim above, return a question — never prose.',
  )

  lines.push('=== END FACTS BLOCK ===')
  return lines.join('\n')
}
