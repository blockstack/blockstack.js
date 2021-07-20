import { StacksNetwork } from '@stacks/network'
import { FutureInstance, reject, resolve } from 'fluture'
import { Either } from 'monet'

export const stripHexPrefixIfPresent = (data: string) => {
  if (data.startsWith('0x')) return data.substr(2)

  return data
}

export const getApiUrl = (network: StacksNetwork): string => {
  //@ts-ignore The accessor is defined, but not recognized by typescript for some odd reason
  return network.coreApiUrl
}

// Helper DEV functions, used to simplify / increase the redability of the code

export const createRejectedFuture = <R, F>(rejectWith: R): FutureInstance<R, F> => {
  return reject(rejectWith) as FutureInstance<R, F>
}

export const eitherToFuture = <L, R>(either: Either<L, R>): FutureInstance<L, R> => {
  return either.fold(v => createRejectedFuture<L, R>(v), resolve)
}

export const debug =
  (prefix: string) =>
  <T>(arg: T): T => {
    console.log(prefix && prefix + '-', arg)
    return arg
  }
