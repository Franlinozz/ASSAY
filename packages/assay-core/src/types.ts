import { z } from 'zod'
import {
  EvidenceItemSchema,
  ClaimSchema,
  NumericFactSchema,
  ExperienceSchema,
  EducationSchema,
  CertificationSchema,
  ContactSchema,
  ProfileSchema,
  RequirementSchema,
  BriefSchema,
  CoverageSchema,
  SentenceSchema,
  ArtifactSchema,
  SealSchema,
  TribunalReportSchema,
  TribunalFindingSchema,
  DossierSchema,
  EvidenceKindEnum,
  StrengthEnum,
  ClaimStatusEnum,
  RequirementKindEnum,
  CoverageStatusEnum,
  ArtifactKindEnum,
} from './schemas'

// Types are inferred from the zod schemas so the two can never drift.
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>
export type Claim = z.infer<typeof ClaimSchema>
export type NumericFact = z.infer<typeof NumericFactSchema>
export type Experience = z.infer<typeof ExperienceSchema>
export type Education = z.infer<typeof EducationSchema>
export type Certification = z.infer<typeof CertificationSchema>
export type Contact = z.infer<typeof ContactSchema>
export type Profile = z.infer<typeof ProfileSchema>
export type Requirement = z.infer<typeof RequirementSchema>
export type Brief = z.infer<typeof BriefSchema>
export type Coverage = z.infer<typeof CoverageSchema>
export type Sentence = z.infer<typeof SentenceSchema>
export type Artifact = z.infer<typeof ArtifactSchema>
export type Seal = z.infer<typeof SealSchema>
export type TribunalReport = z.infer<typeof TribunalReportSchema>
export type TribunalFinding = z.infer<typeof TribunalFindingSchema>
export type Dossier = z.infer<typeof DossierSchema>

export type EvidenceKind = z.infer<typeof EvidenceKindEnum>
export type Strength = z.infer<typeof StrengthEnum>
export type ClaimStatus = z.infer<typeof ClaimStatusEnum>
export type RequirementKind = z.infer<typeof RequirementKindEnum>
export type CoverageStatus = z.infer<typeof CoverageStatusEnum>
export type ArtifactKind = z.infer<typeof ArtifactKindEnum>
