/**
 * `@evinvest/sites-tools` — the core. Pure: no React, no Next, no `node:*`, so
 * the proxy (edge), a client island and a server module can all import it.
 * Runtime-bound halves live on their own subpaths.
 */

export {
  assertLaunchable,
  bakedPlace,
  cardFact,
  contactOf,
  defineSite,
  messengerFacts,
  ogLocaleOf,
  openLaunchBlockers,
  perLocale,
  type BrandFacts,
  type LegacyRedirect,
  type OwnerTodo,
  type PageSuffix,
  type Site,
  type SiteConfig,
  type Topology,
} from "./core/site";

export {
  createPlaceView,
  DEFAULT_TIME_ZONE,
  freshRating,
  isOpenAt,
  nextOpening,
  parseInstant,
  isPublished,
  mergeLive,
  placeHref,
  placeOrigin,
  placeUrl,
  publicationGaps,
  RATING_MAX_AGE_DAYS,
  servedLocalities,
  SERVICE_AREA_GATE,
  siteOrigin,
  STOREFRONT_GATE,
  storefrontOf,
  type DayOfWeek,
  type Geo,
  type LinkBase,
  type MessengerSwitches,
  type LinkMode,
  type Opening,
  type OpeningHours,
  type OriginFacts,
  type Place,
  type PlaceView,
  type PostalAddress,
  type Presence,
  type PublicationField,
  type PublicationPolicy,
  type Rating,
  type ServiceArea,
} from "./core/place/index";

export {
  createRouting,
  GONE,
  GONE_HEADER,
  gonePath,
  goneHeader,
  HOST_MARK,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  NON_PAGE_ROUTES,
  parseGoneHeader,
  parsePlaceParam,
  PASS_PATHS,
  placeParam,
  pointSuffixes,
  THANKS,
  type Decision,
  type RequestFacts,
  type Routing,
} from "./core/routing";

export {
  CARD_FIELD,
  CARD_ID,
  CHANNEL_FIELD,
  channelOf,
  CONSENT_FIELD,
  isMessengerChannel,
  LEAD_ERROR_PARAM,
  LEAD_CARD_PARAM,
  leadErrorFor,
  leadErrorOf,
  LEAD_SCHEMA_VERSION,
  MAX_CONSENT,
  MAX_FIELD,
  readCandidate,
  rejectionOf,
  suspectOf,
  SUBMISSION_FIELD,
  SUBMISSION_ID,
  validateCallbackLead,
  validateCandidate,
  validateLead,
  type Lead,
  type LeadCandidate,
  type LeadError,
  type PageLeadError,
  type LeadConsent,
  type MessengerChannel,
  type LeadExtra,
  type LeadPrice,
  type LeadRejection,
  type LeadSchema,
  type LeadStore,
  type LeadVerdict,
  type LeadWire,
  type SpamVerdict,
} from "./core/lead";


export { answeredUnknown, CENTS_BUCKETS, centsBucket, ESTIMATE_FIELD_PREFIX, ESTIMATE_UNKNOWN, estimateField, flowOf, labelOf, readEstimateInputs, type LeadFlows } from "./core/pricing/index";

export { flowTextOf, LEAD_CAPTURE_TEXT, type LeadCaptureFlowText, type LeadCaptureText } from "./core/lead-capture-text";
export { LEAD_CAPTURE_MESSENGER_TEXT, messengerTextOf, type LeadCaptureMessengerText } from "./core/messenger-text";
export {
  channelsAvailable,
  MESSAGE_REF,
  MESSAGE_REF_FIELD,
  MESSAGE_REF_PREFIX,
  messageRefOf,
  newMessageRef,
  TELEGRAM_BOT,
  telegramHref,
  type ChannelsAvailable,
  type MessengerFacts,
  type MessengerKind,
  type MessengerMode,
  type MessengerVariant,
  type RandomBytes,
} from "./core/messenger";
export { MAX_MESSENGER_MESSAGE, messengerMessage, type MessengerMessageInput, type MessengerMessageText } from "./core/messenger-message";
export { fillText, formatCents, openingText } from "./core/lead-capture-format";

export {
  channelHref,
  isMobilePhone,
  resolveChannels,
  smsHref,
  type CaptureChannel,
  type ChannelFacts,
  type ChannelOptions,
  type ResolvedChannels,
} from "./core/channels";

export {
  checkTiming,
  HONEYPOT_FIELD,
  LEGACY_HONEYPOT_FIELDS,
  MIN_FILL_MS,
  RATE_LIMIT_MAX_KEYS,
  RateLimiter,
  RENDERED_AT_FIELD,
  screen,
  type Screening,
} from "./core/antispam";

export {
  createAcceptLead,
  ANALYTICS_ID_FIELD,
  CHANNELS_FIELD,
  EXPERIMENT_FIELD,
  FORM_ID_FIELD,
  leadRef,
  LOCALE_FIELD,
  LOCATION_FIELD,
  PRICE_CHANGED,
  SHOWN_CENTS_FIELD,
  submitTagsOf,
  VARIANT_FIELD,
  type AcceptDeps,
  type Outcome,
  type SubmitTags,
} from "./core/accept";

export {
  areaServedNodes,
  breadcrumbNode,
  businessId,
  businessNode,
  faqPageNode,
  offerNodes,
  organizationId,
  organizationNode,
  placeGraph,
  websiteId,
  type OfferInput,
  type PageGraphCopy,
  type QuestionAnswer,
} from "./core/seo/ld";

export {
  AI_CRAWLERS,
  ogImageUrl,
  robotsFor,
  sitemapFor,
  type RobotsFile,
  type RobotsRule,
  type SitemapEntry,
} from "./core/seo/sitemap";

export {
  ALLOWED_PROPS,
  ANALYTICS_ID,
  analyticsSink,
  channelsProps,
  countsAsPageView,
  EVENTS,
  EXPERIMENT_SLUG,
  experimentProps,
  qaVisit,
  type AnalyticsTarget,
  type IntentChannel,
  type LeadField,
  type LeadStep,
} from "./core/analytics";

export {
  AB_COOKIE_PREFIX,
  AB_FORCE_PARAM,
  abAssignments,
  abRunning,
  abReset,
  abVariantUrl,
  cookieValue,
  type AbReset,
} from "./core/ab-switcher";
export { abSwitcherVisible } from "./core/ab-gate";

export type {
  CallBarText,
  CopySlice,
  CoreText,
  PageMetaCopy,
  QuoteFormCopy,
  Said,
  StatusAction,
  StatusCopy,
  StatusScreenText,
} from "./core/content";


export { BOOKING_EXPERIMENT, bookingHref, bookingOf, DEFAULT_BOOKING, type BookingChoice, type BookingPrefill, type OpenBookingConfig } from "./core/booking/index";

// The site ↔ panel contract, as a brand needs it beside the machinery.
export {
  BOOKING_LIMITS,
  BOOKING_PROVIDERS,
  BOOKING_STATUSES,
  bookingRequested,
  checkBookingConfig,
  checkBookingUrl,
  checkPlaceLive,
  checkPricingModel,
  DAY_PARTS,
  DAYS,
  isBookingProvider,
  isLeadRef,
  isPageProvider,
  LEAD_FLOWS,
  mulBp,
  normalizePhone,
  phoneProblem,
  priceOf,
  PRICING_CURRENCY,
  PRICING_FORMAT,
  PRICING_LIMITS,
  roundTo,
  SITE_CHANNELS,
  type AddOption,
  type BookingConfig,
  type BookingProblem,
  type BookingProvider,
  type BookingRequested,
  type BookingStatus,
  type DayPart,
  type DiscountOption,
  type LeadFlow,
  type LeadSuspect,
  type MultiplyOption,
  type NeedPricing,
  type PageProvider,
  type PlaceLive,
  type PlaceProblem,
  type Price,
  type PriceLine,
  type PricingInput,
  type PricingInputKind,
  type PricingInputs,
  type PricingLabels,
  type PricingModel,
  type PricingProblem,
  type SiteChannel,
} from "@evinvest/sites-contract";

export { brandStatusTarget, statusTarget, thanksChannel, thanksSuffix, type StatusTarget } from "./core/status";

// A landing needs these beside the machinery; re-exported by name so a brand
// imports one package and the list here is the whole surface.
export { createLocaleRegistry, type LocaleRegistry } from "@evinvest/i18n";
export { ldCompact, localBusiness, type JsonLdNode } from "@evinvest/marketing";
export { contactChannel, telHref, whatsappHref, type ContactChannel } from "./core/contact";
export { createBeaconSink, noopSink, type AnalyticsSink } from "@evinvest/analytics";
