---
'i18n-typed-store': minor
---

Add store-level `preloadLocale` and atomic `changeLocaleAsync` operations with
optional namespace scopes, exact per-locale error state, aggregate namespace
failures, and observable namespace-state invalidations. Locale matching,
concurrent-load ordering, cache cleanup, and falsy translation values are now
handled consistently. Superseded or partially failed transitions remain in the
raw cache and cannot replace safely published `currentTranslation` pointers.
Default `getTranslation`/`getTranslationOrThrow` lookups use that safe view;
passing a locale explicitly continues to read its raw cache slot.

Add `getTranslationOrThrow` and `TranslationMissingError` for callers that
prefer a clean translation value type and an explicit failure on missing data.

`TranslationStore` now includes discriminated locale-transition metadata
(including the effective cache policy for atomic commits) and the
`subscribeTranslationState` subscription API. `currentTranslation` and
`currentLocale` are the safely activated view, while per-locale cache slots
expose raw results; loading an off-selected locale no longer replaces the
current pointer. Stores created by `createTranslationStore` require no
migration; structural mocks and custom adapters must implement the new members.
