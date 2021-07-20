import { Either } from 'monet'
import { buildResolve } from './resolver'
import { StacksDID } from './types'
import { parseStacksDID, encodeStacksDid } from './utils'
export { buildResolve }

// Default DID resolution function configured for resolving DIDs against the Stacks V2 main network.
export const resolve = buildResolve()

export const utils = {
  parseStacksDID: (did: string) => throwIfLeft(parseStacksDID(did)),
  encodeStacksDid: (did: StacksDID) => throwIfLeft(encodeStacksDid(did)),
}

const throwIfLeft = <L extends Error, R>(either: Either<L, R>): R => {
  if (either.isLeft()) {
    throw either.left()
  }
  return either.right()
}
