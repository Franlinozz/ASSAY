import type {
  AdjudicationStatus,
  AdjudicationVerdict,
  AdjudicationCriterion,
} from '@xyndicate/assay-core'
import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import {
  ExecutionResult,
  TransactionResult,
  TransactionStatus,
  transactionsStatusNumberToName,
  type GenLayerTransaction,
  type TransactionHash,
} from 'genlayer-js/types'

type ClientChain = NonNullable<NonNullable<Parameters<typeof createClient>[0]>['chain']>
const BRADBURY_CHAIN = testnetBradbury as unknown as ClientChain

export const GENLAYER_NETWORK = 'testnet-bradbury' as const
export const GENLAYER_CHAIN_ID = 4221 as const
export const GENLAYER_CONTRACT = '0xa0A37DEf61d5C621FDeF43b604D8059779D1B96E' as const
export const GENLAYER_EXPLORER = 'https://explorer-bradbury.genlayer.com' as const
export const GENLAYER_STANDARD = 'AS-1.1.0' as const

export const GENLAYER_EVIDENCE_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'gist.github.com',
  'gist.githubusercontent.com',
  'gitlab.com',
  'assayed.xyz',
  'www.assayed.xyz',
])

export interface AdjudicationWrite {
  claimKey: string
  claimText: string
  criterionId: AdjudicationCriterion
  standardVersion: string
  evidenceUrls: string[]
  txHash: `0x${string}`
}

export interface VerifiedGenLayerAdjudication {
  status: AdjudicationStatus
  wallet: `0x${string}`
  networkStatus: string
  executionResult?: string
  verdict?: AdjudicationVerdict
  reasonCode?: string
  shortReason?: string
  sourceCount?: number
  unavailableCount?: number
}

export interface GenLayerVerifier {
  verify(input: AdjudicationWrite): Promise<VerifiedGenLayerAdjudication>
}

interface VerifierClient {
  getTransaction(args: { hash: TransactionHash }): Promise<GenLayerTransaction>
  readContract(args: {
    address: `0x${string}`
    functionName: string
    args: unknown[]
  }): Promise<unknown>
}

type StoredResult = {
  claimKey?: unknown
  criterionId?: unknown
  standardVersion?: unknown
  submitter?: unknown
  verdict?: unknown
  reasonCode?: unknown
  shortReason?: unknown
  sourceCount?: unknown
  unavailableCount?: unknown
}

function statusName(tx: GenLayerTransaction): TransactionStatus {
  if (tx.statusName) return tx.statusName
  const mapped =
    transactionsStatusNumberToName[String(tx.status) as keyof typeof transactionsStatusNumberToName]
  return mapped ?? TransactionStatus.UNINITIALIZED
}

function normalizedStatus(status: TransactionStatus): AdjudicationStatus {
  if (status === TransactionStatus.FINALIZED) return 'finalized'
  if (status === TransactionStatus.ACCEPTED || status === TransactionStatus.READY_TO_FINALIZE)
    return 'accepted'
  if (status === TransactionStatus.UNDETERMINED) return 'undetermined'
  if (status === TransactionStatus.CANCELED) return 'rejected'
  if (
    status === TransactionStatus.LEADER_TIMEOUT ||
    status === TransactionStatus.VALIDATORS_TIMEOUT
  )
    return 'undetermined'
  return status === TransactionStatus.PENDING ? 'submitted' : 'pending'
}

function consensusFailure(result: TransactionResult | undefined): AdjudicationStatus | undefined {
  if (
    result === TransactionResult.DISAGREE ||
    result === TransactionResult.MAJORITY_DISAGREE ||
    result === TransactionResult.FAILURE ||
    result === TransactionResult.DETERMINISTIC_VIOLATION
  )
    return 'rejected'
  if (
    result === TransactionResult.TIMEOUT ||
    result === TransactionResult.NO_MAJORITY ||
    result === TransactionResult.IDLE
  )
    return 'undetermined'
  return undefined
}

function sameArgs(actual: unknown[], expected: AdjudicationWrite): boolean {
  return (
    JSON.stringify(actual) ===
    JSON.stringify([
      expected.claimKey,
      expected.claimText,
      expected.criterionId,
      expected.standardVersion,
      expected.evidenceUrls,
    ])
  )
}

function asMap(value: unknown): Map<unknown, unknown> | undefined {
  return value instanceof Map ? value : undefined
}

export class BradburyVerifier implements GenLayerVerifier {
  private readonly client: VerifierClient

  constructor(client?: VerifierClient) {
    this.client = client ?? (createClient({ chain: BRADBURY_CHAIN }) as VerifierClient)
  }

  async verify(input: AdjudicationWrite): Promise<VerifiedGenLayerAdjudication> {
    const tx = await this.client.getTransaction({ hash: input.txHash as TransactionHash })
    if (tx.recipient?.toLowerCase() !== GENLAYER_CONTRACT.toLowerCase())
      throw new Error('GenLayer transaction targets a different contract')

    const decoded = tx.txDataDecoded
    const callData = decoded && 'callData' in decoded ? asMap(decoded.callData) : undefined
    if (callData?.get('method') !== 'adjudicate')
      throw new Error('GenLayer transaction does not call adjudicate')
    const actualArgs = callData.get('args')
    if (!Array.isArray(actualArgs) || !sameArgs(actualArgs, input))
      throw new Error('GenLayer transaction calldata does not match the consent payload')
    if (!tx.sender) throw new Error('GenLayer transaction sender is unavailable')

    const networkStatus = statusName(tx)
    const status = consensusFailure(tx.resultName) ?? normalizedStatus(networkStatus)
    const executionResult = tx.txExecutionResultName
    if (executionResult === ExecutionResult.FINISHED_WITH_ERROR) {
      return { status: 'error', wallet: tx.sender, networkStatus, executionResult }
    }

    if (status !== 'accepted' && status !== 'finalized') {
      return {
        status,
        wallet: tx.sender,
        networkStatus,
        ...(executionResult ? { executionResult } : {}),
      }
    }
    if (executionResult !== ExecutionResult.FINISHED_WITH_RETURN)
      throw new Error('GenLayer consensus completed without a successful contract execution')

    const stored = (await this.client.readContract({
      address: GENLAYER_CONTRACT,
      functionName: 'get_adjudication',
      args: [input.claimKey],
    })) as StoredResult
    if (
      stored.claimKey !== input.claimKey ||
      stored.criterionId !== input.criterionId ||
      stored.standardVersion !== input.standardVersion ||
      String(stored.submitter).toLowerCase() !== tx.sender.toLowerCase()
    )
      throw new Error('GenLayer contract state does not match the submitted adjudication')
    if (!['SUPPORTED', 'PARTIAL', 'INSUFFICIENT', 'CONTRADICTED'].includes(String(stored.verdict)))
      throw new Error('GenLayer contract returned an unsupported verdict')

    return {
      status,
      wallet: tx.sender,
      networkStatus,
      executionResult,
      verdict: stored.verdict as AdjudicationVerdict,
      reasonCode: String(stored.reasonCode),
      shortReason: String(stored.shortReason),
      sourceCount: Number(stored.sourceCount),
      unavailableCount: Number(stored.unavailableCount),
    }
  }
}

// Deterministic zero-network verifier for unit/Playwright runs only. Production assembly never
// selects it unless both the dev payment gate and ASY_GENLAYER_MODE=fake are explicit.
export class FakeGenLayerVerifier implements GenLayerVerifier {
  private readonly calls = new Map<string, number>()

  async verify(input: AdjudicationWrite): Promise<VerifiedGenLayerAdjudication> {
    const count = (this.calls.get(input.txHash) ?? 0) + 1
    this.calls.set(input.txHash, count)
    const status: AdjudicationStatus =
      count === 1 ? 'pending' : count === 2 ? 'accepted' : 'finalized'
    return {
      status,
      wallet: '0x4444444444444444444444444444444444444444',
      networkStatus: status.toUpperCase(),
      ...(status === 'accepted' || status === 'finalized'
        ? {
            executionResult: ExecutionResult.FINISHED_WITH_RETURN,
            verdict: 'SUPPORTED' as const,
            reasonCode: 'EVIDENCE_SUPPORTS_CLAIM',
            shortReason: 'The approved public fixture supports the selected claim.',
            sourceCount: input.evidenceUrls.length,
            unavailableCount: 0,
          }
        : {}),
    }
  }
}

export function isApprovedPublicEvidenceUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      GENLAYER_EVIDENCE_HOSTS.has(url.hostname.toLowerCase())
    )
  } catch {
    return false
  }
}
