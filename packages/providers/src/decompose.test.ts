import { describe, it, expect } from 'vitest'
import { decomposeJd } from './decompose'
import { createRouter } from './index'

describe('decomposeJd (fake mode)', () => {
  it('splits a JD into must/nice requirements with stopword-filtered keywords', async () => {
    const router = createRouter() // fake by default
    const { requirements } = await decomposeJd({
      jdText: 'Must have PostgreSQL and Node.\nNice to have Redis.',
      router,
    })
    expect(requirements.length).toBeGreaterThanOrEqual(2)

    const must = requirements.find((r) => /postgresql/i.test(r.text))
    expect(must?.kind).toBe('must')
    expect(must?.keywords).toContain('postgresql')
    expect(must?.keywords).not.toContain('have') // stopword filtered

    const nice = requirements.find((r) => /redis/i.test(r.text))
    expect(nice?.kind).toBe('nice')
  })
})
