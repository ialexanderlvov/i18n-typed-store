---
'i18n-typed-store': minor
'i18n-typed-store-react': minor
'i18n-typed-store-nest': minor
---

Audit fixes across all packages.

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
