import { readFileSync, writeFileSync } from 'node:fs'
import { DossierSchema, ArtifactSchema } from '@xyndicate/assay-core'
import { renderArtifactHtml, sampleRenderedContrast } from '@xyndicate/renderers'
import { STAR_COMPLETENESS, PORTFOLIO_CONTRAST } from '@xyndicate/tribunal'

const file = process.argv[2]
if (!file) throw new Error('personas json path required')
const doc = JSON.parse(readFileSync(file, 'utf8')) as {
  meta: Record<string, unknown>
  personas: Array<Record<string, any>>
}

for (const persona of doc.personas) {
  const claimText = persona.claims.map((claim: { text: string }) => claim.text).join('\n')
  const dossier = DossierSchema.parse({
    id: persona.dossierId,
    version: 1,
    createdAt: doc.meta['generatedAt'],
    tz: 'UTC',
    profile: {
      fullName: persona.profile.fullName,
      headline: persona.profile.headline,
      timezone: 'UTC',
      contact: { email: persona.profile.email, links: [] },
      experiences: persona.profile.experiences,
      skills: persona.profile.skills,
    },
    evidence: persona.evidence.map((item: Record<string, unknown>) => ({
      ...item,
      contentText: claimText,
    })),
    claims: persona.claims,
  })
  const story = ArtifactSchema.parse({
    id: 'story_bank',
    kind: 'story_bank',
    sentences: persona.sentences.story_bank ?? [],
  })
  const star = await STAR_COMPLETENESS.run({ dossier, artifact: story, deps: {} })
  const portfolioHtml = renderArtifactHtml('portfolio_page', {
    dossier,
    sentences: persona.sentences.portfolio_page ?? persona.sentences.resume_ats ?? [],
    theme: 'light',
  })
  const ratio = await sampleRenderedContrast(portfolioHtml)
  const portfolio = ArtifactSchema.parse({
    id: 'portfolio_page',
    kind: 'portfolio_page',
    meta: { renderedContrastRatio: ratio },
  })
  const portfolioResult = await PORTFOLIO_CONTRAST.run({
    dossier,
    artifact: portfolio,
    deps: {},
  })

  const latest = new Map<string, { pass: boolean }>()
  for (const report of persona.tribunal.reports) latest.set(report.artifactId, report)
  latest.set('story_bank', { pass: star.status !== 'fail' })
  latest.set('portfolio_page', { pass: portfolioResult.status !== 'fail' })
  persona.as11Regrade = {
    standardVersion: 'AS-1.1.0',
    regradedAt: new Date().toISOString(),
    rollup: {
      finalPassed: [...latest.values()].filter((report) => report.pass).length,
      artifacts: latest.size,
    },
    profiles: {
      textArtifactsDropPdfClauses: true,
      storyBank: {
        status: star.status,
        findings: star.findings,
      },
      portfolioPage: {
        status: portfolioResult.status,
        renderedContrastRatio: ratio,
        findings: portfolioResult.findings,
      },
    },
    note: 'Honest re-grade of the sealed AS-1.0.0 artifact set. The original seal and original reports remain unchanged.',
  }
}

doc.meta['regradedStandardVersion'] = 'AS-1.1.0'
writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`)
console.log(
  doc.personas
    .map(
      (persona) =>
        `${persona.slug}: ${persona.as11Regrade.rollup.finalPassed}/${persona.as11Regrade.rollup.artifacts}, contrast ${persona.as11Regrade.profiles.portfolioPage.renderedContrastRatio}:1`,
    )
    .join('\n'),
)
