---
'i18n-typed-store': patch
---

Fix a 0.5.0 type regression that broke class- and interface-typed translations.

The traversability guard introduced with the array/function key exclusion used `T extends Record<string, unknown>`, which rejects class instances and interfaces (they have no implicit index signature). `TranslationKeys<M>` collapsed to top-level namespace keys only, so calls like `getTranslationByKey('common.greeting')` stopped compiling whenever the namespace was typed by a translation class — the library's primary documented pattern. The guard now tests `T extends object` (arrays and functions are still excluded), restoring nested dot-path keys for classes and interfaces.

Also fixed alongside: `getTranslation` now resolves methods declared on a translation class prototype (the own-property-only walk missed them). Security guards are unchanged — `__proto__`/`constructor`/`prototype` and `Object.prototype` builtins (`toString`, `valueOf`, …) still never resolve.
