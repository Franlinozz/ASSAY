// FICTIONAL PERSONAS — the single source of truth for Assay's gallery + judge demonstrations
// (guardrail #7: gallery/demo content is REAL pipeline output on clearly-labeled fictional personas).
//
// Each persona carries: a résumé document (real text — becomes a `document` evidence item), extra
// documents, live external links (hosted under /fixtures/ so LINK_LIVENESS passes honestly), a target
// job description, and a deterministic `fakeExtraction` used by the fake extractor. Every claim's
// words + numbers appear in that persona's résumé text, so the groundedness post-check keeps them and
// no honest figure is quantified-without-source. The LIVE pipeline re-derives the same shape from the
// same documents; the fake path just makes it deterministic + zero-spend for layout, tests, and the
// judge's offline fallback.
//
// These people do not exist. Every surface that renders them says so on the tin.

export interface PersonaLink {
  url: string
  label: string
  /** which claim indexes (into fakeExtraction.claims) this live link backs → earns them the 'linked' tier */
  backsClaims: number[]
}

export interface PersonaExtraction {
  profile: {
    fullName: string
    headline: string
    contact: { email: string; links: string[] }
    skills: string[]
  }
  experiences: Array<{
    org: string
    title: string
    startYm: string
    endYm: string | null
    location?: string
  }>
  claims: Array<{
    text: string
    numericFacts: Array<{ value: number; unit?: string; context: string }>
    tags: string[]
  }>
}

export interface PersonaFixture {
  slug: string
  name: string
  headline: string
  location: string
  /** one-line case framing shown in the gallery */
  caseType: string
  blurb: string
  /** the résumé text — a real document fed to extraction */
  resumeText: string
  /** additional evidence documents (reference letters, brag docs) */
  extraDocs: Array<{ label: string; text: string }>
  /** live external links, hosted under /fixtures/, that LINK_LIVENESS fetch-checks for real */
  links: PersonaLink[]
  /** the target job description this dossier is tailored against */
  jd: string
  /** deterministic extraction for the fake pipeline (grounded in resumeText) */
  fakeExtraction: PersonaExtraction
}

const ADAEZE: PersonaFixture = {
  slug: 'adaeze-okonkwo',
  name: 'Adaeze Okonkwo',
  headline: 'Product Operations Lead — Lagos, Nigeria',
  location: 'Lagos, Nigeria',
  caseType: 'Career ladder — analyst to lead, same track',
  blurb:
    'Seven years of fintech operations, climbing one track: analyst → senior analyst → lead. The dossier has to make the promotion arc legible without inflating a single number.',
  resumeText: `Adaeze Okonkwo
Product Operations Lead — Lagos, Nigeria
adaeze.okonkwo@example.com | https://assayed.xyz/fixtures/adaeze-okonkwo-portfolio.html

EXPERIENCE
Kuda — Product Operations Lead (Jan 2022 – Present), Lagos
- Cut customer onboarding time by 43% by redesigning the KYC operations workflow.
- Led a cross-functional team of 9 across support, risk, and engineering.

Flutterwave — Senior Product Operations Analyst (Mar 2019 – Dec 2021), Lagos
- Reduced payment dispute backlog by 61% in two quarters.
- Built the operations reporting dashboard adopted by 4 product teams.

Jumia — Product Operations Analyst (Jul 2017 – Feb 2019), Lagos
- Processed 15000 merchant onboarding tickets at a 98% SLA compliance rate.

SKILLS
Operations strategy, KYC workflows, SQL, Looker, stakeholder management, process design`,
  extraDocs: [
    {
      label: 'reference-letter-kuda.txt',
      text: `To whom it may concern,
Adaeze led Product Operations at Kuda from January 2022. She redesigned our KYC operations workflow and cut customer onboarding time materially. She managed a cross-functional team of 9 spanning support, risk, and engineering. — Head of Product, Kuda`,
    },
  ],
  links: [
    {
      url: 'https://assayed.xyz/fixtures/adaeze-okonkwo-portfolio.html',
      label: 'Operations portfolio',
      backsClaims: [0, 1],
    },
    {
      url: 'https://assayed.xyz/fixtures/adaeze-okonkwo-kuda-case-study.html',
      label: 'Kuda KYC redesign case study',
      backsClaims: [0],
    },
  ],
  jd: `- Must have led product or business operations for a fintech at scale
- Experience redesigning KYC or onboarding workflows is required
- Strong SQL and dashboarding skills for operations reporting
- Experience managing cross-functional teams is required
- Lean or Six Sigma process-improvement certification is a bonus`,
  fakeExtraction: {
    profile: {
      fullName: 'Adaeze Okonkwo',
      headline: 'Product Operations Lead',
      contact: {
        email: 'adaeze.okonkwo@example.com',
        links: ['https://assayed.xyz/fixtures/adaeze-okonkwo-portfolio.html'],
      },
      skills: ['Operations strategy', 'KYC workflows', 'SQL', 'Looker', 'Stakeholder management', 'Process design'],
    },
    experiences: [
      { org: 'Kuda', title: 'Product Operations Lead', startYm: '2022-01', endYm: null, location: 'Lagos' },
      { org: 'Flutterwave', title: 'Senior Product Operations Analyst', startYm: '2019-03', endYm: '2021-12', location: 'Lagos' },
      { org: 'Jumia', title: 'Product Operations Analyst', startYm: '2017-07', endYm: '2019-02', location: 'Lagos' },
    ],
    claims: [
      {
        text: 'Cut customer onboarding time by 43% by redesigning the KYC operations workflow',
        numericFacts: [{ value: 43, unit: '%', context: 'onboarding time reduction' }],
        tags: ['operations', 'kyc'],
      },
      {
        text: 'Led a cross-functional team of 9 across support, risk, and engineering',
        numericFacts: [{ value: 9, context: 'team size' }],
        tags: ['leadership'],
      },
      {
        text: 'Reduced payment dispute backlog by 61% in two quarters',
        numericFacts: [{ value: 61, unit: '%', context: 'dispute backlog reduction' }],
        tags: ['operations', 'payments'],
      },
      {
        text: 'Processed 15000 merchant onboarding tickets at a 98% SLA compliance rate',
        numericFacts: [
          { value: 15000, context: 'merchant onboarding tickets' },
          { value: 98, unit: '%', context: 'SLA compliance' },
        ],
        tags: ['operations', 'sla'],
      },
      // Ambiguity claim: the number 27 is NOT in the résumé → needs_confirmation → becomes a question
      // (the honesty beat the judge tour animates). Tokens are grounded, so it is kept, not dropped.
      {
        text: 'Reduced the merchant onboarding backlog by 27% at Flutterwave',
        numericFacts: [{ value: 27, unit: '%', context: 'onboarding backlog reduction' }],
        tags: ['operations'],
      },
    ],
  },
}

const TOMAS: PersonaFixture = {
  slug: 'tomas-rivera',
  name: 'Tomás Rivera',
  headline: 'Frontend Engineer — Buenos Aires, Argentina',
  location: 'Buenos Aires, Argentina',
  caseType: 'Tech — engineer with shippable, checkable proof',
  blurb:
    'A frontend engineer whose strongest evidence is live: open-source work and a performance case study. The dossier leans on links that actually resolve — or they never earn the linked tier.',
  resumeText: `Tomás Rivera
Frontend Engineer — Buenos Aires, Argentina
tomas.rivera@example.com | https://assayed.xyz/fixtures/tomas-rivera-portfolio.html

EXPERIENCE
Mercado Libre — Frontend Engineer (Apr 2021 – Present), Buenos Aires
- Cut the checkout bundle size by 52% by code-splitting the React application.
- Improved Largest Contentful Paint from 4.1s to 1.6s on the product page.

Auth0 — Frontend Engineer (Feb 2019 – Mar 2021), Remote
- Shipped a design system of 40 components adopted by 6 product teams.

SKILLS
TypeScript, React, Next.js, WebPerf, accessibility, Playwright, CSS`,
  extraDocs: [
    {
      label: 'perf-writeup.txt',
      text: `Checkout performance writeup: by code-splitting the React application and deferring non-critical scripts, the checkout bundle size dropped by 52% and Largest Contentful Paint improved from 4.1s to 1.6s on the product page.`,
    },
  ],
  links: [
    {
      url: 'https://assayed.xyz/fixtures/tomas-rivera-portfolio.html',
      label: 'Engineering portfolio',
      backsClaims: [0, 1],
    },
    {
      url: 'https://assayed.xyz/fixtures/tomas-rivera-design-system.html',
      label: 'Design system case study',
      backsClaims: [2],
    },
  ],
  jd: `- Strong React and TypeScript experience is required
- Must have measurable web performance work (bundle size, Core Web Vitals)
- Experience building or maintaining a design system
- Rust or WebAssembly experience is a bonus`,
  fakeExtraction: {
    profile: {
      fullName: 'Tomás Rivera',
      headline: 'Frontend Engineer',
      contact: {
        email: 'tomas.rivera@example.com',
        links: ['https://assayed.xyz/fixtures/tomas-rivera-portfolio.html'],
      },
      skills: ['TypeScript', 'React', 'Next.js', 'WebPerf', 'Accessibility', 'Playwright', 'CSS'],
    },
    experiences: [
      { org: 'Mercado Libre', title: 'Frontend Engineer', startYm: '2021-04', endYm: null, location: 'Buenos Aires' },
      { org: 'Auth0', title: 'Frontend Engineer', startYm: '2019-02', endYm: '2021-03', location: 'Remote' },
    ],
    claims: [
      {
        text: 'Cut the checkout bundle size by 52% by code-splitting the React application',
        numericFacts: [{ value: 52, unit: '%', context: 'bundle size reduction' }],
        tags: ['webperf', 'react'],
      },
      {
        text: 'Improved Largest Contentful Paint from 4.1s to 1.6s on the product page',
        numericFacts: [
          { value: 4.1, unit: 's', context: 'LCP before' },
          { value: 1.6, unit: 's', context: 'LCP after' },
        ],
        tags: ['webperf'],
      },
      {
        text: 'Shipped a design system of 40 components adopted by 6 product teams',
        numericFacts: [
          { value: 40, context: 'components' },
          { value: 6, context: 'product teams' },
        ],
        tags: ['design-system'],
      },
    ],
  },
}

const MEILIN: PersonaFixture = {
  slug: 'mei-lin-chao',
  name: 'Mei-Lin Chao',
  headline: 'Pharmacist moving into Health Operations — Singapore',
  location: 'Singapore',
  caseType: 'Career changer — transferable-skills gap brief',
  blurb:
    'A licensed pharmacist pivoting into health-operations. The target role wants skills her résumé does not name outright, so the fit brief has to argue transfer honestly — and the coverage map has to show the real gaps, not paper over them.',
  resumeText: `Mei-Lin Chao
Clinical Pharmacist — Singapore
mei-lin.chao@example.com | https://assayed.xyz/fixtures/mei-lin-chao-portfolio.html

EXPERIENCE
Singapore General Hospital — Clinical Pharmacist (Aug 2018 – Present), Singapore
- Reduced medication dispensing errors by 34% by standardising the verification protocol.
- Coordinated a team of 12 pharmacists and technicians across two dispensing units.
- Ran a formulary review that cut drug procurement cost by 18% annually.

Guardian Health — Community Pharmacist (Jun 2015 – Jul 2018), Singapore
- Counselled 60 patients per day on medication safety and adherence.

SKILLS
Clinical pharmacology, protocol design, inventory management, patient counselling, regulatory compliance`,
  extraDocs: [
    {
      label: 'formulary-review-summary.txt',
      text: `Formulary review summary: Mei-Lin ran a formulary review at Singapore General Hospital that standardised the verification protocol, reduced medication dispensing errors by 34%, and cut drug procurement cost by 18% annually across two dispensing units.`,
    },
  ],
  links: [
    {
      url: 'https://assayed.xyz/fixtures/mei-lin-chao-portfolio.html',
      label: 'Clinical operations portfolio',
      backsClaims: [0, 2],
    },
  ],
  jd: `- Must have led operational process improvement in a healthcare setting
- Experience managing inventory or procurement is required
- Comfort with operational data analysis and reporting dashboards
- Team coordination and stakeholder management across units
- Lean healthcare or Six Sigma certification is a bonus`,
  fakeExtraction: {
    profile: {
      fullName: 'Mei-Lin Chao',
      headline: 'Clinical Pharmacist',
      contact: {
        email: 'mei-lin.chao@example.com',
        links: ['https://assayed.xyz/fixtures/mei-lin-chao-portfolio.html'],
      },
      skills: ['Clinical pharmacology', 'Protocol design', 'Inventory management', 'Patient counselling', 'Regulatory compliance'],
    },
    experiences: [
      { org: 'Singapore General Hospital', title: 'Clinical Pharmacist', startYm: '2018-08', endYm: null, location: 'Singapore' },
      { org: 'Guardian Health', title: 'Community Pharmacist', startYm: '2015-06', endYm: '2018-07', location: 'Singapore' },
    ],
    claims: [
      {
        text: 'Reduced medication dispensing errors by 34% by standardising the verification protocol',
        numericFacts: [{ value: 34, unit: '%', context: 'dispensing error reduction' }],
        tags: ['process-improvement', 'clinical'],
      },
      {
        text: 'Coordinated a team of 12 pharmacists and technicians across two dispensing units',
        numericFacts: [{ value: 12, context: 'team size' }],
        tags: ['leadership'],
      },
      {
        text: 'Ran a formulary review that cut drug procurement cost by 18% annually',
        numericFacts: [{ value: 18, unit: '%', context: 'procurement cost reduction' }],
        tags: ['procurement', 'process-improvement'],
      },
      {
        text: 'Counselled 60 patients per day on medication safety and adherence',
        numericFacts: [{ value: 60, context: 'patients per day' }],
        tags: ['clinical'],
      },
    ],
  },
}

export const PERSONAS: PersonaFixture[] = [ADAEZE, TOMAS, MEILIN]

export function personaBySlug(slug: string): PersonaFixture | undefined {
  return PERSONAS.find((p) => p.slug === slug)
}

// Match a persona from an extraction prompt by the name that leads its résumé. Returns the persona's
// deterministic extraction, or undefined to fall back to the default fixture (Chidinma Eze).
export function fakePersonaExtractionFor(prompt: string): PersonaExtraction | undefined {
  for (const p of PERSONAS) {
    if (prompt.includes(p.name)) return p.fakeExtraction
  }
  return undefined
}
