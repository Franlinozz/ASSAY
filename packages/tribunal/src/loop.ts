import type { Artifact, Dossier } from '@xyndicate/assay-core'
import { nowIso } from '@xyndicate/assay-core'
import type { ModelRouter } from '@xyndicate/providers'
import { HARD_CHECKS } from './hard/index'
import type { CheckDeps } from './hard/types'
import { CRAFT_AXES, REPAIR_LIMIT, STANDARD_VERSION, passRule } from './standard'
import { gradeCraft, type CraftGrade } from './critic'
import type { HardCheckReport, TribunalReport } from './report'

export interface GradeDeps extends CheckDeps {
  router: ModelRouter
}

function buildRepairBrief(hard: HardCheckReport[], craft: CraftGrade): string {
  const parts: string[] = []
  for (const h of hard) {
    if (h.status === 'fail') {
      parts.push(`[${h.id}] ${h.findings.map((f) => f.detail).join('; ')}`)
    }
  }
  for (const f of craft.findings) parts.push(`[craft:${f.axis}] ${f.detail}`)
  if (craft.repairBrief) parts.push(craft.repairBrief)
  return parts.join('\n')
}

// Grade one artifact: all hard checks + the craft critic → a full TribunalReport.
export async function gradeArtifact(
  dossier: Dossier,
  artifact: Artifact,
  deps: GradeDeps,
  draftIndex = 0,
): Promise<TribunalReport> {
  const hard: HardCheckReport[] = []
  for (const check of HARD_CHECKS) {
    const r = await check.run({ dossier, artifact, deps })
    const hr: HardCheckReport = { id: check.id, title: check.title, status: r.status, findings: r.findings }
    if (r.evidence !== undefined) hr.evidence = r.evidence
    hard.push(hr)
  }

  // Craft applies only to prose-bearing artifacts; structured ones (docx, json, tables) are
  // decided by the hard checks alone — and we skip the critic call entirely (cost law).
  const proseBearing = (artifact.sentences?.length ?? 0) > 0
  const craft = proseBearing
    ? await gradeCraft(artifact, dossier, deps.router)
    : { axes: {}, findings: [], repairBrief: '', degraded: false }
  const verdict = passRule(hard, craft.axes, { craftApplicable: proseBearing })

  const report: TribunalReport = {
    artifactId: artifact.id,
    artifactKind: artifact.kind,
    draftIndex,
    hard,
    craft: proseBearing ? CRAFT_AXES.map((a) => ({ axis: a.id, score: craft.axes[a.id] ?? 0 })) : [],
    craftWeightedMean: verdict.weightedMean,
    pass: verdict.pass,
    hardPass: verdict.hardPass,
    craftPass: verdict.craftPass,
    standardVersion: STANDARD_VERSION,
    createdAt: nowIso(),
  }
  if (!verdict.pass) report.repairBrief = buildRepairBrief(hard, craft)
  return report
}

export type RepairFn = (artifact: Artifact, repairBrief: string) => Promise<Artifact>

// Grade → repair → regrade, at most REPAIR_LIMIT (2) repairs. EVERY draft's report is returned
// and ships in the dossier — including failing first drafts.
export async function gradeWithRepair(
  dossier: Dossier,
  artifact: Artifact,
  deps: GradeDeps,
  repair: RepairFn,
): Promise<{ reports: TribunalReport[]; artifact: Artifact }> {
  const reports: TribunalReport[] = []
  let current = artifact
  for (let draft = 0; draft <= REPAIR_LIMIT; draft++) {
    const report = await gradeArtifact(dossier, current, deps, draft)
    reports.push(report)
    if (report.pass || draft === REPAIR_LIMIT) break
    current = await repair(current, report.repairBrief ?? '')
  }
  return { reports, artifact: current }
}
