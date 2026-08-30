import { describe, expect, it, vi } from 'vitest'
import {
  ExecutionResult,
  TransactionResult,
  TransactionStatus,
  type GenLayerTransaction,
} from 'genlayer-js/types'
import { BradburyVerifier, GENLAYER_CONTRACT, type AdjudicationWrite } from './genlayer'

const INPUT: AdjudicationWrite = {
  claimKey: 'DSR-TEST.CLM-1.v1',
  claimText: 'Built the public project and reduced latency by 38%.',
  criterionId: 'ACTION_AND_OUTCOME',
  standardVersion: 'AS-1.1.0',
  evidenceUrls: ['https://github.com/example/public-project'],
  txHash: `0x${'42'.repeat(32)}`,
}

function transaction(overrides: Partial<GenLayerTransaction> = {}): GenLayerTransaction {
  return {
    sender: '0x4444444444444444444444444444444444444444',
    recipient: GENLAYER_CONTRACT,
    statusName: TransactionStatus.FINALIZED,
    txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN,
    txDataDecoded: {
      type: 'call',
      leaderOnly: false,
      callData: new Map<unknown, unknown>([
        ['method', 'adjudicate'],
        [
          'args',
          [
            INPUT.claimKey,
            INPUT.claimText,
            INPUT.criterionId,
            INPUT.standardVersion,
            INPUT.evidenceUrls,
          ],
        ],
      ]),
    },
    ...overrides,
  }
}

function verifier(tx = transaction()) {
  const readContract = vi.fn(async () => ({
    claimKey: INPUT.claimKey,
    criterionId: INPUT.criterionId,
    standardVersion: INPUT.standardVersion,
    submitter: '0x4444444444444444444444444444444444444444',
    verdict: 'SUPPORTED',
    reasonCode: 'EVIDENCE_SUPPORTS_CLAIM',
    shortReason: 'The public source supports it.',
    sourceCount: 1,
    unavailableCount: 0,
  }))
  return {
    verifier: new BradburyVerifier({
      getTransaction: vi.fn(async () => tx),
      readContract,
    }),
    readContract,
  }
}

describe('Bradbury receipt verification', () => {
  it('accepts only exact calldata plus matching finalized contract state', async () => {
    const { verifier: subject, readContract } = verifier()
    await expect(subject.verify(INPUT)).resolves.toMatchObject({
      status: 'finalized',
      verdict: 'SUPPORTED',
      reasonCode: 'EVIDENCE_SUPPORTS_CLAIM',
    })
    expect(readContract).toHaveBeenCalledWith({
      address: GENLAYER_CONTRACT,
      functionName: 'get_adjudication',
      args: [INPUT.claimKey],
    })
  })

  it('rejects a transaction whose consent payload differs by one field', async () => {
    const { verifier: subject } = verifier()
    await expect(subject.verify({ ...INPUT, claimText: 'A different claim.' })).rejects.toThrow(
      'calldata does not match',
    )
  })

  it('rejects writes to any other contract', async () => {
    const { verifier: subject } = verifier(
      transaction({ recipient: '0x5555555555555555555555555555555555555555' }),
    )
    await expect(subject.verify(INPUT)).rejects.toThrow('different contract')
  })

  it('maps validator timeouts to undetermined and never invents a verdict', async () => {
    const { verifier: subject, readContract } = verifier(
      transaction({
        statusName: TransactionStatus.VALIDATORS_TIMEOUT,
        txExecutionResultName: ExecutionResult.NOT_VOTED,
      }),
    )
    await expect(subject.verify(INPUT)).resolves.toEqual({
      status: 'undetermined',
      wallet: '0x4444444444444444444444444444444444444444',
      networkStatus: TransactionStatus.VALIDATORS_TIMEOUT,
      executionResult: ExecutionResult.NOT_VOTED,
    })
    expect(readContract).not.toHaveBeenCalled()
  })

  it('treats a finalized consensus timeout as undetermined and never reads stale contract state', async () => {
    const { verifier: subject, readContract } = verifier(
      transaction({ resultName: TransactionResult.TIMEOUT }),
    )
    await expect(subject.verify(INPUT)).resolves.toMatchObject({
      status: 'undetermined',
      networkStatus: TransactionStatus.FINALIZED,
    })
    expect(readContract).not.toHaveBeenCalled()
  })

  it('treats deterministic validator rejection as rejected even after transaction finality', async () => {
    const { verifier: subject, readContract } = verifier(
      transaction({ resultName: TransactionResult.DETERMINISTIC_VIOLATION }),
    )
    await expect(subject.verify(INPUT)).resolves.toMatchObject({ status: 'rejected' })
    expect(readContract).not.toHaveBeenCalled()
  })

  it('surfaces an unavailable Bradbury RPC without inventing transaction state', async () => {
    const readContract = vi.fn()
    const subject = new BradburyVerifier({
      getTransaction: vi.fn(async () => {
        throw new Error('RPC unavailable')
      }),
      readContract,
    })
    await expect(subject.verify(INPUT)).rejects.toThrow('RPC unavailable')
    expect(readContract).not.toHaveBeenCalled()
  })

  it('maps a canceled transaction to rejected and never reads contract state', async () => {
    const { verifier: subject, readContract } = verifier(
      transaction({
        statusName: TransactionStatus.CANCELED,
        txExecutionResultName: ExecutionResult.NOT_VOTED,
      }),
    )
    await expect(subject.verify(INPUT)).resolves.toMatchObject({ status: 'rejected' })
    expect(readContract).not.toHaveBeenCalled()
  })
})
