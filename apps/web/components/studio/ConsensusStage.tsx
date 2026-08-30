'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AdjudicationCriterion, AdjudicationReceipt, StudioState } from '../../lib/studio'
import {
  genLayerBrowserClient,
  readPendingLinkage,
  savePendingLinkage,
  type ConsentPayload,
} from '../../lib/genlayer/client'
import { CRITERIA, GENLAYER } from '../../lib/genlayer/config'
import type { StudioActions } from './StudioWorkspace'
import { SealMoment } from './SealMoment'
import { ShareControls } from './ShareControls'

type UiState =
  | 'ready'
  | 'connect_wallet'
  | 'wrong_network'
  | 'awaiting_signature'
  | 'submitted'
  | 'pending'
  | 'accepted'
  | 'finalized'
  | 'rejected'
  | 'undetermined'
  | 'error'

const TERMINAL = new Set(['finalized', 'rejected', 'undetermined', 'error'])

function uiState(receipt: AdjudicationReceipt | undefined): UiState {
  return receipt?.status ?? 'ready'
}

export function ConsensusStage({
  id,
  state,
  actions,
}: {
  id: string
  state: StudioState
  actions: StudioActions
}) {
  const client = useMemo(() => genLayerBrowserClient(), [])
  const linkRef = useRef(actions.linkAdjudication)
  linkRef.current = actions.linkAdjudication
  const eligible = useMemo(
    () =>
      state.claims.flatMap((claim) => {
        if (claim.status !== 'confirmed') return []
        const urls = state.evidence
          .filter((evidence) => claim.evidenceIds.includes(evidence.id) && evidence.publicUrl)
          .map((evidence) => evidence.publicUrl!)
        return urls.length ? [{ claim, urls: [...new Set(urls)].slice(0, 3) }] : []
      }),
    [state.claims, state.evidence],
  )
  const stored = state.adjudications[0]
  const [claimId, setClaimId] = useState(stored?.claimId ?? eligible[0]?.claim.id ?? '')
  const selected = eligible.find((entry) => entry.claim.id === claimId) ?? eligible[0]
  const [criterionId, setCriterionId] = useState<AdjudicationCriterion>(
    stored?.criterionId ?? 'ACTION_AND_OUTCOME',
  )
  const [selectedUrls, setSelectedUrls] = useState<string[]>(
    stored?.evidenceUrls ?? selected?.urls ?? [],
  )
  const [consent, setConsent] = useState(false)
  const [wallet, setWallet] = useState<`0x${string}` | null>(stored?.wallet as `0x${string}` | null)
  const [chainId, setChainId] = useState<number | null>(stored ? GENLAYER.chainId : null)
  const [phase, setPhase] = useState<UiState>(uiState(stored))
  const [txHash, setTxHash] = useState<`0x${string}` | null>(stored?.txHash ?? null)
  const [networkStatus, setNetworkStatus] = useState<string | null>(null)
  const [statusDetail, setStatusDetail] = useState<string | null>(null)

  useEffect(() => {
    if (stored) {
      setPhase(uiState(stored))
      setTxHash(stored.txHash)
      setWallet(stored.wallet as `0x${string}`)
      setChainId(GENLAYER.chainId)
    }
  }, [stored])

  useEffect(() => {
    if (stored) return
    void client
      .inspectWallet()
      .then((snapshot) => {
        setWallet(snapshot.address)
        setChainId(snapshot.chainId)
        setPhase(
          !snapshot.address
            ? 'connect_wallet'
            : snapshot.chainId === GENLAYER.chainId
              ? 'ready'
              : 'wrong_network',
        )
      })
      .catch(() => setPhase('connect_wallet'))
  }, [client, stored])

  // A signed tx is written to localStorage before any network polling. On refresh, reconcile it
  // with the server's independent calldata/state verifier instead of inviting a duplicate write.
  useEffect(() => {
    if (stored) return
    for (const entry of eligible) {
      const pending = readPendingLinkage(id, entry.claim.id)
      if (!pending) continue
      setClaimId(entry.claim.id)
      setCriterionId(pending.criterionId)
      setSelectedUrls(pending.evidenceUrls)
      setTxHash(pending.txHash)
      setPhase('submitted')
      void linkRef.current({
        claimId: entry.claim.id,
        criterionId: pending.criterionId,
        evidenceUrls: pending.evidenceUrls,
        txHash: pending.txHash,
      })
      break
    }
  }, [eligible, id, stored])

  useEffect(() => {
    if (!txHash || !selected || (stored && TERMINAL.has(stored.status))) return
    let alive = true
    const sync = async () => {
      try {
        const tracked = await client.getTransaction(txHash)
        if (!alive) return
        setNetworkStatus(
          `${tracked.status}${tracked.consensusResult ? ` · ${tracked.consensusResult}` : ''}`,
        )
        setStatusDetail(null)
        const rejectedConsensus = [
          'DISAGREE',
          'MAJORITY_DISAGREE',
          'FAILURE',
          'DETERMINISTIC_VIOLATION',
        ].includes(String(tracked.consensusResult))
        const undeterminedConsensus = ['TIMEOUT', 'NO_MAJORITY', 'IDLE'].includes(
          String(tracked.consensusResult),
        )
        setPhase(
          rejectedConsensus
            ? 'rejected'
            : undeterminedConsensus
              ? 'undetermined'
              : tracked.status === 'FINALIZED'
                ? 'finalized'
                : tracked.status === 'ACCEPTED' || tracked.status === 'READY_TO_FINALIZE'
                  ? 'accepted'
                  : tracked.status === 'UNDETERMINED' || /TIMEOUT/.test(tracked.status)
                    ? 'undetermined'
                    : tracked.status === 'CANCELED'
                      ? 'rejected'
                      : 'pending',
        )
        await linkRef.current({
          claimId: selected.claim.id,
          criterionId,
          evidenceUrls: selectedUrls,
          txHash,
        })
      } catch {
        // RPC indexing and browser connectivity can lag. The local linkage remains for retry.
        if (alive) setStatusDetail('Bradbury RPC unavailable or not indexed yet; retrying safely.')
      }
    }
    void sync()
    const timer = setInterval(sync, 4_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [client, criterionId, selected, selectedUrls, stored, txHash])

  const connect = async () => {
    try {
      const snapshot = await client.connectWallet()
      setWallet(snapshot.address)
      setChainId(snapshot.chainId)
      setPhase(snapshot.chainId === GENLAYER.chainId ? 'ready' : 'wrong_network')
    } catch {
      setStatusDetail('Wallet connection was refused or failed.')
      setPhase('error')
    }
  }

  const switchChain = async () => {
    if (!wallet) return connect()
    try {
      await client.switchToBradbury(wallet)
      setChainId(GENLAYER.chainId)
      setPhase('ready')
    } catch {
      setStatusDetail('The wallet could not switch to Testnet Bradbury.')
      setPhase('error')
    }
  }

  const submit = async () => {
    if (!wallet || !selected || selectedUrls.length === 0 || !consent) return
    const payload: ConsentPayload = {
      claimKey: selected.claim.adjudicationKey,
      claimText: selected.claim.text,
      criterionId,
      evidenceUrls: selectedUrls,
    }
    try {
      setPhase('awaiting_signature')
      const hash = await client.writeAdjudication(wallet, payload)
      savePendingLinkage(id, { ...payload, claimId: selected.claim.id, txHash: hash })
      setTxHash(hash)
      setPhase('submitted')
      await actions.linkAdjudication({
        claimId: selected.claim.id,
        criterionId,
        evidenceUrls: selectedUrls,
        txHash: hash,
      })
    } catch {
      setStatusDetail('The wallet signature was refused or the transaction could not be sent.')
      setPhase('error')
    }
  }

  const finalized = stored?.status === 'finalized'
  return (
    <div className="stage" data-testid="consensus-stage">
      <header className="stage-header">
        <div>
          <p className="overline">Stage 6 · Consensus</p>
          <h2>Public evidence, independently adjudicated.</h2>
          <p className="stage-lede">
            GenLayer validators decide whether approved public evidence supports one claim under the
            Assay Standard. This is consensus—not identity, issuer, or absolute-truth verification.
          </p>
        </div>
      </header>

      {stored?.verdict ? (
        <section className="consensus-receipt" data-testid="consensus-receipt">
          <span className="chip chip-ok">GENLAYER ADJUDICATED</span>
          <h3>{stored.verdict}</h3>
          <p>{stored.shortReason}</p>
          <dl className="consensus-grid">
            <div>
              <dt>Reason code</dt>
              <dd className="mono">{stored.reasonCode}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className="mono">{stored.status}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Testnet Bradbury · 4221</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd className="mono">{GENLAYER.contract}</dd>
            </div>
          </dl>
          <a
            className="btn btn-ghost btn-sm"
            href={`${GENLAYER.explorer}/tx/${stored.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View consensus transaction ↗
          </a>
        </section>
      ) : (
        <section className="consensus-review" data-testid="consensus-review">
          {eligible.length === 0 ? (
            <div className="studio-error">
              No confirmed claim currently has an approved public link. Private uploads,
              attestations, contact data, and PII are never eligible. Add a public GitHub, GitLab,
              gist, or Assay link in the Ledger first.
            </div>
          ) : (
            <>
              <label>
                <span className="overline">Claim</span>
                <select
                  value={selected?.claim.id}
                  disabled={!!txHash}
                  onChange={(event) => {
                    const next = eligible.find((entry) => entry.claim.id === event.target.value)
                    setClaimId(event.target.value)
                    setSelectedUrls(next?.urls ?? [])
                  }}
                >
                  {eligible.map((entry) => (
                    <option key={entry.claim.id} value={entry.claim.id}>
                      {entry.claim.text}
                    </option>
                  ))}
                </select>
              </label>
              <div className="consent-payload">
                <p>
                  <span>Exact public claim</span>
                  {selected?.claim.text}
                </p>
                <p>
                  <span>Claim key</span>
                  <code>{selected?.claim.adjudicationKey}</code>
                </p>
              </div>
              <label>
                <span className="overline">Assay criterion</span>
                <select
                  value={criterionId}
                  disabled={!!txHash}
                  onChange={(event) => setCriterionId(event.target.value as AdjudicationCriterion)}
                >
                  {Object.entries(CRITERIA).map(([id, description]) => (
                    <option key={id} value={id}>
                      {id} — {description}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="consensus-urls">
                <legend className="overline">Public URLs sent to validators</legend>
                {selected?.urls.map((url) => (
                  <label key={url}>
                    <input
                      type="checkbox"
                      checked={selectedUrls.includes(url)}
                      disabled={!!txHash}
                      onChange={(event) =>
                        setSelectedUrls((current) =>
                          event.target.checked
                            ? [...new Set([...current, url])].slice(0, 3)
                            : current.filter((item) => item !== url),
                        )
                      }
                    />
                    <code>{url}</code>
                  </label>
                ))}
              </fieldset>
              <label className="consensus-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={!!txHash}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                I approve publishing this exact claim, criterion, and these URLs to GenLayer Testnet
                Bradbury. I understand public blockchain transactions are durable.
              </label>
            </>
          )}

          <div className="consensus-status" data-testid="consensus-status" data-status={phase}>
            <span className="studio-run-dot" aria-hidden="true" />
            <strong>{phase.replaceAll('_', ' ')}</strong>
            {networkStatus ? <span className="mono"> · {networkStatus}</span> : null}
          </div>
          {statusDetail ? <p className="caption">{statusDetail}</p> : null}
          {txHash ? (
            <a
              className="mono"
              href={`${GENLAYER.explorer}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {txHash}
            </a>
          ) : null}
          {!wallet || phase === 'connect_wallet' ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="genlayer-connect"
              onClick={connect}
            >
              Connect wallet
            </button>
          ) : chainId !== GENLAYER.chainId || phase === 'wrong_network' ? (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="genlayer-switch"
              onClick={switchChain}
            >
              Switch to Testnet Bradbury
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              data-testid="genlayer-submit"
              disabled={
                !selected || !consent || selectedUrls.length === 0 || !!txHash || actions.busy
              }
              onClick={submit}
            >
              {phase === 'awaiting_signature'
                ? 'Awaiting wallet signature…'
                : 'Submit for consensus'}
            </button>
          )}
        </section>
      )}

      {finalized || state.seal ? (
        <>
          <SealMoment seal={state.seal} busy={actions.busy} onSeal={actions.seal} />
          {state.seal ? <ShareControls state={state} actions={actions} /> : null}
          <div className="gallery-privacy-note" data-testid="gallery-privacy-note">
            <p className="overline">Private by default</p>
            <p className="caption">
              This dossier never appears in the public Gallery automatically. Recruiter links expose
              only the fields and evidence you choose and remain revocable.
            </p>
          </div>
        </>
      ) : (
        <p className="caption" data-testid="seal-waits-consensus">
          The X Layer seal unlocks only after GenLayer finality, so its manifest can include the
          consensus receipt.
        </p>
      )}

      <div className="stage-footer">
        <button type="button" className="btn btn-ghost" onClick={() => actions.goTo('report')}>
          ← Back to the Tribunal
        </button>
      </div>
    </div>
  )
}
