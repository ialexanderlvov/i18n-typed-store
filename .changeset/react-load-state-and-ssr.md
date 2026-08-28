---
'i18n-typed-store-react': minor
---

Add `useI18nTranslationState`, atomic `setLocaleAsync`, and a provider-level
load-error policy. Translation hooks now observe core load events, preserve
atomic locale commits, handle forced refreshes and unusual rejection values,
and report `Safe` failures only after commit.

Configured-locale setters are type-safe again. Use `setLocaleFromTag` and
`setLocaleFromTagAsync` when the input is an arbitrary BCP 47 string; async
setters can limit an atomic transition to selected namespaces.

SSR locale detection now infers literal locale unions on TypeScript 4.9+,
accepts real framework request shapes, and applies validated
`Accept-Language` quality, wildcard, exclusion, and BCP 47 fallback rules.
The `/server` declaration subpath resolves under legacy Node module resolution.
SSR utilities, including `parseAcceptLanguage`, now live exclusively in that
server entry so they are not bundled behind the root entry's `"use client"`
directive. Import existing root-level SSR usages from
`i18n-typed-store-react/server` instead. Core helpers remain available from
both entries.

When `availableLocales` is a literal tuple, `defaultLocale` must now be one of
that tuple's values. Narrow or validate a dynamic default before passing it, or
use a widened `readonly string[]` when compile-time membership is unavailable.
