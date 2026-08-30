'use client'

import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import {
  transactionsStatusNumberToName,
  type TransactionHash,
  type TransactionResult,
  type TransactionStatus,
} from 'genlayer-js/types'
import type { AdjudicationCriterion } from '../studio'
import { GENLAYER } from './config'

type ClientChain = NonNullable<NonNullable<Parameters<typeof createClient>[0]>['chain']>
const BRADBURY_CHAIN = testnetBradbury as unknown as ClientChain

export interface ConsentPayload {
  claimKey: string
  claimText: string
  criterionId: AdjudicationCriterion
  evidenceUrls: string[]
}

export interface WalletSnapshot {
  address: `0x${string}` | null
  chainId: number | null
}

export interface TrackedTransaction {
  status: string
  executionResult?: string
  consensusResult?: TransactionResult
}

export interface GenLayerBrowserClient {
  inspectWallet(): Promise<WalletSnapshot>
  connectWallet(): Promise<WalletSnapshot>
  switchToBradbury(address: `0x${string}`): Promise<void>
  writeAdjudication(address: `0x${string}`, payload: ConsentPayload): Promise<`0x${string}`>
  getTransaction(txHash: `0x${string}`): Promise<TrackedTransaction>
}

interface EthereumLike {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>
}

interface MockClient extends GenLayerBrowserClient {}

declare global {
  interface Window {
    ethereum?: EthereumLike
    __ASSAY_GENLAYER_MOCK__?: MockClient
  }
}

function ethereum(): EthereumLike {
  if (!window.ethereum) throw new Error('MetaMask is required to adjudicate on GenLayer')
  return window.ethereum
}

function mock(): MockClient | undefined {
  return window.location.hostname === '127.0.0.1' ? window.__ASSAY_GENLAYER_MOCK__ : undefined
}

function addressOf(value: unknown): `0x${string}` | null {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
    ? (value as `0x${string}`)
    : null
}

function realClient(): GenLayerBrowserClient {
  return {
    async inspectWallet() {
      const provider = ethereum()
      const [accounts, chain] = await Promise.all([
        provider.request({ method: 'eth_accounts' }),
        provider.request({ method: 'eth_chainId' }),
      ])
      return {
        address: addressOf(Array.isArray(accounts) ? accounts[0] : null),
        chainId: typeof chain === 'string' ? Number.parseInt(chain, 16) : null,
      }
    },
    async connectWallet() {
      const provider = ethereum()
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      const chain = await provider.request({ method: 'eth_chainId' })
      const address = addressOf(Array.isArray(accounts) ? accounts[0] : null)
      if (!address) throw new Error('the wallet did not return an account')
      return {
        address,
        chainId: typeof chain === 'string' ? Number.parseInt(chain, 16) : null,
      }
    },
    async switchToBradbury(address) {
      const provider = ethereum()
      const client = createClient({
        chain: BRADBURY_CHAIN,
        account: address,
        provider: provider as NonNullable<Parameters<typeof createClient>[0]>['provider'],
      })
      // Current GenLayerJS adds/switches Bradbury and requests the GenLayer MetaMask Snap.
      await client.connect('testnetBradbury')
    },
    async writeAdjudication(address, payload) {
      const provider = ethereum()
      const client = createClient({
        chain: BRADBURY_CHAIN,
        account: address,
        provider: provider as NonNullable<Parameters<typeof createClient>[0]>['provider'],
      })
      return (await client.writeContract({
        address: GENLAYER.contract,
        functionName: 'adjudicate',
        args: [
          payload.claimKey,
          payload.claimText,
          payload.criterionId,
          GENLAYER.standardVersion,
          payload.evidenceUrls,
        ],
        value: 0n,
      })) as `0x${string}`
    },
    async getTransaction(txHash) {
      const client = createClient({ chain: BRADBURY_CHAIN })
      const tx = await client.getTransaction({ hash: txHash as TransactionHash })
      const status =
        tx.statusName ??
        transactionsStatusNumberToName[
          String(tx.status) as keyof typeof transactionsStatusNumberToName
        ] ??
        ('UNINITIALIZED' as TransactionStatus)
      return {
        status,
        ...(tx.txExecutionResultName ? { executionResult: tx.txExecutionResultName } : {}),
        ...(tx.resultName ? { consensusResult: tx.resultName } : {}),
      }
    },
  }
}

export function genLayerBrowserClient(): GenLayerBrowserClient {
  return mock() ?? realClient()
}

export function savePendingLinkage(
  dossierId: string,
  value: ConsentPayload & { claimId: string; txHash: `0x${string}` },
): void {
  localStorage.setItem(`assay:genlayer:${dossierId}:${value.claimId}`, JSON.stringify(value))
}

export function readPendingLinkage(
  dossierId: string,
  claimId: string,
): (ConsentPayload & { claimId: string; txHash: `0x${string}` }) | null {
  try {
    const raw = localStorage.getItem(`assay:genlayer:${dossierId}:${claimId}`)
    return raw
      ? (JSON.parse(raw) as ConsentPayload & { claimId: string; txHash: `0x${string}` })
      : null
  } catch {
    return null
  }
}
