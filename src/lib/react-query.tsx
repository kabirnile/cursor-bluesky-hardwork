import {useEffect, useState} from 'react'
import {AppState, type AppStateStatus} from 'react-native'
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister'
import {
  type DehydrateOptions,
  focusManager,
  onlineManager,
  QueryClient,
} from '@tanstack/react-query'
import {
  type PersistQueryClientOptions,
  PersistQueryClientProvider,
} from '@tanstack/react-query-persist-client'

import {createPersistedQueryStorage} from '#/lib/persisted-query-storage'
import {listenNetworkConfirmed, listenNetworkLost} from '#/state/events'
import {isQueryPersisted} from '#/state/queries/util'
import * as env from '#/env'
import {IS_NATIVE, IS_WEB} from '#/env'

declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__: QueryClient
  }
}

async function checkIsOnline(): Promise<boolean> {
  try {
    const controller = new AbortController()
    setTimeout(() => {
      controller.abort()
    }, 15e3)
    const res = await fetch('https://pds.itsmyturn.online/xrpc/_health', {
      cache: 'no-store',
      signal: controller.signal,
    })
    const json = await res.json()
    if (json.version || res.ok) {
      return true
    } else {
      return false
    }
  } catch (e) {
    return false
  }
}

let receivedNetworkLost = false
let receivedNetworkConfirmed = false
let isNetworkStateUnclear = false

listenNetworkLost(() => {
  receivedNetworkLost = true
  onlineManager.setOnline(false)
})

listenNetworkConfirmed(() => {
  receivedNetworkConfirmed = true
  onlineManager.setOnline(true)
})

let checkPromise: Promise<void> | undefined
function checkIsOnlineIfNeeded() {
  if (checkPromise) {
    return
  }
  receivedNetworkLost = false
  receivedNetworkConfirmed = false
  checkPromise = checkIsOnline().then(nextIsOnline => {
    checkPromise = undefined
    if (nextIsOnline && receivedNetworkLost) {
      isNetworkStateUnclear = true
    }
    if (!nextIsOnline && receivedNetworkConfirmed) {
      isNetworkStateUnclear = true
    }
    if (!isNetworkStateUnclear) {
      onlineManager.setOnline(nextIsOnline)
    }
  })
}

setInterval(() => {
  if (AppState.currentState === 'active') {
    if (!onlineManager.isOnline() || isNetworkStateUnclear) {
      checkIsOnlineIfNeeded()
    }
  }
}, 2000)

focusManager.setEventListener(onFocus => {
  if (IS_NATIVE) {
    const subscription = AppState.addEventListener(
      'change',
      (status: AppStateStatus) => {
        focusManager.setFocused(status === 'active')
      },
    )

    return () => subscription.remove()
  } else if (typeof window !== 'undefined' && window.addEventListener) {
    const handler = () => onFocus()
    window.addEventListener('focus', handler, false)
    window.addEventListener('visibilitychange', handler, false)
    return () => {
      window.removeEventListener('visibilitychange', handler)
      window.removeEventListener('focus', handler)
    }
  }
})

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        structuralSharing: false,
        retry: false,
      },
    },
  })

const dehydrateOptions: DehydrateOptions = {
  shouldDehydrateMutation: (_: any) => false,
  shouldDehydrateQuery: query => {
    return isQueryPersisted(query.queryKey) && query.state.status === 'success'
  },
}

export function QueryProvider({
  children,
  currentDid,
}: {
  children: React.ReactNode
  currentDid: string | undefined
}) {
  return (
    <QueryProviderInner
      key={currentDid}
      currentDid={currentDid}>
      {children}
    </QueryProviderInner>
  )
}

function QueryProviderInner({
  children,
  currentDid,
}: {
  children: React.ReactNode
  currentDid: string | undefined
}) {
  const [initialDid] = useState(currentDid)
  if (currentDid !== initialDid) {
    throw Error(
      'Something is very wrong. Expected did to be stable due to key above.',
    )
  }
  const [queryClient, _setQueryClient] = useState(() => createQueryClient())
  const [persistOptions, _setPersistOptions] = useState(() => {
    const storage = createPersistedQueryStorage(currentDid ?? 'logged-out')
    const asyncPersister = createAsyncStoragePersister({
      storage,
      key: 'queryClient-' + (currentDid ?? 'logged-out'),
    })
    return {
      persister: asyncPersister,
      dehydrateOptions,
      buster: env.APP_VERSION,
    } satisfies Omit<PersistQueryClientOptions, 'queryClient'>
  })
  useEffect(() => {
    if (IS_WEB) {
      // window.__TANSTACK_QUERY_CLIENT__ = queryClient
    }
  }, [queryClient])
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  )
}
