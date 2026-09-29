import {useState} from 'react'
import {type DidDocument, getPdsEndpoint} from '@atproto/common-web'
import {type HandleString} from '@atproto/syntax'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {DEFAULT_SERVICE} from '#/lib/constants'
import {useDebouncedValue} from '#/lib/hooks/useDebouncedValue'
import {isNetworkError} from '#/lib/strings/errors'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {getPublicAppviewClient} from '#/state/session/clients'
import {com} from '#/lexicons'

const RQKEY_ROOT = 'pds-detection'
export const RQKEY = (identifier: string) => [RQKEY_ROOT, identifier]

/**
 * Normalize a login identifier for detection: lowercase, trim, and strip a
 * single leading `@`.
 */
function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase().replace(/^@/, '')
}

/**
 * Per-request timeout for identity/PDS resolution network calls.
 */
const RESOLVE_TIMEOUT = 20e3

/**
 * Run a resolution network op with a per-request timeout.
 */
async function withResolveTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT)
  try {
    return await run(controller.signal)
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('Network request failed: resolution timed out')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Check if HTTP status indicates transient error.
 */
function isTransientHttpStatus(status: number): boolean {
  return status >= 500 || status === 429
}

/**
 * Resolve a DID document without a session.
 */
async function resolveDidDoc(
  did: string,
  signal?: AbortSignal,
): Promise<DidDocument | null> {
  if (did.startsWith('did:plc:')) {
    const res = await fetch(`https://plc.directory/${did}`, {signal})
    if (!res.ok) {
      logger.debug('pds-detection: plc.directory returned non-ok status', {
        did,
        status: res.status,
      })
      if (isTransientHttpStatus(res.status)) {
        throw new Error(
          `Network request failed: plc.directory returned ${res.status}`,
        )
      }
      return null
    }
    return (await res.json()) as DidDocument
  }
  if (did.startsWith('did:web:')) {
    const domain = did.slice('did:web:'.length)
    if (domain.includes(':')) return null
    const res = await fetch(
      `https://${decodeURIComponent(domain)}/.well-known/did.json`,
      {signal},
    )
    if (!res.ok) {
      logger.debug(
        'pds-detection: did:web .well-known returned non-ok status',
        {
          did,
          status: res.status,
        },
      )
      if (isTransientHttpStatus(res.status)) {
        throw new Error(
          `Network request failed: did:web .well-known returned ${res.status}`,
        )
      }
      return null
    }
    return (await res.json()) as DidDocument
  }
  logger.debug('pds-detection: unsupported DID method', {did})
  return null
}

/**
 * Resolve the identity behind a given identifier (handle or DID).
 * Enforces lock to the custom PDS instance.
 */
export async function resolvePdsForIdentifier(
  identifier: string,
): Promise<{did: string; pdsUrl: string | null} | null> {
  const norm = normalizeIdentifier(identifier)
  const client = getPublicAppviewClient()
  try {
    let did: string
    if (norm.startsWith('did:')) {
      did = norm
    } else {
      const handle = norm.includes('.') ? norm : `${norm}.itsmyturn.online`
      const data = await withResolveTimeout(signal =>
        client.call(
          com.atproto.identity.resolveHandle,
          {handle: handle as HandleString},
          {signal},
        ),
      )
      did = data.did
    }
    logger.debug('pds-detection: resolved identifier to DID', {
      identifier: norm,
      did,
    })
    const doc = await withResolveTimeout(signal => resolveDidDoc(did, signal))
    logger.debug('pds-detection: resolved DID doc', {
      did,
      foundDoc: !!doc,
    })
    return {did, pdsUrl: DEFAULT_SERVICE}
  } catch (err) {
    logger.debug('pds-detection: resolution failed, defaulting to local PDS', {
      identifier: norm,
      error: String(err),
      isNetworkError: isNetworkError(err),
    })
    if (isNetworkError(err)) throw err
    return {did: norm, pdsUrl: DEFAULT_SERVICE}
  }
}

export type HostingProviderState =
  | {status: 'idle'}
  | {status: 'email'}
  | {status: 'detecting'}
  | {status: 'detected'; pdsUrl: string}
  | {status: 'unresolved'}
  | {status: 'error'}
  | {status: 'overridden'; pdsUrl: string}

/**
 * Locks the hosting provider to your custom instance.
 */
export function useHostingProvider({
  identifier,
  defaultService = DEFAULT_SERVICE,
}: {
  identifier: string
  defaultService?: string
}): {
  state: HostingProviderState
  service: string
  override: (url: string) => void
  clearOverride: () => void
  resolveService: (
    currentIdentifier: string,
  ) => Promise<{service: string; did: string | null}>
} {
  const queryClient = useQueryClient()
  const [override, setOverride] = useState<string | null>(null)

  const normalized = normalizeIdentifier(identifier)
  const isEmail = normalized.includes('@')
  const isPlausibleHandle =
    !!normalized &&
    !isEmail &&
    (normalized.includes('.') || normalized.startsWith('did:'))

  const debounced = useDebouncedValue(normalized, 500)
  const enabled = isPlausibleHandle && normalized === debounced

  const query = useQuery({
    enabled,
    queryKey: RQKEY(debounced),
    queryFn: () => resolvePdsForIdentifier(debounced),
    staleTime: STALE.MINUTES.FIVE,
  })

  let state: HostingProviderState
  if (override != null) {
    state = {status: 'overridden', pdsUrl: DEFAULT_SERVICE}
  } else if (isEmail) {
    state = {status: 'email'}
  } else if (!isPlausibleHandle) {
    state = {status: 'idle'}
  } else if (normalized !== debounced) {
    state = {status: 'detecting'}
  } else if (query.isPending || query.isFetching) {
    state = {status: 'detecting'}
  } else if (query.isError && isNetworkError(query.error)) {
    state = {status: 'error'}
  } else if (query.isError || query.data == null) {
    state = {status: 'detected', pdsUrl: DEFAULT_SERVICE}
  } else {
    state = {status: 'detected', pdsUrl: DEFAULT_SERVICE}
  }

  const service = DEFAULT_SERVICE

  return {
    state,
    service,
    override: (_url: string) => setOverride(DEFAULT_SERVICE),
    clearOverride: () => setOverride(null),
    resolveService: async (currentIdentifier: string) => {
      const norm = normalizeIdentifier(currentIdentifier)
      if (norm.includes('@') || (!norm.includes('.') && !norm.startsWith('did:'))) {
        return {service: DEFAULT_SERVICE, did: null}
      }
      try {
        const resolved = await queryClient.ensureQueryData({
          queryKey: RQKEY(norm),
          queryFn: () => resolvePdsForIdentifier(norm),
          staleTime: STALE.MINUTES.FIVE,
        })
        return {
          service: DEFAULT_SERVICE,
          did: resolved?.did ?? null,
        }
      } catch {
        return {
          service: DEFAULT_SERVICE,
          did: null,
        }
      }
    },
  }
}
