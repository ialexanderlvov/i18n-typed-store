---
'i18n-typed-store-nest': minor
---

Add `I18nService.getTranslationByKeyOrThrow`, which preserves the exact
translation value type and throws `TranslationMissingError` when a key cannot
be resolved. The Nest package now also type-checks its tests as part of the
release gate. Its `i18n-typed-store` peer dependency now requires `>=0.6.0 <1`,
the first core release that exports the strict helper. NestJS 12 is now
included in the supported peer range and compatibility test environment.
