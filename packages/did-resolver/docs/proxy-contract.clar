; Calls the resolve-principal function at block height 1 after the BNS contract was deployed, but before any other BNS names were registered
; The BNS contract address passed to contract-call? as the first argument will differ accross the mainnet / testnet deployments
; Deployed at SPPJE6KB9CNCVTS9RAFHY1RSXAH381W8RKJDM9J9.BNS-migrated-helper on mainnet
; Deployed at STPJE6KB9CNCVTS9RAFHY1RSXAH381W8RJQV1YCB.BNS-migrated-helper on testnet

(define-read-only (get-migrated-names (owner principal))
  (at-block (unwrap-panic (get-block-info? id-header-hash u1)) (contract-call? 'ST000000000000000000002AMW42H.bns resolve-principal owner))
)
