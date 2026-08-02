import { describe, expect, it } from 'vitest'
import { ArtifactSchema, DossierSchema } from '@xyndicate/assay-core'
import { STAR_COMPLETENESS, starParts, storyUnits } from './hard/checks'

// A live 0.20 purchase (receipt ord_bunrp2tqq6ar) returned eight sentences forming four complete
// interview stories, and the grader answered with eight STAR_INCOMPLETE findings and a failing
// grade. The stories were fine. The grader was counting sentences instead of stories, and its
// verb list had no word for "managed", "moved" or "pre-qualified".

const PAIRS: Array<[string, string, string]> = [
  [
    'CLM-S18R86',
    'When a cholera outbreak hit Kasaï-Central in 2022 and the road network became impassable for six weeks of the deployment, the goal was to keep medical and WASH supplies moving to treatment centres despite the disruption.',
    'I managed the emergency logistics response and moved 240 tonnes of supplies through the broken network, reaching all 14 treatment centres that needed them.',
  ],
  [
    'CLM-WS7KQ9',
    'When the supply corridor to Kananga was closed off by three armed groups and two provincial authorities, the task was to reopen it without paying fees or using armed escort, in line with organisational policy.',
    'I negotiated directly with all three armed groups and both provincial authorities and secured passage for the corridor on those terms.',
  ],
  [
    'CLM-V0GQSC',
    'When average procurement lead time for medical consumables across the DRC country programme stood at 94 days due to single-source international ordering, the goal was to shorten that cycle significantly.',
    'I pre-qualified regional suppliers and moved the programme away from single-source international ordering, cutting average lead time from 94 days to 38 days.',
  ],
]

const dossier = DossierSchema.parse({
  profile: { fullName: 'Test', timezone: 'UTC', contact: { email: 'a@b.co', links: [] } },
  tz: 'UTC',
  evidence: [],
  claims: [],
})

const artifactOf = (sentences: Array<{ text: string; claimIds: string[] }>) =>
  ArtifactSchema.parse({ id: 'story_bank', kind: 'story_bank', sentences })

describe('a story is a unit of meaning, not of punctuation', () => {
  it('joins consecutive sentences that cite the same claim', () => {
    const units = storyUnits([
      { text: 'When the corridor closed, the task was to reopen it.', claimIds: ['CLM-A'] },
      { text: 'I negotiated and secured passage.', claimIds: ['CLM-A'] },
      { text: 'I built a linter adopted by 9 teams.', claimIds: ['CLM-B'] },
    ])
    expect(units).toHaveLength(2)
    expect(units[0]!.text).toContain('secured passage')
  })

  it('never merges uncited sentences on the accident of adjacency', () => {
    expect(
      storyUnits([
        { text: 'One.', claimIds: [] },
        { text: 'Two.', claimIds: [] },
      ]),
    ).toHaveLength(2)
  })

  it('passes the four real stories that were graded as eight failures', async () => {
    const sentences = PAIRS.flatMap(([id, a, b]) => [
      { text: a, claimIds: [id] },
      { text: b, claimIds: [id] },
    ])
    const r = await STAR_COMPLETENESS.run({ dossier, artifact: artifactOf(sentences), deps: {} })
    expect(r.findings).toEqual([])
    expect(r.status).toBe('pass')
  })
})

describe('the STAR check still refuses an incomplete story', () => {
  it('flags a story that sets a scene and never acts', () => {
    const p = starParts(
      'When deploys across 14 legacy services took 45 minutes, the team needed a faster and more reliable path to production.',
    )
    // The subject-plus-past-verb rule must not read "services took" as the candidate acting.
    expect(p.action).toBe(false)
  })

  it('flags an achievement with no scene behind it', () => {
    const p = starParts('I built an automated config linter.')
    expect(p.situation).toBe(false)
    expect(p.task).toBe(false)
  })

  it('flags an aspiration, which is not a past action', () => {
    expect(starParts('I want to lead a platform team and improve deployment speed.').action).toBe(
      false,
    )
  })

  it('still fails a story bank whose entries are only scene-setting', async () => {
    const r = await STAR_COMPLETENESS.run({
      dossier,
      artifact: artifactOf([
        { text: 'The configuration practices were inconsistent across teams.', claimIds: ['C1'] },
      ]),
      deps: {},
    })
    expect(r.status).toBe('fail')
  })
})

describe('action and result are recognised by shape, not by a word list', () => {
  it('accepts verbs no curated list contained', () => {
    for (const verb of ['managed', 'moved', 'pre-qualified', 'staffed', 'chaired', 'triaged'])
      expect(
        starParts(`When it went wrong, the goal was to fix it, so I ${verb} the response.`).action,
      ).toBe(true)
  })

  it('accepts a result stated in words rather than digits', () => {
    expect(starParts('and secured passage for the corridor on those terms').result).toBe(true)
    expect(starParts('finishing the audit, with no product implicated and no recall').result).toBe(
      true,
    )
  })
})

describe('an outcome stated as a second clause is still an outcome', () => {
  it('accepts "negotiated … and reopened the corridor"', () => {
    expect(
      starParts(
        'I negotiated humanitarian access directly with all three armed groups and both provincial authorities, and reopened the Kananga corridor without paying fees or using armed escort.',
      ).result,
    ).toBe(true)
  })

  it('does not invent an outcome for a single bare action', () => {
    expect(starParts('I built an automated config linter.').result).toBe(false)
    expect(starParts('I chaired the weekly review.').result).toBe(false)
  })
})
