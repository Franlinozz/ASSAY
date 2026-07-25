'use client'

import { useState } from 'react'
import type { StudioState } from '../../lib/studio'
import type { StudioActions } from './StudioWorkspace'
import { TierChip } from '../TierChip'

function AnswerCard({ state, questionId }: { state: StudioState; questionId: string }) {
  const evaluation = state.interview.evaluations.find((e) => e.questionId === questionId)
  if (!evaluation) return null
  return (
    <div className={`card-paper interview-evaluation ${evaluation.final ? 'interview-final' : ''}`}>
      <div className="interview-score-row">
        {Object.entries(evaluation.star).map(([part, present]) => (
          <span key={part} className={`chip ${present ? 'chip-ok' : 'chip-fail'}`}>
            {part} {present ? '✓' : '—'}
          </span>
        ))}
        <span className="chip">relevance {evaluation.relevance}</span>
      </div>
      {evaluation.contradictions.map((c) => (
        <p
          key={`${c.claimId}-${c.answerValue}`}
          className="studio-error"
          data-testid="interview-contradiction"
        >
          {c.detail}
        </p>
      ))}
      {evaluation.feedback.map((f, i) => (
        <p className="caption" key={i}>
          {f.text}
        </p>
      ))}
      <p className="mono caption">
        {evaluation.final
          ? 'final answer · stored with evidence chips'
          : 'not final · correct the answer or ledger'}
      </p>
    </div>
  )
}

export function InterviewStage({ state, actions }: { state: StudioState; actions: StudioActions }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const claimById = new Map(state.claims.map((c) => [c.id, c]))
  const questions = state.interview.questions

  return (
    <div className="stage">
      <header className="stage-header">
        <div>
          <p className="overline">Stage 3 · Interview Room</p>
          <h2>Test the answer against the record.</h2>
          <p className="stage-lede">
            Assay generates behavioral questions from your claims and probes honest coverage gaps.
            Type an answer; the critic evaluates STAR structure and catches anything that disagrees
            with your confirmed ledger. It evaluates—it does not roleplay an interviewer.
          </p>
        </div>
      </header>

      {questions.length === 0 ? (
        <div className="ledger-empty">
          <p className="caption">Prepare a bounded set of questions from this brief and ledger.</p>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="prepare-interview"
            disabled={actions.busy || !state.brief}
            onClick={() => actions.prepareInterview()}
          >
            {actions.busy ? 'Preparing…' : 'Prepare interview questions'}
          </button>
        </div>
      ) : (
        <div className="interview-list" data-testid="interview-room">
          {questions.map((q, index) => (
            <article key={q.id} className="claim-card">
              <p className="overline">
                {q.kind === 'gap' ? 'Gap probe' : `Behavioral ${index + 1}`}
              </p>
              <h3 className="interview-question">{q.prompt}</h3>
              {q.claimIds.length > 0 ? (
                <div className="interview-evidence-chips">
                  {q.claimIds.map((id) => {
                    const claim = claimById.get(id)
                    return claim ? <TierChip key={id} tier={claim.tier} /> : null
                  })}
                  <span className="caption">grounded in {q.claimIds.length} ledger claim(s)</span>
                </div>
              ) : (
                <p className="caption">No direct claim yet—keep the answer adjacent and honest.</p>
              )}
              <textarea
                className="field-input"
                rows={6}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((old) => ({ ...old, [q.id]: e.target.value }))}
                placeholder="Type your answer. Make the situation, task, action, and result explicit…"
                data-testid={`interview-answer-${index}`}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={actions.busy || !(answers[q.id] ?? '').trim()}
                onClick={() => actions.evaluateInterview(q.id, answers[q.id] ?? '')}
              >
                {actions.busy ? 'Critiquing…' : 'Check this answer'}
              </button>
              <AnswerCard state={state} questionId={q.id} />
            </article>
          ))}
        </div>
      )}

      <div className="stage-footer">
        <button type="button" className="btn btn-ghost" onClick={() => actions.goTo('brief')}>
          ← Back to the Brief
        </button>
        <button type="button" className="btn btn-primary" onClick={() => actions.goTo('forge')}>
          Continue to the Forge →
        </button>
      </div>
    </div>
  )
}
