// Deterministic text helpers shared by extraction (groundedness) and coverage (keyword overlap).

export function words(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []
}

// Tokens worth matching on: words of length >= 4, or any pure number.
export function significantTokens(s: string): string[] {
  return words(s).filter((w) => w.length >= 4 || /^\d+$/.test(w))
}

// Crude lemmatization so "scaled" and "scaling" both reduce toward "scal". Deterministic.
export function lemma(w: string): string {
  let x = w
  if (x.length > 5) x = x.replace(/(ings?|edly|ings|ing|ed)$/, '')
  if (x.length > 4) x = x.replace(/s$/, '')
  return x
}

// Generic English + JD-filler stopwords, so keyword overlap reflects substance not boilerplate.
const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'you',
  'your',
  'our',
  'are',
  'was',
  'were',
  'this',
  'that',
  'have',
  'has',
  'had',
  'will',
  'would',
  'should',
  'must',
  'able',
  'about',
  'into',
  'from',
  'they',
  'them',
  'their',
  'who',
  'what',
  'when',
  'where',
  'which',
  'how',
  'strong',
  'proven',
  'required',
  'require',
  'experience',
  'experienc',
  'nice',
  'good',
  'great',
  'excellent',
  'work',
  'working',
  'team',
  'role',
  'plus',
  'including',
  'include',
  'etc',
  'well',
  'years',
  'year',
  'hiring',
  'candidate',
  'looking',
])

export function normalizeKeywords(candidates: string[]): string[] {
  const out = new Set<string>()
  for (const c of candidates) {
    for (const w of words(c)) {
      if (STOPWORDS.has(w)) continue
      const k = lemma(w)
      if (k.length >= 3 && !STOPWORDS.has(k)) out.add(k)
    }
  }
  return [...out]
}

// The lemma-set of a piece of text plus optional tags — used to match against requirement keywords.
//
// The threshold here is 3, not the 4 that `significantTokens` uses, and the difference is the
// whole point. `normalizeKeywords` keeps requirement keywords down to three characters, so a JD
// asking for ICH-GCP yields the keywords "ich" and "gcp" — while a claim reading "Completed
// ICH-GCP training (March 2024)" produced a vocabulary that had silently dropped both, because
// they are three letters long. Every requirement stated as an acronym (ICH, GCP, AWS, SQL, CPA,
// RN) was therefore unmatchable, and the honest-looking "missing" was a bug in the matcher rather
// than a gap in the candidate. Both sides now agree on what counts as a word.
export function keywordSet(text: string, tags: string[] = []): Set<string> {
  const set = new Set<string>()
  for (const w of words(text)) if (w.length >= 3 || /^\d+$/.test(w)) set.add(lemma(w))
  for (const t of tags) for (const w of words(t)) set.add(lemma(w))
  return set
}
