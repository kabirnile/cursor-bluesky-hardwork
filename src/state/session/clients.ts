import {type Agent, type Client, type Service} from '@atproto/lex'
import {type PasswordSession} from '@atproto/lex-password-session'

import {
  PUBLIC_APPVIEW_DID,
  PUBLIC_BSKY_SERVICE,
} from '#/lib/constants'
import {createLexClient} from '#/lib/lexClient'
import {networkAwareFetch} from './network'

/**
 * Custom AppView proxy header pointing strictly to your infrastructure.
 */
const LOCAL_APPVIEW_PROXY_SERVICE: Service = `${PUBLIC_APPVIEW_DID}#bsky_appview` as Service
const LOCAL_CHAT_PROXY_SERVICE: Service = `${PUBLIC_APPVIEW_DID}#bsky_chat` as Service

/**
 * Build the signed-in appview {@link Client}.
 * Proxies calls to your own server instead of the public network.
 */
export function buildAppviewClient(agent: Agent): Client {
  return createLexClient(agent, {
    service: LOCAL_APPVIEW_PROXY_SERVICE,
    includeDeviceSessionHeaders: true,
  })
}

/**
 * Build the signed-in account-host {@link Client}.
 * No service proxy header: com.atproto.* calls reach your PDS directly.
 */
export function buildPdsClient(agent: Agent): Client {
  return createLexClient(agent, {appLabelers: null})
}

/**
 * Build the signed-in chat {@link Client}.
 * Proxies chat calls strictly within your domain infrastructure.
 */
export function buildChatClient(agent: Agent): Client {
  return createLexClient(agent, {
    service: LOCAL_CHAT_PROXY_SERVICE,
    includeDeviceSessionHeaders: true,
  })
}

/**
 * Wrap a session so requests resolve against a known PDS while auth and refresh
 * stay with the session.
 */
export function routeSessionToPds(
  session: PasswordSession,
  pdsUrl: string,
): Agent {
  return {
    get did() {
      return session.did
    },
    fetchHandler(path, init) {
      return session.fetchHandler(new URL(path, pdsUrl).href, init)
    },
  }
}

/** Thrown when a write/auth-only client is used with no active session. */
export class NotAuthenticatedError extends Error {
  constructor(op = 'this operation') {
    super(`Not authenticated: ${op} requires an active session`)
    this.name = 'NotAuthenticatedError'
  }
}

let unauthedClient: Client | undefined

/**
 * A {@link Client} that throws {@link NotAuthenticatedError} on any request,
 * before any network I/O.
 */
export function getUnauthenticatedThrowingClient(): Client {
  return (unauthedClient ??= createLexClient({
    did: undefined,
    fetchHandler: () => {
      throw new NotAuthenticatedError()
    },
  }))
}

let publicLexClient: Client | undefined

/**
 * The unauthenticated {@link Client} for public reads, pointed at your custom
 * service endpoint.
 */
export function getPublicAppviewClient(): Client {
  return (publicLexClient ??= createLexClient(
    {
      service: PUBLIC_BSKY_SERVICE,
      fetch: networkAwareFetch,
    },
    {includeDeviceSessionHeaders: true},
  ))
}
