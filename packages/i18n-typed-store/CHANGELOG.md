# i18n-typed-store

## 0.5.1

### Patch Changes

- fd828cc: Fix a 0.5.0 type regression that broke class- and interface-typed translations.

    The traversability guard introduced with the array/function key exclusion used `T extends Record<string, unknown>`, which rejects class instances and interfaces (they have no implicit index signature). `TranslationKeys<M>` collapsed to top-level namespace keys only, so calls like `getTranslationByKey('common.greeting')` stopped compiling whenever the namespace was typed by a translation class — the library's primary documented pattern. The guard now tests `T extends object` (arrays and functions are still excluded), restoring nested dot-path keys for classes and interfaces.

    Also fixed alongside: `getTranslation` now resolves methods declared on a translation class prototype (the own-property-only walk missed them). Security guards are unchanged — `__proto__`/`constructor`/`prototype` and `Object.prototype` builtins (`toString`, `valueOf`, …) still never resolve.

## 0.5.0

### Minor Changes

- 1bdac11: Audit fixes across all packages.

    **Core (`i18n-typed-store`)**

    - `getTranslation` return type is now `GetTranslationValue<M, Key> | Key`, reflecting that the key string is returned on a miss (previously an unsound type that could hand a string to callers expecting a number/object/function).
    - `TranslationKeys` / `GetTranslationValue` no longer treat arrays and functions as traversable objects, so array/function members (`items.length`, `items.map`, `items.0`, …) are no longer offered as valid keys.
    - `smartDeepMerge`: fallback keys named like `Object.prototype` members (`toString`, `valueOf`, …) are now copied (`hasOwnProperty` instead of the prototype-walking `in`); an own `__proto__` on the _current_ object can no longer survive into the merged result.
    - `createPluralSelector` strict mode now accepts an empty-string `other` variant (presence check instead of truthiness).
    - `deleteOtherLocalesAfterLoad` no longer wipes the freshly-loaded fallback locale (which caused reload churn / potential data loss).
    - `EventEmitter.emit` isolates listeners: one throwing listener no longer aborts the others or the emit caller (the error is re-surfaced asynchronously).
    - `findBestLocaleMatch` parses each available locale key once instead of re-parsing per candidate.

    **React (`i18n-typed-store-react`)**

    - The bundle now ships a `"use client"` directive, fixing crashes in the Next.js App Router / React Server Components.
    - `useI18nTranslationLazy` in `'once'` mode no longer returns stale, wrong-locale data after a locale switch; it suspends for the active locale instead (and degrades gracefully on load errors to avoid retry loops).
    - `I18nTypedStoreProvider` memoizes its context value to avoid re-rendering all consumers on every parent render.
    - `react-dom` removed from `peerDependencies` (it is not used at runtime).
    - SSR docs/JSDoc now warn that the store must be created per request to avoid cross-request locale bleed; broken README subpath imports were corrected to root imports.

    **NestJS (`i18n-typed-store-nest`)**

    - `I18nService.getTranslation` / `getTranslationByKey` no longer crash when given a BCP 47 locale that resolves to a different store key (e.g. `'en-US'` → `'en'`); locales are resolved to a real store key before indexing.
    - `I18nModule` preload uses `Promise.allSettled` (with warnings) so a single failing translation file no longer crashes application bootstrap.
    - Added `I18nModule.forRootAsync` for factory/async configuration (e.g. from `ConfigService`).
    - The interceptor no longer clobbers a per-request locale already set upstream (e.g. by a guard).
    - `express` is now an optional peer dependency with a widened range (`^4 || ^5`); `@nestjs/common` / `@nestjs/core` peers widened to `^10 || ^11`; the `express` `Request` augmentation marks `i18nService` optional.

    All packages gained `sideEffects: false`, `engines`, `publishConfig`, and corrected repository/homepage/bugs metadata.

- 1bdac11: Production-readiness release: concurrency fixes, new formatting APIs, RSC-safe React entrypoints, request-safe NestJS service.

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

> Release notes are managed with [Changesets](https://github.com/changesets/changesets); each
> published version's entry is appended below automatically. Until the first release, see the
> [commit history](https://github.com/ialexanderlvov/i18n-typed-store/commits/main) for changes.
