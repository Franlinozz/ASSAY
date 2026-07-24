import { TIERS, type Tier } from '../lib/site'

// Evidence-strength tier chip. We never collapse tiers into a single dishonest "verified" badge —
// the chip says exactly what kind of proof stands behind a claim. Sealed alone may wear vermilion.
export function TierChip({ tier, title }: { tier: Tier; title?: string }) {
  return (
    <span className={`chip chip-${tier}`} title={title ?? TIERS[tier].explanation}>
      {TIERS[tier].label}
    </span>
  )
}
