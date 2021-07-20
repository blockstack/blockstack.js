export const validNameRegisterTx = {
  tx_id: '0xc36713ec249eece270b85ab2fad7eadd9277451908b5e8104df80cfef81044aa',
  tx_type: 'contract_call',
  nonce: 1,
  fee_rate: '228',
  sender_address: 'SP39EJJ5BAVJDTVXTYM0CR9KAZ0S26E7YGR9XB71N',
  sponsored: false,
  post_condition_mode: 'deny',
  tx_status: 'success',
  block_hash: '0x0d78a67c97ec9dad25686ff952b645958b4b32fd7c52fce88d92bc2768262f3a',
  block_height: 21169,
  burn_block_time: 1625909134,
  burn_block_time_iso: '2021-07-10T09:25:34.000Z',
  canonical: true,
  tx_index: 2,
  tx_result: {
    hex: '0x0703',
    repr: '(ok true)',
  },
  post_conditions: [],
  contract_call: {
    contract_id: 'SP000000000000000000002Q6VF78.bns',
    function_name: 'name-register',
    function_signature:
      '(define-public (name-register (namespace (buff 20)) (name (buff 48)) (salt (buff 20)) (zonefile-hash (buff 20))))',
    function_args: [
      {
        hex: '0x0200000003627463',
        repr: '0x627463',
        name: 'namespace',
        type: '(buff 20)',
      },
      {
        hex: '0x0200000006616e77616172',
        repr: '0x616e77616172',
        name: 'name',
        type: '(buff 48)',
      },
      {
        hex: '0x020000001420992b4314583968a199cbdc0eb7913512dfb684',
        repr: '0x20992b4314583968a199cbdc0eb7913512dfb684',
        name: 'salt',
        type: '(buff 20)',
      },
      {
        hex: '0x0200000014d5bc76f71d4d765f2bddcab0abca61895de0731c',
        repr: '0xd5bc76f71d4d765f2bddcab0abca61895de0731c',
        name: 'zonefile-hash',
        type: '(buff 20)',
      },
    ],
  },
  events: [
    {
      event_index: 0,
      event_type: 'non_fungible_token_asset',
      asset: {
        asset_event_type: 'mint',
        asset_id: 'SP000000000000000000002Q6VF78.bns::names',
        sender: '',
        recipient: 'SP39EJJ5BAVJDTVXTYM0CR9KAZ0S26E7YGR9XB71N',
        value: {
          hex: '0x0c00000002046e616d650200000006616e77616172096e616d6573706163650200000003627463',
          repr: '(tuple (name 0x616e77616172) (namespace 0x627463))',
        },
      },
    },
    {
      event_index: 1,
      event_type: 'smart_contract_log',
      contract_log: {
        contract_id: 'SP000000000000000000002Q6VF78.bns',
        topic: 'print',
        value: {
          hex: '0x0c000000010a6174746163686d656e740c00000003106174746163686d656e742d696e646578010000000000000000000000000000396304686173680200000014d5bc76f71d4d765f2bddcab0abca61895de0731c086d657461646174610c00000004046e616d650200000006616e77616172096e616d6573706163650200000003627463026f700d0000000d6e616d652d72656769737465720974782d73656e6465720516d2e948ab56e4dd6fbaf500cc266af8322338fe86',
          repr: '(tuple (attachment (tuple (attachment-index u14691) (hash 0xd5bc76f71d4d765f2bddcab0abca61895de0731c) (metadata (tuple (name 0x616e77616172) (namespace 0x627463) (op "name-register") (tx-sender SP39EJJ5BAVJDTVXTYM0CR9KAZ0S26E7YGR9XB71N))))))',
        },
      },
    },
  ],
  event_count: 2,
}

export const validNameUpdateTx = {
  tx_id: '0xfe0d919bb2bbaf57daf5a262b086f09ee071ae88c4721c2aedc712044a395e0f',
  tx_type: 'contract_call',
  nonce: 1,
  fee_rate: '208',
  sender_address: 'SP35QWBX9002RRSCXMWAN9360FQ42K2YK1J7WB8WF',
  sponsored: false,
  post_condition_mode: 'deny',
  tx_status: 'success',
  block_hash: '0xe94b064222819fc4ef4bf4ba9bf5ee3247f4512d19c86c1e378d551bb936c80c',
  block_height: 21178,
  burn_block_time: 1625912652,
  burn_block_time_iso: '2021-07-10T10:24:12.000Z',
  canonical: true,
  tx_index: 3,
  tx_result: {
    hex: '0x0703',
    repr: '(ok true)',
  },
  post_conditions: [],
  contract_call: {
    contract_id: 'SP000000000000000000002Q6VF78.bns',
    function_name: 'name-update',
    function_signature:
      '(define-public (name-update (namespace (buff 20)) (name (buff 48)) (zonefile-hash (buff 20))))',
    function_args: [
      {
        hex: '0x0200000003627463',
        repr: '0x627463',
        name: 'namespace',
        type: '(buff 20)',
      },
      {
        hex: '0x020000000d6372656469742d737569737365',
        repr: '0x6372656469742d737569737365',
        name: 'name',
        type: '(buff 48)',
      },
      {
        hex: '0x02000000140bca2efa91e1771850f8b3536bfb08a603c38906',
        repr: '0x0bca2efa91e1771850f8b3536bfb08a603c38906',
        name: 'zonefile-hash',
        type: '(buff 20)',
      },
    ],
  },
  events: [
    {
      event_index: 0,
      event_type: 'smart_contract_log',
      contract_log: {
        contract_id: 'SP000000000000000000002Q6VF78.bns',
        topic: 'print',
        value: {
          hex: '0x0c000000010a6174746163686d656e740c00000003106174746163686d656e742d696e6465780100000000000000000000000000003967046861736802000000140bca2efa91e1771850f8b3536bfb08a603c38906086d657461646174610c00000004046e616d65020000000d6372656469742d737569737365096e616d6573706163650200000003627463026f700d0000000b6e616d652d7570646174650974782d73656e6465720516cb7e2fa900058c659da715548cc07dc8298bd30c',
          repr: '(tuple (attachment (tuple (attachment-index u14695) (hash 0x0bca2efa91e1771850f8b3536bfb08a603c38906) (metadata (tuple (name 0x6372656469742d737569737365) (namespace 0x627463) (op "name-update") (tx-sender SP35QWBX9002RRSCXMWAN9360FQ42K2YK1J7WB8WF))))))',
        },
      },
    },
  ],
  event_count: 1,
}
