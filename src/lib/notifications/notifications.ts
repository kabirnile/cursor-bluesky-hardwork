import {useCallback, useEffect} from 'react'
import {Platform} from 'react-native'
import * as Notifications from 'expo-notifications'
import {getBadgeCountAsync, setBadgeCountAsync} from 'expo-notifications'
import {type Client} from '@atproto/lex'
import BackgroundNotificationHandler from '@bsky.app/expo-background-notification-handler'
import debounce from 'lodash.debounce'

import {
  NOTIF_SERVICE,
  PUBLIC_APPVIEW_DID,
  PUBLIC_STAGING_APPVIEW_DID,
} from '#/lib/constants'
import {logger as notyLogger} from '#/lib/notifications/util'
import {isNetworkError} from '#/lib/strings/errors'
import {type SessionAccount, usePdsClient, useSession} from '#/state/session'
import {useAgeAssurance} from '#/ageAssurance'
import {useAnalytics} from '#/analytics'
import {IS_DEV, IS_NATIVE} from '#/env'
import {app} from '#/lexicons'

/**
 * A resumed single-use account client paired with the account's service origin
 * and handle. Produced by `createTemporaryClientsAndResume` (session util) and
 * consumed by {@link unregisterPushToken}, which needs the service host to pick
 * the appview DID and the handle for a debug log line without reaching into the
 * session internals.
 */
export type TemporaryPushClient = {
  client: Client
  service: string
  handle: string
}

/**
 * @private
 * Registers the device's push notification token with the service.
 */
async function _registerPushToken({
  client,
  currentAccount,
  token,
  extra = {},
}: {
  client: Client
  currentAccount: SessionAccount
  token: Notifications.DevicePushToken
  extra?: {
    ageRestricted?: boolean
  }
}) {
  try {
    const payload: app.bsky.notification.registerPush.$InputBody = {
      serviceDid: currentAccount.service?.includes('staging')
        ? PUBLIC_STAGING_APPVIEW_DID
        : PUBLIC_APPVIEW_DID,
      platform: Platform.OS,
      token: token.data,
      appId: 'online.itsmyturn.app',
      ageRestricted: extra.ageRestricted ?? false,
    }

    notyLogger.debug(`registerPushToken: registering`, {...payload})

    await client.call(app.bsky.notification.registerPush, payload, {
      service: NOTIF_SERVICE,
    })

    notyLogger.debug(`registerPushToken: success`)
  } catch (error) {
    if (!isNetworkError(error)) {
      notyLogger.warn(`registerPushToken: failed`, {safeMessage: error})
    }
  }
}

/**
 * @private
 * Debounced version of `_registerPushToken` to prevent multiple calls.
 */
const _registerPushTokenDebounced = debounce(_registerPushToken, 100)

/**
 * Hook to register the device's push notification token. If
 * the user is not logged in, this will do nothing.
 */
export function useRegisterPushToken() {
  const client = usePdsClient()
  const {currentAccount} = useSession()

  return useCallback(
    ({
      token,
      isAgeRestricted,
    }: {
      token: Notifications.DevicePushToken
      isAgeRestricted: boolean
    }) => {
      if (!currentAccount) return
      return _registerPushTokenDebounced({
        client,
        currentAccount,
        token,
        extra: {
          ageRestricted: isAgeRestricted,
        },
      })
    },
    [client, currentAccount],
  )
}

/**
 * Retrieve the device's push notification token, if permissions are granted.
 */
async function getPushToken() {
  const granted = (await Notifications.getPermissionsAsync()).granted
  notyLogger.debug(`getPushToken`, {granted})
  if (granted) {
    try {
      return await Notifications.getDevicePushTokenAsync()
    } catch (error) {
      notyLogger.debug(`getPushToken: failed`, {safeMessage: error})
    }
  }
}

/**
 * Hook to get the device push token and register it with the server.
 */
export function useGetAndRegisterPushToken() {
  const aa = useAgeAssurance()
  const registerPushToken = useRegisterPushToken()
  return useCallback(
    async ({
      isAgeRestricted: isAgeRestrictedOverride,
    }: {
      isAgeRestricted?: boolean
    } = {}) => {
      if (!IS_NATIVE || IS_DEV) return

      const token = await getPushToken()

      notyLogger.debug(`useGetAndRegisterPushToken`, {
        token: token ?? 'undefined',
      })

      if (token) {
        registerPushToken({
          token,
          isAgeRestricted:
            isAgeRestrictedOverride ?? aa.state.access !== aa.Access.Full,
        })
      }

      return token
    },
    [registerPushToken, aa],
  )
}

/**
 * Hook to register the device's push notification token, as well as
 * listen for push token updates, should they occur.
 */
export function useNotificationsRegistration() {
  const {currentAccount} = useSession()
  const registerPushToken = useRegisterPushToken()
  const getAndRegisterPushToken = useGetAndRegisterPushToken()
  const aa = useAgeAssurance()

  useEffect(() => {
    if (!currentAccount) return

    notyLogger.debug(`useNotificationsRegistration`)

    getAndRegisterPushToken()

    const subscription = Notifications.addPushTokenListener(async token => {
      registerPushToken({
        token,
        isAgeRestricted: aa.state.access !== aa.Access.Full,
      })
      notyLogger.debug(`addPushTokenListener callback`, {token})
    })

    return () => {
      subscription.remove()
    }
  }, [currentAccount, getAndRegisterPushToken, registerPushToken, aa])
}

let hasRequestedPermissionsThisSession = false

export function useRequestNotificationsPermission() {
  const ax = useAnalytics()
  const {currentAccount} = useSession()
  const getAndRegisterPushToken = useGetAndRegisterPushToken()

  return async (
    context: 'StartOnboarding' | 'AfterOnboarding' | 'Login' | 'Home',
  ) => {
    const permissions = await Notifications.getPermissionsAsync()

    if (
      !IS_NATIVE ||
      permissions?.status === 'granted' ||
      (permissions?.status === 'denied' && !permissions.canAskAgain)
    ) {
      return
    }
    if (context === 'AfterOnboarding') {
      return
    }
    if (context === 'Home' && !currentAccount) {
      return
    }

    if (hasRequestedPermissionsThisSession) {
      return
    }
    hasRequestedPermissionsThisSession = true

    const res = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        provideAppNotificationSettings: true,
      },
    })

    ax.metric(`notifications:request`, {
      context: context,
      status: res.status,
    })

    if (res.granted) {
      if (currentAccount) {
        getAndRegisterPushToken()
      } else {
        getPushToken()
      }
    }
  }
}

export async function decrementBadgeCount(by: number) {
  if (!IS_NATIVE) return

  let count = await getBadgeCountAsync()
  count -= by
  if (count < 0) {
    count = 0
  }

  await BackgroundNotificationHandler.setBadgeCountAsync(count)
  await setBadgeCountAsync(count)
}

export async function resetBadgeCount() {
  await BackgroundNotificationHandler.setBadgeCountAsync(0)
  await setBadgeCountAsync(0)
}

export async function unregisterPushToken(clients: TemporaryPushClient[]) {
  if (!IS_NATIVE) return

  try {
    const token = await getPushToken()
    if (token) {
      for (const {client, service, handle} of clients) {
        await client.call(
          app.bsky.notification.unregisterPush,
          {
            serviceDid: service.includes('staging')
              ? PUBLIC_STAGING_APPVIEW_DID
              : PUBLIC_APPVIEW_DID,
            platform: Platform.OS,
            token: token.data,
            appId: 'online.itsmyturn.app',
          },
          {
            service: NOTIF_SERVICE,
          },
        )
        notyLogger.debug(`Push token unregistered for ${handle}`)
      }
    } else {
      notyLogger.debug('Tried to unregister push token, but could not find one')
    }
  } catch (error) {
    notyLogger.debug('Failed to unregister push token', {message: error})
  }
}
