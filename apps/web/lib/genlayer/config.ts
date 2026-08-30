export const GENLAYER = {
  network: 'testnet-bradbury',
  chainId: 4221,
  chainIdHex: '0x107d',
  currency: 'GEN',
  contract: '0xa0A37DEf61d5C621FDeF43b604D8059779D1B96E',
  rpc: 'https://rpc-bradbury.genlayer.com',
  explorer: 'https://explorer-bradbury.genlayer.com',
  standardVersion: 'AS-1.1.0',
} as const

export const CRITERIA = {
  ACTION_AND_OUTCOME: 'The source must support both the claimed action and outcome.',
  QUANTIFIED_OUTCOME: 'The source must support the action and the specific quantified outcome.',
  ROLE_AND_SCOPE: 'The source must support the claimed role, responsibility, and scope.',
  COMPETENCY_DEMONSTRATION:
    'The source must materially demonstrate the competency, not merely mention it.',
} as const
