import type { Profile } from './types'

// PolicyGate runs BEFORE any payment semantics (guardrail #6). It refuses impersonation of real
// named third parties, discriminatory/deceptive requests, and fabricating credentials the user
// doesn't hold — politely, without charge. Deterministic (no LLM): pattern rules only.

export type PolicyCode = 'IMPERSONATION' | 'DISCRIMINATION' | 'DECEPTION' | 'FABRICATED_CREDENTIAL'

export interface PolicyRefusal {
  allowed: false
  code: PolicyCode
  reason: string
  detail: string
}
export interface PolicyAllowed {
  allowed: true
}
export type PolicyResult = PolicyAllowed | PolicyRefusal

export interface PolicyInput {
  text: string
  profile?: Profile
}

interface Rule {
  code: PolicyCode
  re: RegExp
  reason: string
}

// Order matters: credential-fabrication is checked before generic deception so "fabricate a
// degree" is classified as FABRICATED_CREDENTIAL. Credential rules require an explicit fakeness
// signal so that legitimately including a degree the user holds is NOT refused.
const RULES: Rule[] = [
  {
    code: 'FABRICATED_CREDENTIAL',
    re: /\b(?:invent|fabricate|forge|make up|fake)\b[^.]*\b(?:degree|diploma|phd|ph\.d|mba|bachelor'?s?|master'?s?|doctorate|certification|certificate|licen[cs]e)\b|\b(?:degree|certification|credential|licen[cs]e)s?\s+i\s+(?:don'?t|do not|never)\s+(?:have|hold|earned?)\b|\bfake\s+(?:degree|diploma|certification|credential)\b/i,
    reason:
      "I can only present credentials you actually hold — I won't add a degree, certification, or license you haven't earned.",
  },
  {
    code: 'IMPERSONATION',
    re: /\b(?:impersonate|pose as|pretend to be|pretend i(?:'m| am)|write (?:this )?as if i (?:am|were)|sign (?:this )?as|forge a (?:reference|letter)|fake (?:a )?reference (?:from|by)|reference (?:from|by) [A-Z])\b/i,
    reason:
      "I can't write as, or forge material from, a real named person or organization. I can help you request a genuine reference instead.",
  },
  {
    code: 'DISCRIMINATION',
    re: /\b(?:only (?:hire|consider) (?:men|women|white|young|male|female|christian|muslim)|no (?:women|men|disabled|older|old|black|gay|jewish)\b|discriminate|hide my (?:age|disability|pregnancy|religion|race|ethnicity)|make me (?:look|seem) (?:younger|whiter|male|female|less (?:old|disabled)))\b/i,
    reason:
      "I won't tailor anything around protected characteristics, or help conceal them deceptively. I can focus on your skills and evidence instead.",
  },
  {
    code: 'DECEPTION',
    re: /\b(?:lie about|fabricate|falsify|backdate|invent (?:an?|some|two|three|\d+)?\s*(?:years?|months?)?\s*(?:of )?(?:experience|role|job|employer|company)|make up (?:an?|some|my)?\s*(?:experience|role|job|employer|dates?|metric|number|result)|inflate (?:my )?(?:numbers|metrics|results)|exaggerate the (?:numbers|figures|metrics))\b/i,
    reason:
      "I won't fabricate or inflate experience, employers, dates, or metrics. Everything in your dossier has to trace to real evidence.",
  },
]

export function policyGate(input: PolicyInput): PolicyResult {
  const text = input.text ?? ''
  for (const rule of RULES) {
    if (rule.re.test(text)) {
      return { allowed: false, code: rule.code, reason: rule.reason, detail: `matched ${rule.code} rule` }
    }
  }
  return { allowed: true }
}
