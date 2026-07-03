---
'i18n-typed-store': minor
'i18n-typed-store-react': minor
'i18n-typed-store-nest': minor
---

Production-readiness release: concurrency fixes, new formatting APIs, RSC-safe React entrypoints, request-safe NestJS service.

**Core (`i18n-typed-store`)**

Fixes:

- Fixed a critical race where the fallback prefetch and `load(fallbackLocale)` shared one `loadingPromise` with incompatible post-conditions: a deduplicated `load(fallbackLocale)` could resolve successfully while the underlying fetch had failed (errors were swallowed), and never updated `currentTranslation`/`currentLocale`. Deduplicated loads now propagate failures and always make the result current.
- `deleteOtherLocalesAfterLoad` no longer wipes a locale that a concurrent `load()` has just fetched (stale finishers skip cleanup; in-flight locales are never deleted).
- A synchronous throw from `loadModule` no longer leaves a permanently rejected promise in the `loadingPromise` slot (retries were impossible).
- Cache hits now reset a stale `isError` flag left by a previously failed load.
- `changeLocale` now synchronously points each namespace's `currentTranslation` at the new locale when it is already cached (previously stale translations were served until the next `load()`).
- `getTranslation` now resolves BCP 47 locale tags (`'en-US'` → `'en'`) the same way `load`/`changeLocale` do; its `locale` parameter is now `string | keyof L`.
- `parseLocale` no longer treats a 3-letter subtag as a region (BCP 47 regions are 2 letters or 3 digits).

Features:

- `interpolate()` — type-safe `{{placeholder}}` substitution with compile-time parameter checking derived from the template literal type.
- `createIntlFormatters(locale)` — cached, locale-bound `Intl` helpers: `number`, `currency`, `percent`, `date`, `time`, `dateTime`, `relativeTime`, `list`.
- `createPluralSelector` now accepts `intlOptions` (passed to `Intl.PluralRules`) enabling ordinal plurals (`{ type: 'ordinal' }`) and fraction-aware selection.
- `onMissingKey` store option — reports keys that `getTranslation` fails to resolve.
- `smartDeepMerge` and `EventEmitter` are now exported.

Publication: per-condition type declarations (`.d.mts`/`.d.cts`-style) in the `exports` map, `./package.json` subpath export, Node engines floor raised to `>=20` (Node 18 is EOL).

**React (`i18n-typed-store-react`)**

- `useI18nTranslation`/`useI18nTranslationLazy` reworked onto `useSyncExternalStore` — eliminates tearing under concurrent rendering and missed updates between render and subscription.
- New `i18n-typed-store-react/server` entrypoint exposes `getLocaleFromRequest`/`initializeStore`/`parseAcceptLanguage` without the `"use client"` directive, making them callable from React Server Components and `getServerSideProps`.
- `useI18nTranslationLazy` no longer returns `undefined` (against its declared type) when the first load fails — the load error is thrown to the nearest error boundary.
- `suspenseMode: 'once'` now matches its documentation: suspends only until the first data arrives; later locale switches render the previous translation while loading in the background.
- `Safe` no longer swallows thrown promises (Suspense signals) as errors.
- `parseAcceptLanguage`/`getLocaleFromRequest` use proper BCP 47 matching (no more `startsWith` false positives) and survive malformed `q=` values.
- `react` peer range is now `^18.0.0 || ^19.0.0`.

**NestJS (`i18n-typed-store-nest`)**

- Fixed a critical cross-request locale race: `getCurrentTranslation`/`loadTranslation` read the store's shared `currentTranslation` slot, which any concurrent request could overwrite — they now resolve through the request's AsyncLocalStorage locale to the per-locale cache slot.
- The global interceptor no longer crashes GraphQL/WS/RPC requests (`context.getType()` is respected; non-HTTP contexts degrade gracefully) and can be disabled via `useGlobalInterceptor: false`.
- Locale detection from query/cookie/route/header now uses BCP 47 best-match against the store's locales (`?locale=ru-RU` matches `ru`; case differences no longer drop valid locales).
- `@Translation()` no longer turns a missing translation file into a 500 — it resolves to `undefined` as documented.
- Configurable locale resolvers: `resolvers: ['query', 'route', 'cookie', 'header']` order, including custom resolver functions.
- `@I18nLang` alias for `@Locale`; `defaultLocale` is validated against the store's locales at configuration time.
- `i18n-typed-store` moved from `dependencies` to `peerDependencies` (prevents duplicated core copies with incompatible types).

**Infrastructure**

- GitHub Actions CI (build/test/lint/format on Node 20/22/24) and automated changesets releases to npm with provenance.
