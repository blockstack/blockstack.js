import BN = require('bn.js')
import { PriceFunction } from '@stacks/bns'

export const priceFunction: PriceFunction = {
  base: new BN(1),
  coefficient: new BN(1),
  b1: new BN(1),
  b2: new BN(2),
  b3: new BN(3),
  b4: new BN(4),
  b5: new BN(5),
  b6: new BN(6),
  b7: new BN(7),
  b8: new BN(8),
  b9: new BN(9),
  b10: new BN(10),
  b11: new BN(11),
  b12: new BN(12),
  b13: new BN(13),
  b14: new BN(14),
  b15: new BN(15),
  b16: new BN(16),
  nonAlphaDiscount: new BN(0),
  noVowelDiscount: new BN(0),
}

export const lifetime = new BN(10000)

export const STX_TO_BURN = new BN(300000000000000)
