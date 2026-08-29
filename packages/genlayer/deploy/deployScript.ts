import { readFileSync } from 'node:fs'
import path from 'node:path'
import type {
  DecodedDeployData,
  GenLayerChain,
  GenLayerClient,
  TransactionHash,
} from 'genlayer-js/types'
import { TransactionStatus } from 'genlayer-js/types'
import { localnet } from 'genlayer-js/chains'

export default async function main(client: GenLayerClient<unknown>) {
  const contractPath = path.resolve(process.cwd(), 'contracts/assay_adjudicator.py')
  const code = new Uint8Array(readFileSync(contractPath))

  await client.initializeConsensusSmartContract()
  const deploymentHash = await client.deployContract({ code, args: [] })
  const receipt = await client.waitForTransactionReceipt({
    hash: deploymentHash as TransactionHash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
  })

  if (
    receipt.statusName !== TransactionStatus.ACCEPTED &&
    receipt.statusName !== TransactionStatus.FINALIZED
  ) {
    throw new Error(`AssayAdjudicator deployment failed with status ${receipt.statusName}`)
  }

  const contractAddress =
    (client.chain as GenLayerChain).id === localnet.id
      ? receipt.data.contract_address
      : (receipt.txDataDecoded as DecodedDeployData | undefined)?.contractAddress

  if (!contractAddress) throw new Error('Deployment receipt did not contain a contract address')
  console.log(`AssayAdjudicator deployed at ${contractAddress}`)
}
