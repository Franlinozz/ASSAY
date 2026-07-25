'use client'

import { useRef, useState } from 'react'
import type { RedactionRecord, StudioEvidence } from '../../lib/studio'
import type { StudioActions } from './StudioWorkspace'

type Region = RedactionRecord['regions'][number]

export function RedactionEditor({
  evidence,
  initial,
  actions,
}: {
  evidence: StudioEvidence
  initial?: RedactionRecord
  actions: StudioActions
}) {
  const surface = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLTextAreaElement>(null)
  const [fields, setFields] = useState<Array<'email' | 'phone'>>(initial?.fields ?? [])
  const [ranges, setRanges] = useState(initial?.textRanges ?? [])
  const [regions, setRegions] = useState<Region[]>(initial?.regions ?? [])
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const [saved, setSaved] = useState(false)

  const point = (clientX: number, clientY: number) => {
    const box = surface.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (clientY - box.top) / box.height)),
    }
  }

  return (
    <details className="claim-card" data-testid={`redaction-${evidence.id}`}>
      <summary>
        Redact before sharing · <span className="mono">{evidence.label}</span>
      </summary>
      <p className="caption" style={{ margin: '0.8rem 0' }}>
        Mark fields, select exact text, or draw over the document preview. The share bundle receives
        only the cleaned copy; coordinates and source fragments stay server-side.
      </p>
      <div className="stack">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {(['email', 'phone'] as const).map((field) => (
            <label className="share-check" key={field}>
              <input
                type="checkbox"
                checked={fields.includes(field)}
                onChange={(event) =>
                  setFields((current) =>
                    event.target.checked
                      ? [...current, field]
                      : current.filter((item) => item !== field),
                  )
                }
              />
              <span>Hide profile {field}</span>
            </label>
          ))}
        </div>
        <textarea
          ref={text}
          className="field-input"
          readOnly
          rows={6}
          value={evidence.contentPreview ?? ''}
          aria-label={`Text in ${evidence.label}`}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const node = text.current
            if (node && node.selectionEnd > node.selectionStart)
              setRanges((current) => [
                ...current,
                { start: node.selectionStart, end: node.selectionEnd },
              ])
          }}
        >
          Redact selected text
        </button>
        <div
          ref={surface}
          className="redaction-surface"
          style={{
            minHeight: '12rem',
            position: 'relative',
            border: '1px solid var(--line)',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
            userSelect: 'none',
            cursor: 'crosshair',
            overflow: 'hidden',
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            setOrigin(point(event.clientX, event.clientY))
          }}
          onPointerUp={(event) => {
            if (!origin) return
            const end = point(event.clientX, event.clientY)
            const width = Math.abs(end.x - origin.x)
            const height = Math.abs(end.y - origin.y)
            if (width > 0.01 && height > 0.01)
              setRegions((current) => [
                ...current,
                {
                  page: 1,
                  x: Math.min(origin.x, end.x),
                  y: Math.min(origin.y, end.y),
                  width,
                  height,
                },
              ])
            setOrigin(null)
          }}
        >
          <span className="caption">{evidence.contentPreview || 'Document preview'}</span>
          {regions.map((region, index) => (
            <span
              key={index}
              aria-label="redacted region"
              style={{
                position: 'absolute',
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
                background: '#111',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              await actions.redact(evidence.id, { fields, textRanges: ranges, regions })
              setSaved(true)
            }}
          >
            Save redactions
          </button>
          {(ranges.length > 0 || regions.length > 0) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setRanges([])
                setRegions([])
                setSaved(false)
              }}
            >
              Clear marks
            </button>
          )}
          <span className="caption">
            {saved ? 'saved' : `${ranges.length} text · ${regions.length} drawn`}
          </span>
        </div>
      </div>
    </details>
  )
}
