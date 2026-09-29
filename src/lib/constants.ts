import {type Insets, Platform} from 'react-native'
import {type Service} from '@atproto/lex'
import {api} from '@bsky/sdk'

import {BLUESKY_PROXY_DID, CHAT_PROXY_DID, IS_DEV} from '#/env'
import {type app} from '#/lexicons'

export const LOCAL_DEV_SERVICE =
  Platform.OS === 'android' ? 'http://10.0.2.2:2583' : 'http://localhost:2583'
export const STAGING_SERVICE = 'https://staging.itsmyturn.online'

// --- PRIMARY BRAND AUTHENTICATION & PDS ---
export const BSKY_SERVICE = 'https://pds.itsmyturn.online'
export const BSKY_SERVICE_DID = 'did:web:pds.itsmyturn.online'
export const DEFAULT_SERVICE = BSKY_SERVICE

// Public AppView endpoint for resolving read queries (runs in the background)
export const PUBLIC_BSKY_SERVICE = 'https://public.api.bsky.app'
export const PUBLIC_APPVIEW = 'https://public.api.bsky.app'
export const PUBLIC_APPVIEW_DID = 'did:web:api.bsky.app'
export const PUBLIC_STAGING_APPVIEW_DID = 'did:web:api.bsky.app'
export const DEV_ENV_APPVIEW = `http://localhost:2584`

// Brand Web & Help Links
export const HELP_DESK_URL = `https://itsmyturn.online/support`
export const BSKY_DOWNLOAD_URL = 'https://itsmyturn.online/download'
export const STATUS_PAGE_URL = 'https://status.itsmyturn.online'
export const EMBED_SERVICE = 'https://embed.itsmyturn.online'
export const EMBED_SCRIPT = `${EMBED_SERVICE}/static/embed.js`

// Background Service Endpoints (Invisible to end users)
export const CHAT_SERVICE = 'https://api.bsky.chat'
export const GIF_SERVICE = 'https://gifs.bsky.app'
export const VIDEO_SERVICE = 'https://video.bsky.app'
export const VIDEO_SERVICE_DID = 'did:web:video.bsky.app'

export const STARTER_PACK_DEFAULT_SIZE = 150
export const STARTER_PACK_MAX_SIZE = 500
export const CARD_ASPECT_RATIO = 1200 / 630
export const JOINED_THIS_WEEK = 1200

export const DISCOVER_DEBUG_DIDS: Record<string, true> = {}

const BASE_FEEDBACK_FORM_URL = `${HELP_DESK_URL}/requests/new`
export function FEEDBACK_FORM_URL({
  email,
  handle,
}: {
  email?: string
  handle?: string
}): string {
  let str = BASE_FEEDBACK_FORM_URL
  if (email) {
    str += `?tf_anonymous_requester_email=${encodeURIComponent(email)}`
    if (handle) {
      str += `&tf_17205412673421=${encodeURIComponent(handle)}`
    }
  }
  return str
}

export const MAX_DISPLAY_NAME = 64
export const MAX_DESCRIPTION = 256
export const MAX_GRAPHEME_LENGTH = 300
export const MAX_DRAFT_GRAPHEME_LENGTH = 1000
export const MAX_DM_GRAPHEME_LENGTH = 1000
export const MAX_GROUP_NAME_GRAPHEME_LENGTH = 50
export const MAX_ALT_TEXT = 2000
export const MAX_REPORT_REASON_GRAPHEME_LENGTH = 2000

export function IS_TEST_USER(handle?: string) {
  return handle && handle?.endsWith('.test')
}

export function IS_PROD_SERVICE(url?: string) {
  return url && url !== STAGING_SERVICE && !url.startsWith(LOCAL_DEV_SERVICE)
}

// Proxies
export const STAGING_LINK_META_PROXY =
  'https://cardyb.staging.bsky.dev/v1/extract?url='
export const PROD_LINK_META_PROXY = 'https://cardyb.bsky.app/v1/extract?url='

export function LINK_META_PROXY(_serviceUrl: string) {
  if (IS_DEV) {
    return STAGING_LINK_META_PROXY
  }
  return PROD_LINK_META_PROXY
}

// Hitslop Constants
export const createHitslop = (size: number): Insets => ({
  top: size,
  left: size,
  bottom: size,
  right: size,
})
export const HITSLOP_10 = createHitslop(10)
export const HITSLOP_20 = createHitslop(20)
export const HITSLOP_30 = createHitslop(30)
export const LANG_DROPDOWN_HITSLOP = {top: 10, bottom: 10, left: 4, right: 4}
export const BACK_HITSLOP = HITSLOP_30
export const MAX_POST_LINES = 25

// --- FEEDS & TIMELINES ---
// Pinned timeline: Users only see who they follow
export const TIMELINE_SAVED_FEED = {
  type: 'timeline',
  value: 'following',
  pinned: true,
}

export const RECOMMENDED_SAVED_FEEDS: Pick<
  app.bsky.actor.defs.SavedFeed,
  'type' | 'value' | 'pinned'
>[] = [TIMELINE_SAVED_FEED]

export const KNOWN_SHUTDOWN_FEEDS: string[] = []

export const GIF_KLIPY_SEARCH = (params: string) =>
  `${GIF_SERVICE}/klipy/v2/search?${params}`
export const GIF_KLIPY_FEATURED = (params: string) =>
  `${GIF_SERVICE}/klipy/v2/featured?${params}`

export const MAX_LABELERS = 20

export const VIDEO_MAX_DURATION_MS = 10 * 60 * 1000 // 10 minutes
export const VIDEO_MAX_SIZE_MB = 300
export const VIDEO_MAX_SIZE = VIDEO_MAX_SIZE_MB * 1000 * 1000

export const SUPPORTED_MIME_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/webm',
  'video/quicktime',
  'image/gif',
] as const

export type SupportedMimeTypes = (typeof SUPPORTED_MIME_TYPES)[number]

export const EMOJI_REACTION_LIMIT = 5

export const urls = {
  website: {
    blog: {
      findFriendsAnnouncement: 'https://itsmyturn.online/blog/find-friends',
      initialVerificationAnnouncement: 'https://itsmyturn.online/blog/verification',
      searchTipsAndTricks: 'https://itsmyturn.online/blog/search',
    },
    support: {
      findFriendsPrivacyPolicy: 'https://itsmyturn.online/support/find-friends-privacy-policy',
    },
  },
}

export const BLUESKY_PROXY_HEADER = {
  value: `${BLUESKY_PROXY_DID}#bsky_appview`,
  get() {
    return this.value as Service
  },
  set(value: string) {
    this.value = value
  },
}

export const CHAT_PROXY_SERVICE: Service = `${CHAT_PROXY_DID}#bsky_chat`
export const MOD_PROXY_SERVICE: Service = `${api.moderation.did}#atproto_labeler`
export const NOTIF_SERVICE: Service = `${BLUESKY_PROXY_DID}#bsky_notif`

export const webLinks = {
  tos: `https://itsmyturn.online/tos`,
  privacy: `https://itsmyturn.online/privacy`,
  community: `https://itsmyturn.online/community-guidelines`,
  communityDeprecated: `https://itsmyturn.online/community-guidelines`,
}
