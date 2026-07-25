import { z } from 'zod'
import { newClaimId, newDossierId, newEvidenceId } from './ids'
import { STANDARD_VERSION } from './constants'

// ── Enums (named *Enum so the inferred type names in types.ts stay clean) ──
export const EvidenceKindEnum = z.enum(['document', 'link', 'attestation'])
export const StrengthEnum = z.enum(['attested', 'documented', 'linked', 'sealed'])
export const ClaimStatusEnum = z.enum(['extracted', 'needs_confirmation', 'confirmed', 'rejected'])
export const RequirementKindEnum = z.enum(['must', 'nice'])
export const CoverageStatusEnum = z.enum(['strong', 'partial', 'missing', 'confirm'])
export const DossierVariantEnum = z.enum(['job', 'promotion', 'freelance'])
export const BriefModeEnum = z.enum(['job', 'promotion', 'freelance'])
export const ArtifactKindEnum = z.enum([
  'resume_ats',
  'resume_designed',
  'resume_docx',
  'cover_letter',
  'story_bank',
  'fit_map',
  'gap_brief',
  'portfolio_page',
  'manifest_json',
  'interview_evaluation',
  'promotion_narrative',
  'promotion_memo',
  'manager_one_pager',
  'capability_statement',
  'case_studies',
  'proposal_letter',
])

// YYYY-MM
export const Ym = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'expected YYYY-MM')
const IsoDateTime = z.string().datetime()

// ── Leaves ──
export const NumericFactSchema = z.object({
  value: z.number(),
  unit: z.string().optional(),
  context: z.string(),
})

export const EvidenceItemSchema = z.object({
  id: z.string().default(() => newEvidenceId()),
  kind: EvidenceKindEnum,
  label: z.string(),
  sourceRef: z.string(),
  contentText: z.string().optional(),
  fetchedOk: z.boolean().optional(),
  addedAt: IsoDateTime.default(() => new Date().toISOString()),
})

export const ClaimSchema = z.object({
  id: z.string().default(() => newClaimId()),
  text: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  strength: StrengthEnum.default('attested'),
  status: ClaimStatusEnum.default('extracted'),
  numericFacts: z.array(NumericFactSchema).default([]),
  tags: z.array(z.string()).default([]),
})

export const ExperienceSchema = z.object({
  org: z.string(),
  title: z.string(),
  startYm: Ym,
  endYm: Ym.nullable(),
  location: z.string().optional(),
  claimIds: z.array(z.string()).default([]),
})

export const EducationSchema = z.object({
  org: z.string(),
  credential: z.string().optional(),
  field: z.string().optional(),
  startYm: Ym.optional(),
  endYm: Ym.nullable().optional(),
})

export const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().optional(),
  issuedYm: Ym.optional(),
  expiresYm: Ym.nullable().optional(),
  credentialId: z.string().optional(),
})

export const ContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  links: z.array(z.string()).default([]),
})

export const ProfileSchema = z.object({
  fullName: z.string(),
  headline: z.string().optional(),
  contact: ContactSchema.default({}),
  timezone: z.string(),
  experiences: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  skills: z.array(z.string()).default([]),
})

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: RequirementKindEnum,
  keywords: z.array(z.string()).default([]),
})

export const BriefSchema = z.object({
  jdText: z.string(),
  decomposed: z.array(RequirementSchema).default([]),
  mode: BriefModeEnum.default('job'),
  dateFrom: Ym.optional(),
  dateTo: Ym.optional(),
  projectClaimIds: z.array(z.string()).default([]),
})

export const CoverageSchema = z.object({
  requirementId: z.string(),
  status: CoverageStatusEnum,
  claimIds: z.array(z.string()).default([]),
  note: z.string().default(''),
})

export const SentenceSchema = z.object({
  text: z.string(),
  claimIds: z.array(z.string()).default([]),
})

export const InterviewQuestionSchema = z.object({
  id: z.string(),
  kind: z.enum(['behavioral', 'gap']),
  prompt: z.string(),
  claimIds: z.array(z.string()).default([]),
  requirementId: z.string().optional(),
})

export const InterviewEvaluationSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
  claimIds: z.array(z.string()).default([]),
  star: z.object({
    situation: z.boolean(),
    task: z.boolean(),
    action: z.boolean(),
    result: z.boolean(),
  }),
  relevance: z.number().min(0).max(100),
  feedback: z.array(SentenceSchema).default([]),
  contradictions: z
    .array(
      z.object({
        answerValue: z.number(),
        ledgerValue: z.number(),
        claimId: z.string(),
        detail: z.string(),
      }),
    )
    .default([]),
  final: z.boolean().default(false),
  evaluatedAt: IsoDateTime.default(() => new Date().toISOString()),
})

export const InterviewRoomSchema = z.object({
  questions: z.array(InterviewQuestionSchema).default([]),
  evaluations: z.array(InterviewEvaluationSchema).default([]),
})

export const ArtifactSchema = z.object({
  id: z.string(),
  kind: ArtifactKindEnum,
  sentences: z.array(SentenceSchema).optional(),
  fileRef: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
})

// Provisional — filled out in the seal phase (P5). Kept minimal so Dossier typechecks now.
export const SealSchema = z.object({
  manifestHash: z.string(),
  commitment: z.string(),
  chainId: z.number(),
  salt: z.string().optional(),
  txHash: z.string().optional(),
  anchoredAt: IsoDateTime.optional(),
  signer: z.string().optional(),
  standardVersion: z.string().default(STANDARD_VERSION),
})

// Provisional — filled out in the tribunal phase (P4).
export const TribunalFindingSchema = z.object({
  code: z.string(),
  detail: z.string(),
})

export const TribunalReportSchema = z.object({
  artifactId: z.string(),
  standardVersion: z.string().default(STANDARD_VERSION),
  passed: z.boolean(),
  hardFindings: z.array(TribunalFindingSchema).default([]),
  craftScores: z.record(z.string(), z.number()).optional(),
  createdAt: IsoDateTime.default(() => new Date().toISOString()),
})

export const DossierSchema = z.object({
  id: z.string().default(() => newDossierId()),
  profile: ProfileSchema,
  brief: BriefSchema.optional(),
  evidence: z.array(EvidenceItemSchema).default([]),
  claims: z.array(ClaimSchema).default([]),
  artifacts: z.array(ArtifactSchema).default([]),
  tribunalReports: z.array(TribunalReportSchema).default([]),
  variant: DossierVariantEnum.default('job'),
  version: z.number().int().positive().default(1),
  interview: InterviewRoomSchema.default({}),
  seal: SealSchema.optional(),
  createdAt: IsoDateTime.default(() => new Date().toISOString()),
  tz: z.string(),
})
