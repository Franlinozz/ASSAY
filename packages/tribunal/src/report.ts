import type { CheckFinding, CheckStatus } from './hard/types'

export interface HardCheckReport {
  id: string
  title: string
  status: CheckStatus
  findings: CheckFinding[]
  evidence?: string
}

export interface CraftReport {
  axis: string
  score: number
}

export interface TribunalReport {
  artifactId: string
  artifactKind: string
  draftIndex: number
  hard: HardCheckReport[]
  craft: CraftReport[]
  craftWeightedMean: number
  gradeStatus: 'graded' | 'ungraded' | 'not_delivered'
  pass: boolean
  hardPass: boolean
  craftPass: boolean
  repairBrief?: string
  standardVersion: string
  createdAt: string
}

export interface TribunalSummary {
  reports: number
  artifacts: number
  gradedArtifacts: number
  ungraded: number
  notDelivered: number
  firstDraftPassed: number
  finalPassed: number
  postRepairPassRate: number
  byArtifact: Array<{
    artifactId: string
    drafts: number
    finalPass: boolean
    gradeStatus: TribunalReport['gradeStatus']
  }>
}

// Honest rollup: the FINAL draft per artifact decides pass; we also report how many passed on the
// first try, so the post-repair pass rate is never inflated.
export function summarize(reports: TribunalReport[]): TribunalSummary {
  const byId = new Map<string, TribunalReport[]>()
  for (const r of reports) {
    const list = byId.get(r.artifactId) ?? []
    list.push(r)
    byId.set(r.artifactId, list)
  }
  const byArtifact: TribunalSummary['byArtifact'] = []
  let firstDraftPassed = 0
  let finalPassed = 0
  let gradedArtifacts = 0
  let ungraded = 0
  let notDelivered = 0
  for (const [artifactId, list] of byId) {
    const ordered = [...list].sort((a, b) => a.draftIndex - b.draftIndex)
    const first = ordered[0]!
    const final = ordered[ordered.length - 1]!
    if (final.gradeStatus === 'graded') {
      gradedArtifacts += 1
      if (first.pass) firstDraftPassed += 1
      if (final.pass) finalPassed += 1
    } else if (final.gradeStatus === 'ungraded') {
      ungraded += 1
    } else {
      notDelivered += 1
    }
    byArtifact.push({
      artifactId,
      drafts: ordered.length,
      finalPass: final.pass,
      gradeStatus: final.gradeStatus,
    })
  }
  const artifacts = byId.size
  return {
    reports: reports.length,
    artifacts,
    gradedArtifacts,
    ungraded,
    notDelivered,
    firstDraftPassed,
    finalPassed,
    postRepairPassRate:
      gradedArtifacts === 0 ? 0 : Math.round((finalPassed / gradedArtifacts) * 100),
    byArtifact,
  }
}
