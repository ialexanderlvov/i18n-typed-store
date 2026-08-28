# i18n-typed-store

[![npm version](https://img.shields.io/npm/v/i18n-typed-store.svg)](https://www.npmjs.com/package/i18n-typed-store)
[![CI](https://github.com/ialexanderlvov/i18n-typed-store/actions/workflows/ci.yml/badge.svg)](https://github.com/ialexanderlvov/i18n-typed-store/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/i18n-typed-store.svg)](https://github.com/ialexanderlvov/i18n-typed-store/blob/main/LICENSE)

> ⚠️ **WARNING: The library API is under active development and may change significantly between versions. Use exact versions in package.json and carefully read the changelog when updating.**

Type-safe translation store for managing i18n locales with full TypeScript support. A lightweight, zero-dependency library for handling internationalization with compile-time type safety. Designed to work with TypeScript classes or objects for translations, providing full IDE support (go-to definition, autocomplete).

## Features

- ✅ **Full TypeScript support** - Complete type safety for translations and locales
- ✅ **IDE integration** - Go-to definition, autocomplete, and refactoring support with translation classes/objects
- ✅ **Lazy loading** - Load translations only when needed
- ✅ **Type-safe API** - Compile-time validation of translation keys and locales
- ✅ **Translation classes/objects** - Use TypeScript classes or objects for translations
- ✅ **Pluralization support** - Built-in plural form selector using `Intl.PluralRules` (cardinal and ordinal)
- ✅ **Type-safe interpolation** - `{{placeholder}}` substitution with compile-time parameter checking
- ✅ **Intl formatters** - Locale-aware number/currency/date/relative-time/list formatting helpers
- ✅ **Flexible module loading** - Support for any module format (ESM, CommonJS, dynamic imports)
- ✅ **Zero runtime dependencies** - Lightweight and framework-agnostic
- ✅ **Fallback locales** - Automatic merging with fallback translations
- ✅ **Caching** - Built-in translation caching for better performance
- ✅ **Missing key reporting** - `onMissingKey` hook for logging/monitoring
- ✅ **Atomic locale transitions** - Load the requested namespaces before committing a locale
- ✅ **Event system** - Listen to locale changes and namespace load-state updates
- ✅ **BCP 47 locale support** - Advanced locale matching and parsing

## Installation

```bash
npm install i18n-typed-store
```

```bash
yarn add i18n-typed-store
```

```bash
pnpm add i18n-typed-store
```

## Quick Start

### Basic Usage

```typescript
import { createTranslationStore } from 'i18n-typed-store';

// Import translation types for type safety
import type CommonTranslationsEn from './translations/common/en';
import type ErrorsTranslationsEn from './translations/errors/en';

// Define your namespace keys
const namespaces = {
	common: 'common',
	errors: 'errors',
} as const;

// Define your locales
const locales = {
	en: 'en',
	ru: 'ru',
} as const;

// Define your translation data structure using imported types
interface TranslationData extends Record<keyof typeof namespaces, any> {
	common: CommonTranslationsEn;
	errors: ErrorsTranslationsEn;
}

// Create the store factory
const storeFactory = createTranslationStore({
	namespaces,
	locales,
	loadModule: async (locale, namespace) => {
		// Load translation class/object dynamically
		return await import(`./translations/${namespace}/${locale}.ts`);
	},
	extractTranslation: (module) => {
		// Extract translation from module (could be class instance, object, etc.)
		return module.default ?? module;
	},
	defaultLocale: 'en',
	useFallback: true,
	fallbackLocale: 'en',
});

// Create typed store
const store = storeFactory.type<TranslationData>();

// Load and use translations
await store.translations.common.load('en');
const title = store.translations.common.currentTranslation?.title; // Type-safe access with IDE go-to support

// Change locale
store.changeLocale('ru');
await store.translations.common.load('ru');

// Listen to locale changes
store.addChangeLocaleListener((locale) => {
	console.log('Locale changed to:', locale);
});
```

### Using `getTranslation` Helper

```typescript
import { createTranslationStore, getTranslation } from 'i18n-typed-store';

const store = createTranslationStore({...}).type<{
  common: {
    greeting: string;
    count: number;
    buttons: { save: string; cancel: string };
  };
}>();

await store.translations.common.load('en');

// Get entire namespace object
const common = getTranslation(store, 'common');
// Returns: { greeting: string, count: number, buttons: { save: string; cancel: string } }

// Get specific value
const greeting = getTranslation(store, 'common.greeting');
// Returns: string ("Hello")
// TypeScript infers type: string

const saveButton = getTranslation(store, 'common.buttons.save');
// Returns: string ("Save")

// ❌ TypeScript error: 'invalidKey' doesn't exist
// const invalid = getTranslation(store, 'common.invalidKey');
```

## Core API

### `createTranslationStore`

Creates a type-safe translation store with lazy loading support.

```typescript
function createTranslationStore<T, L, Module>(options: {
	namespaces: T;
	locales: L;
	loadModule: (locale: keyof L, namespace: keyof T) => Promise<Module>;
	extractTranslation: (module: Module, locale: keyof L, namespace: keyof T) => unknown | Promise<unknown>;
	defaultLocale: keyof L;
	useFallback?: boolean;
	fallbackLocale?: keyof L;
	deleteOtherLocalesAfterLoad?: boolean;
	loadFromCache?: boolean;
	changeLocaleEventName?: string;
}): {
	type<M extends { [K in keyof T]: any }>(): TranslationStore<T, L, M>;
};
```

**Options:**

- `namespaces` - Object with namespace keys (e.g., `{ common: 'common', errors: 'errors' }`)
- `locales` - Object with locale keys (e.g., `{ en: 'en', ru: 'ru' }`)
- `loadModule` - Async function to load a translation module
- `extractTranslation` - Function to extract translation data from the loaded module. Receives the module, locale, and namespace key as parameters
- `defaultLocale` - Default locale key to use
- `useFallback` - Whether to use fallback locale for missing translations (default: `false`)
- `fallbackLocale` - Fallback locale key (default: `defaultLocale`)
- `deleteOtherLocalesAfterLoad` - Whether to delete translations for other locales after loading (default: `false`)
- `loadFromCache` - Whether to load translations from cache by default (default: `true`)
- `changeLocaleEventName` - Event name for locale change events (default: `'change-locale'`)
- `onMissingKey` - Optional handler `(key, locale) => void` called by `getTranslation` when a key cannot be resolved

**Returns:** Object with `type<M>()` method that creates a typed store. `M` must
define every registered namespace; broader mapping types remain supported for
backwards compatibility.

**Example:**

```typescript
import type CommonTranslationsEn from './translations/common/en';

const namespaces = { common: 'common' } as const;

const storeFactory = createTranslationStore({
	namespaces,
	locales: { en: 'en', ru: 'ru' },
	loadModule: async (locale, namespace) => {
		return await import(`./translations/${namespace}/${locale}.ts`);
	},
	extractTranslation: (module) => module.default ?? module,
	defaultLocale: 'en',
	useFallback: true,
	fallbackLocale: 'en',
});

interface TranslationData extends Record<keyof typeof namespaces, any> {
	common: CommonTranslationsEn;
}

const store = storeFactory.type<TranslationData>();

// Load translation
await store.translations.common.load('en');

// Access translation (type-safe with IDE go-to support)
const title = store.translations.common.currentTranslation?.title;

// Change locale
store.changeLocale('ru');
await store.translations.common.load('ru');
```

### `createTranslationModuleMap`

Creates a map of translation module loaders for all combinations of namespaces and locales.

```typescript
function createTranslationModuleMap<T, L, Module>(
	namespaces: T,
	locales: L,
	loadModule: (locale: keyof L, namespace: keyof T) => Promise<Module>,
): Record<keyof T, Record<keyof L, () => Promise<Module>>>;
```

**Example:**

```typescript
const moduleMap = createTranslationModuleMap({ common: 'common' }, { en: 'en', ru: 'ru' }, async (locale, namespace) => {
	return await import(`./translations/${namespace}/${locale}.ts`);
});

// Access loader
const loader = moduleMap.common.en;
const module = await loader();
```

### `createPluralSelector`

Creates a plural form selector function for a specific locale using `Intl.PluralRules`.

```typescript
function createPluralSelector(
	locale: string,
	options?: { strict?: boolean; intlOptions?: Intl.PluralRulesOptions },
): (count: number, variants: PluralVariants) => string;
```

Pass `intlOptions: { type: 'ordinal' }` for ordinal selection (1st/2nd/3rd), or fraction-digit options for fraction-aware cardinal selection — see [Ordinal plurals](#ordinal-plurals).

**Example:**

```typescript
import { createPluralSelector } from 'i18n-typed-store';
import type { PluralVariants } from 'i18n-typed-store';

const selectPlural = createPluralSelector('en');

const variants: PluralVariants = {
	one: 'item',
	other: 'items',
};

selectPlural(1, variants); // => 'item'
selectPlural(5, variants); // => 'items'
```

**Russian example:**

```typescript
const selectPlural = createPluralSelector('ru');

const variants: PluralVariants = {
	one: 'яблоко',
	few: 'яблока',
	many: 'яблок',
	other: 'яблок',
};

selectPlural(1, variants); // => 'яблоко'
selectPlural(2, variants); // => 'яблока'
selectPlural(5, variants); // => 'яблок'
```

### `getTranslation`

Gets a translation value by key from the translation store. The key can be in the format `"namespace"` (returns entire namespace object), `"namespace.key"` or `"namespace.nested.key"`.

```typescript
function getTranslation<N, L, M, Key extends TranslationKeys<M>>(
	store: TranslationStore<N, L, M>,
	key: Key,
	locale?: string | keyof L,
): GetTranslationValue<M, Key> | Key;
```

> **Read semantics:** without `locale`, the helper reads the safely activated `currentTranslation` for `store.currentLocale`, so a partial or failed atomic refresh cannot leak through the default lookup. Passing `locale` explicitly reads that locale's raw cache slot; this is useful for request-scoped server reads and cache inspection. BCP 47 tags resolve the same way `load`/`changeLocale` do (`'en-US'` → `'en'`), and an unmatched tag falls back to `store.currentLocale`.
>
> **Miss behavior:** if the chosen namespace is not loaded or the path does not resolve, `getTranslation` returns the **key string itself** (hence the `| Key` in the return type) and invokes the store's `onMissingKey` handler if one is configured.

**Example:**

```typescript
import { getTranslation } from 'i18n-typed-store';

const store = createTranslationStore({...}).type<{
  common: {
    greeting: string;
    buttons: { save: string; cancel: string };
  };
}>();

await store.translations.common.load('en');

// Get entire namespace
const common = getTranslation(store, 'common');

// Get specific key
const greeting = getTranslation(store, 'common.greeting'); // string

// Get nested key
const saveButton = getTranslation(store, 'common.buttons.save'); // string

// With locale
const greetingRu = getTranslation(store, 'common.greeting', 'ru');

// With a BCP 47 tag — resolves to the best matching locale
const greetingUs = getTranslation(store, 'common.greeting', 'en-US'); // uses 'en'
```

### `getTranslationOrThrow`

Strict variant of `getTranslation`: returns the value with a **clean type** (no `| Key` union) and throws `TranslationMissingError` when the key cannot be resolved. Use it when the translation is expected to be loaded — object values can be used directly without `typeof` narrowing:

```typescript
import { getTranslationOrThrow, TranslationMissingError } from 'i18n-typed-store';

await store.translations.common.load('en');

const message = getTranslationOrThrow(store, 'common.message');
message.title; // ✅ object access without narrowing

try {
	getTranslationOrThrow(store, 'common.missing' as never);
} catch (error) {
	if (error instanceof TranslationMissingError) {
		console.error(`Missing: ${error.key} (${error.locale})`);
	}
}
```

The `onMissingKey` handler (if configured) fires before the throw, so monitoring stays consistent with `getTranslation`.

### `interpolate`

Type-safe `{{placeholder}}` substitution. For literal templates, the required parameters are derived from the template string type — a missing or misspelled parameter is a **compile-time error**.

```typescript
import { interpolate } from 'i18n-typed-store';

interpolate('Hello {{name}}!', { name: 'Alex' });
// => 'Hello Alex!'

interpolate('{{count}} of {{ total }} done', { count: 3, total: 10 });
// => '3 of 10 done'

interpolate('No placeholders'); // no params needed
// => 'No placeholders'

// ❌ TypeScript error: 'name' is required by the template
// interpolate('Hello {{name}}!', {});
```

Unknown placeholders are left in the output verbatim (`{{name}}` is easier to spot in the UI than a silently dropped value). Use it inside translation modules for dynamic strings:

```typescript
// translations/common/en.ts
import { interpolate } from 'i18n-typed-store';

export default class CommonTranslationsEn {
	welcome = (name: string) => interpolate('Welcome back, {{name}}!', { name });
}
```

### `createIntlFormatters`

Locale-bound, cached formatting helpers built on the standard `Intl` APIs — numbers, currency, percent, dates, times, relative time, and lists:

```typescript
import { createIntlFormatters } from 'i18n-typed-store';

const fmt = createIntlFormatters('en');

fmt.number(1234.5); // => '1,234.5'
fmt.currency(9.99, 'USD'); // => '$9.99'
fmt.percent(0.42); // => '42%'
fmt.date(new Date('2026-01-15')); // => 'Jan 15, 2026'
fmt.time(new Date()); // => '2:30 PM'
fmt.dateTime(new Date()); // => 'Jan 15, 2026, 2:30 PM'
fmt.relativeTime(-1, 'day'); // => '1 day ago'
fmt.list(['a', 'b', 'c']); // => 'a, b, and c'
```

Formatter instances are cached per options object, so calling these in render paths is cheap. The idiomatic pattern is one `createIntlFormatters(locale)` per translation module:

```typescript
// translations/cart/ru.ts
import { createIntlFormatters } from 'i18n-typed-store';

const fmt = createIntlFormatters('ru');

export default class CartTranslationsRu {
	total = (amount: number) => `Итого: ${fmt.currency(amount, 'RUB')}`;
	updated = (minutesAgo: number) => `Обновлено ${fmt.relativeTime(-minutesAgo, 'minute')}`;
}
```

### `onMissingKey`

Report missing translations to logging/monitoring. The handler fires whenever `getTranslation` fails to resolve a key and returns the key string instead:

```typescript
const storeFactory = createTranslationStore({
	// ...
	onMissingKey: (key, locale) => {
		console.warn(`[i18n] missing translation: ${locale}:${key}`);
	},
});
```

### Locale Utilities

The library provides utilities for working with BCP 47 locale tags:

#### `parseLocale`

Parses a BCP 47 locale tag into its components.

```typescript
function parseLocale(locale: string): ParsedLocale;
```

**Example:**

```typescript
import { parseLocale } from 'i18n-typed-store';

parseLocale('en'); // { language: 'en', original: 'en' }
parseLocale('ru-RU'); // { language: 'ru', region: 'RU', original: 'ru-RU' }
parseLocale('zh-Hans-CN'); // { language: 'zh', script: 'Hans', region: 'CN', original: 'zh-Hans-CN' }
```

#### `generateLocaleCandidates`

Generates locale fallback candidates in order of preference.

```typescript
function generateLocaleCandidates(locale: string): string[];
```

**Example:**

```typescript
import { generateLocaleCandidates } from 'i18n-typed-store';

generateLocaleCandidates('ru-RU');
// Returns: ['ru-RU', 'ru']

generateLocaleCandidates('zh-Hans-CN');
// Returns: ['zh-Hans-CN', 'zh-Hans', 'zh-CN', 'zh']
```

#### `findBestLocaleMatch`

Finds the best matching locale from available locales using BCP 47 locale matching rules.

```typescript
function findBestLocaleMatch<T extends Record<string, string>>(requestedLocale: string, availableLocales: T): keyof T | null;

function findBestLocaleMatch(requestedLocale: string, availableLocales: string[]): string | null;
```

**Example:**

```typescript
import { findBestLocaleMatch } from 'i18n-typed-store';

const locales = { ru: 'ru', en: 'en', 'ru-RU': 'ru-RU' } as const;

findBestLocaleMatch('ru-RU', locales); // Returns 'ru-RU'
findBestLocaleMatch('ru-BY', locales); // Returns 'ru' (fallback to language)
findBestLocaleMatch('en-GB', locales); // Returns 'en' (fallback to language)
```

## TranslationStore API

The store returned by `createTranslationStore().type<M>()` provides the following API:

### Properties

- `currentLocale: keyof L` - Currently active locale
- `locales: L` - Available locales object
- `translationsMap: N` - Namespaces map
- `translations: { [K in keyof N]: {...} }` - Translations organized by namespace

### Methods

- `changeLocale(locale: string | keyof L): void` - Changes the current locale. If the locale string doesn't match exactly, it uses BCP 47 locale matching to find the best match (an unmatched locale falls back to `defaultLocale`). For every namespace whose new locale is **already cached**, `currentTranslation` is updated synchronously; namespaces without a cached translation keep the previous one (no flash of missing keys) until `load()` completes. Notifies all listeners.
- `preloadLocale(locale?, options?): Promise<void>` - Loads the requested namespaces (all by default) into the locale cache without changing `currentLocale` or the visible selected-locale translations. This is useful for warming a locale before a later synchronous `changeLocale()`.
- `changeLocaleAsync(locale, options?): Promise<LocaleChangeResult<L>>` - Loads the requested namespaces (all by default), then commits the locale and those namespace pointers in one synchronous step. It returns `{ status: 'committed', locale }`, or `{ status: 'superseded', ... }` when a newer synchronous or asynchronous locale request won the race. A failed current request leaves the visible locale unchanged and rejects with `LocaleLoadError`.
- `addChangeLocaleListener(listener): void` - Adds a listener that receives `(locale, metadata)`. Metadata identifies a synchronous or atomic commit; atomic metadata also reports the requested namespaces and the effective cache policy used by that operation.
- `removeChangeLocaleListener(listener): void` - Removes a locale change listener.
- `subscribeTranslationState(listener): () => void` - Subscribes to `{ namespace, locale }` invalidations for cache and load-state changes and returns an unsubscribe function. Read the referenced locale state's `namespace`, `isLoading`, `isError`, and `error` values after each notification.

> **`changeLocale` + `load`:** changing the locale does **not** trigger network loading by itself. The typical flow is `store.changeLocale('ru')` followed by `await store.translations.<ns>.load('ru')` for each namespace in use (framework bindings do this for you).

### Atomic locale changes

Use `changeLocaleAsync` when a screen must never contain namespaces from different locales:

```typescript
import { LocaleLoadError } from 'i18n-typed-store';

try {
	const result = await store.changeLocaleAsync('ru-RU');
	if (result.status === 'superseded') {
		// A newer locale request is now authoritative; no error occurred.
		return;
	}
	// store.currentLocale and every requested namespace current pointer now use ru.
} catch (error) {
	if (error instanceof LocaleLoadError) {
		for (const [namespace, cause] of error.failures) {
			console.error(namespace, cause);
		}
	}
}
```

The operation targets all registered namespaces by default. Pass `options.namespaces` to make the atomic boundary match the namespaces needed by the current route or screen. Excluded namespace pointers are not published by that commit; framework bindings may load them separately if they are later rendered. Successful partial loads remain cached when another requested namespace fails, but no locale-change event is emitted and the previously visible locale stays active. `options.fromCache` controls cache reuse. Namespace rejection values are preserved unchanged in both `LocaleLoadError.failures` and the corresponding locale state's `error` field.

For cache warming without a commit:

```typescript
await store.preloadLocale('ru', { fromCache: true });
store.changeLocale('ru'); // synchronous because every namespace is cached
```

### Namespace API

Each namespace in `store.translations` provides:

- `currentTranslation?: M[K]` - Last translation safely activated for the store-selected locale or published by an atomic commit
- `currentLocale?: keyof L` - Locale of `currentTranslation`
- `translations: Record<keyof L, {...}>` - Translations for all locales
- `load(locale?: string | keyof L, fromCache?: boolean): Promise<void>` - Loads translation for a specific locale. If locale is not provided, uses `currentLocale` or `defaultLocale`. Uses BCP 47 locale matching if the locale string doesn't match exactly. **Rejects** if loading fails (and sets `isError` plus the exact `error` on the locale state) — including when the call deduplicates onto an already-in-flight load that fails. Concurrent `load()` calls for the same locale share a single fetch. A failed fallback load never fails the main locale's load — the fallback merge is simply skipped. A load for the currently selected locale may update `current*`; loading another locale only warms its raw cache slot and cannot replace visible state.

Each locale in `translations` provides:

- `namespace?: M[K]` - Loaded translation data (undefined if not loaded yet)
- `isLoading: boolean` - Whether translation is currently being loaded
- `isError: boolean` - Whether an error occurred during loading
- `error?: unknown` - Exact value thrown or rejected by the most recent failed load; cleared when a retry starts or valid cached data is accepted
- `loadingPromise?: Promise<void>` - Promise for the ongoing loading operation

## Advanced Usage

### Translation Classes Structure

The library works with TypeScript classes or objects for translations, providing full type safety and IDE support (go-to definition, autocomplete). Here's an example of a translation class:

```typescript
// translations/common/en.ts
import { createPluralSelector } from 'i18n-typed-store';

const plur = createPluralSelector('en');

export default class CommonTranslationsEn {
	title = 'Welcome';
	loading = 'Loading...';
	error = 'An error occurred';

	buttons = {
		save: 'Save',
		cancel: 'Cancel',
		delete: 'Delete',
	};

	messages = {
		notFound: 'Not found',
		unauthorized: 'You are not authorized to perform this action',
	};

	// Pluralization method
	items = (count: number) =>
		count +
		' ' +
		plur(count, {
			one: 'item',
			other: 'items',
		});
}
```

Or using plain objects:

```typescript
// translations/common/en.ts
export default {
	title: 'Welcome',
	loading: 'Loading...',
	buttons: {
		save: 'Save',
		cancel: 'Cancel',
	},
};
```

```typescript
// lib/i18n.ts
import { createTranslationStore } from 'i18n-typed-store';
import type CommonTranslationsEn from './translations/common/en';
import type ErrorsTranslationsEn from './translations/errors/en';

const namespaces = {
	common: 'common',
	errors: 'errors',
} as const;

const locales = {
	en: 'en',
	ru: 'ru',
} as const;

export interface TranslationData extends Record<keyof typeof namespaces, any> {
	common: CommonTranslationsEn;
	errors: ErrorsTranslationsEn;
}

export const store = createTranslationStore({
	namespaces,
	locales,
	loadModule: (locale, namespace) => {
		return import(`./translations/${namespace}/${locale}.ts`);
	},
	extractTranslation: (module) => module.default,
	defaultLocale: 'en',
	useFallback: true,
	fallbackLocale: 'en',
}).type<TranslationData>();
```

**Benefits of using classes/objects:**

- ✅ Full TypeScript type safety with IDE go-to definition support
- ✅ Methods for pluralization and dynamic translations
- ✅ Better code organization and maintainability
- ✅ Compile-time validation of translation keys

### Working with Dynamic Imports

```typescript
const namespaces = { common: 'common', errors: 'errors' } as const;

const storeFactory = createTranslationStore({
	namespaces,
	locales: { en: 'en', ru: 'ru' },
	loadModule: async (locale, namespace) => {
		// Dynamic import with error handling
		try {
			const module = await import(`./translations/${namespace}/${locale}.ts`);
			return module;
		} catch (error) {
			console.error(`Failed to load ${namespace} for ${locale}`);
			throw error;
		}
	},
	extractTranslation: (module) => module.default,
	defaultLocale: 'en',
});
```

### Custom Module Extraction

The `extractTranslation` function receives the module, locale, and namespace key, allowing for advanced extraction logic:

```typescript
const namespaces = { common: 'common', lang: 'lang' } as const;

const storeFactory = createTranslationStore({
	namespaces,
	locales: { en: 'en', ru: 'ru' },
	loadModule: async (locale, namespace) => {
		// Special handling for certain namespaces
		if (namespace === 'lang') {
			return await import(`./translations/${namespace}/index.ts`);
		}
		return await import(`./translations/${namespace}/${locale}.ts`);
	},
	extractTranslation: (module, locale, namespace) => {
		// Custom extraction logic based on locale or namespace
		if (namespace === 'lang') {
			return module.default[locale];
		}
		return module.default;
	},
	defaultLocale: 'en',
});
```

### Handling Multiple Translation Namespaces

```typescript
import type CommonTranslationsEn from './translations/common/en';
import type ErrorsTranslationsEn from './translations/errors/en';
import type UiTranslationsEn from './translations/ui/en';

const namespaces = {
	common: 'common',
	errors: 'errors',
	ui: 'ui',
} as const;

interface TranslationData extends Record<keyof typeof namespaces, any> {
	common: CommonTranslationsEn;
	errors: ErrorsTranslationsEn;
	ui: UiTranslationsEn;
}

const store = storeFactory.type<TranslationData>();

// Load specific translations
await store.translations.common.load('en');
await store.translations.ui.load('en');

// Access translations (with full IDE support)
const title = store.translations.common.currentTranslation?.title;
const saveButton = store.translations.ui.currentTranslation?.buttons.save;
```

### Using Fallback Locales

When `useFallback` is enabled, missing translations are automatically filled from the fallback locale:

```typescript
const storeFactory = createTranslationStore({
	namespaces: { common: 'common' },
	locales: { en: 'en', ru: 'ru' },
	loadModule: async (locale, namespace) => {
		return await import(`./translations/${namespace}/${locale}.ts`);
	},
	extractTranslation: (module) => module.default,
	defaultLocale: 'en',
	useFallback: true,
	fallbackLocale: 'en',
});

// If 'ru' translation is missing some keys, they will be filled from 'en'
await store.translations.common.load('ru');
// Result: merged translation with 'en' as fallback
```

> **Treat translations as read-only.** The merge is shallow-copying: nested objects of the merged result are shared by reference with the cached fallback translation (translations may contain functions and class instances, which cannot be safely deep-cloned). Mutating a merged translation would also mutate the fallback shared with other locales.

### BCP 47 Locale Matching

The library automatically handles BCP 47 locale matching when changing locales or loading translations:

```typescript
const locales = {
  en: 'en',
  ru: 'ru',
  'zh-Hans-CN': 'zh-Hans-CN',
  'zh-Hans': 'zh-Hans',
} as const;

const store = createTranslationStore({...}).type<TranslationData>();

// Change locale with region
store.changeLocale('ru-RU');  // Automatically matches 'ru'

// Change locale with script and region
store.changeLocale('zh-Hans-TW');  // Automatically matches 'zh-Hans' (script match)

// Load translation with region
await store.translations.common.load('en-US');  // Automatically matches 'en'
```

### Event System

The store provides an event system for locale changes:

```typescript
const store = createTranslationStore({...}).type<TranslationData>();

// Add listener
const listener = (locale: keyof typeof locales) => {
  console.log('Locale changed to:', locale);
};
store.addChangeLocaleListener(listener);

// Change locale (triggers listeners)
store.changeLocale('ru');

// Remove listener
store.removeChangeLocaleListener(listener);
```

## Type Safety

The library provides complete type safety:

```typescript
// ✅ TypeScript knows all available translation keys
const title = store.translations.common.currentTranslation?.title;

// ❌ TypeScript error: 'invalidKey' doesn't exist
const invalid = store.translations.common.currentTranslation?.invalidKey;

// ✅ TypeScript knows all available locales
await store.translations.common.load('en');

// ❌ TypeScript error: 'fr' is not a valid locale
await store.translations.common.load('fr');

// ✅ getTranslation is fully typed
const greeting = getTranslation(store, 'common.greeting'); // Type: string
const buttons = getTranslation(store, 'common.buttons'); // Type: { save: string; cancel: string }
const save = getTranslation(store, 'common.buttons.save'); // Type: string

// ❌ TypeScript error: invalid key
// const invalid = getTranslation(store, 'common.invalidKey');
```

## Pluralization

The library uses `Intl.PluralRules` for plural form selection, supporting all Unicode CLDR plural rules:

- `zero` - For languages with explicit zero form (e.g., Arabic)
- `one` - Singular form
- `two` - Dual form (e.g., Arabic, Slovenian)
- `few` - Few form (e.g., Russian, Polish)
- `many` - Many form (e.g., Russian, Polish)
- `other` - Default/plural form (required)

**Supported locales:**

- English, German, French, Spanish, etc. (one/other)
- Russian, Ukrainian, Serbian, etc. (one/few/many/other)
- Polish (one/few/many/other)
- Arabic (zero/one/two/few/many/other)
- And many more...

**Example with translation class:**

```typescript
// translations/products/en.ts
import { createPluralSelector } from 'i18n-typed-store';

const plur = createPluralSelector('en');

export default class ProductsTranslationsEn {
	title = 'Products';

	// Pluralization method
	productCount = (count: number) =>
		count +
		' ' +
		plur(count, {
			one: 'product',
			other: 'products',
		});

	itemsInCart = (count: number) =>
		count +
		' ' +
		plur(count, {
			one: 'item',
			other: 'items',
		}) +
		' in cart';
}

// Usage
await store.translations.products.load('en');
const translation = store.translations.products.currentTranslation;
if (translation) {
	translation.productCount(1); // => "1 product"
	translation.productCount(5); // => "5 products"
	translation.itemsInCart(0); // => "0 items in cart" (English selects 'other' for 0)
	translation.itemsInCart(1); // => "1 item in cart"
}
```

> **Note on `zero`:** English (and most languages) never selects the `zero` category — `Intl.PluralRules('en').select(0)` returns `'other'`. The `zero` variant is only used by languages whose CLDR rules define it (e.g., Arabic, Latvian, Welsh). If you want a special "No items" message for `0` in English, branch on the count explicitly:
>
> ```typescript
> itemsInCart = (count: number) => (count === 0 ? 'No items in cart' : `${count} ${plur(count, { one: 'item', other: 'items' })} in cart`);
> ```

### Ordinal plurals

Pass `Intl.PluralRules` options through to get ordinal (1st/2nd/3rd) selection:

```typescript
const ordinal = createPluralSelector('en', { intlOptions: { type: 'ordinal' } });

const place = (n: number) => `${n}${ordinal(n, { one: 'st', two: 'nd', few: 'rd', other: 'th' })} place`;

place(1); // => "1st place"
place(2); // => "2nd place"
place(3); // => "3rd place"
place(11); // => "11th place"
place(21); // => "21st place"
```

## Examples

### Example: E-commerce Application

```typescript
import type ProductsTranslationsEn from './translations/products/en';
import type CartTranslationsEn from './translations/cart/en';
import type CheckoutTranslationsEn from './translations/checkout/en';

const namespaces = {
	products: 'products',
	cart: 'cart',
	checkout: 'checkout',
} as const;

const locales = {
	en: 'en',
	ru: 'ru',
	de: 'de',
} as const;

interface TranslationData extends Record<keyof typeof namespaces, any> {
	products: ProductsTranslationsEn;
	cart: CartTranslationsEn;
	checkout: CheckoutTranslationsEn;
}

const storeFactory = createTranslationStore({
	namespaces,
	locales,
	loadModule: async (locale, namespace) => {
		return await import(`./translations/${namespace}/${locale}.ts`);
	},
	extractTranslation: (module) => module.default,
	defaultLocale: 'en',
});

const store = storeFactory.type<TranslationData>();

// Load translations
await store.translations.products.load('en');
await store.translations.cart.load('en');

// Use translations (with full IDE go-to support)
const productTitle = store.translations.products.currentTranslation?.title;
const cartTitle = store.translations.cart.currentTranslation?.title;

// Change locale
store.changeLocale('ru');
await store.translations.products.load('ru');
```

## API Reference

### Types

```typescript
type TranslationStore<N, L, M> = {
  currentLocale: keyof L;
  locales: L;
  translationsMap: N;
  changeLocale: (locale: string | keyof L) => void;
  preloadLocale: (locale?: string | keyof L, options?: LocaleLoadOptions<N>) => Promise<void>;
  changeLocaleAsync: (locale: string | keyof L, options?: LocaleLoadOptions<N>) => Promise<LocaleChangeResult<L>>;
  addChangeLocaleListener: (listener: LocaleChangeListener<N, L>) => void;
  removeChangeLocaleListener: (listener: LocaleChangeListener<N, L>) => void;
  subscribeTranslationState: (listener: TranslationStateListener<keyof N, keyof L>) => () => void;
  translations: { [K in keyof N]: {...} };
};

type LocaleLoadOptions<N> = {
  readonly fromCache?: boolean;
  readonly namespaces?: readonly (keyof N)[];
};

type LocaleChangeMetadata<N> =
  | {
      readonly source: 'sync';
      readonly loadedNamespaces: readonly [];
    }
  | {
      readonly source: 'atomic';
      readonly loadedNamespaces: readonly (keyof N)[];
      readonly fromCache: boolean;
    };

type LocaleChangeListener<N, L> = (
  locale: keyof L,
  metadata: LocaleChangeMetadata<N>,
) => void;

type LocaleChangeResult<L> =
  | { readonly status: 'committed'; readonly locale: keyof L }
  | {
      readonly status: 'superseded';
      readonly locale: keyof L;
      readonly currentLocale: keyof L;
    };

type TranslationStateEvent<NamespaceKey, LocaleKey> = {
  readonly namespace: NamespaceKey;
  readonly locale: LocaleKey;
};

type TranslationStateListener<NamespaceKey, LocaleKey> = (
  event: TranslationStateEvent<NamespaceKey, LocaleKey>,
) => void;

type PluralVariants = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string; // Required
};

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type ParsedLocale = {
  language: string;
  script?: string;
  region?: string;
  variant?: string;
  original: string;
};

type CreateTranslationStoreOptions<N, L, Module> = {
  namespaces: N;
  locales: L;
  loadModule: (locale: keyof L, namespace: keyof N) => Promise<Module>;
  extractTranslation: (module: Module, locale: keyof L, namespace: keyof N) => unknown | Promise<unknown>;
  defaultLocale: keyof L;
  useFallback?: boolean;
  fallbackLocale?: keyof L;
  deleteOtherLocalesAfterLoad?: boolean;
  loadFromCache?: boolean;
  changeLocaleEventName?: string;
  onMissingKey?: (key: string, locale: string) => void;
};

type InterpolationParams<S extends string> = /* derived from the template literal type */;

type IntlFormatters = {
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  currency: (value: number, currency: string, options?: Intl.NumberFormatOptions) => string;
  percent: (value: number, options?: Intl.NumberFormatOptions) => string;
  date: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  time: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  dateTime: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  relativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit, options?: Intl.RelativeTimeFormatOptions) => string;
  list: (items: string[], options?: Intl.ListFormatOptions) => string;
};
```

### Exported Functions

- `createTranslationStore<N, L, Module>(options: CreateTranslationStoreOptions<N, L, Module>): { type<M>(): TranslationStore<N, L, M> }`
- `createTranslationModuleMap<N, L, Module>(namespaces, locales, loadModule): Record<keyof N, Record<keyof L, () => Promise<Module>>>`
- `createPluralSelector(locale: string, options?: { strict?: boolean; intlOptions?: Intl.PluralRulesOptions }): (count: number, variants: PluralVariants) => string`
- `getTranslation<N, L, M, Key>(store: TranslationStore<N, L, M>, key: Key, locale?: string | keyof L): GetTranslationValue<M, Key> | Key`
- `getTranslationOrThrow<N, L, M, Key>(store: TranslationStore<N, L, M>, key: Key, locale?: string | keyof L): GetTranslationValue<M, Key>` — throws `TranslationMissingError` on a miss instead of returning the key
- `LocaleLoadError` — `AggregateError` thrown by store-level locale loading; exposes `locale` and a readonly `failures` map containing each namespace's exact rejection value
- `interpolate<S extends string>(template: S, params?: InterpolationParams<S>): string`
- `createIntlFormatters(locale: string): IntlFormatters`
- `parseLocale(locale: string): ParsedLocale`
- `generateLocaleCandidates(locale: string): string[]`
- `findBestLocaleMatch<T>(requestedLocale: string, availableLocales: T): keyof T | null`
- `findBestLocaleMatch(requestedLocale: string, availableLocales: string[]): string | null`
- `smartDeepMerge(current: any, fallback: any): any` — the merge used for fallback locales
- `EventEmitter` — the typed event emitter used internally by the store

## Limitations

- **No ICU MessageFormat.** Interpolation is `{{placeholder}}`-based; complex ICU messages (nested select/plural syntax) are intentionally out of scope — use translation methods (functions in your translation classes) with `createPluralSelector`/`createIntlFormatters` instead.
- **Merged translations are shallow.** With `useFallback`, merged results share nested references with the cached fallback translation — treat translations as read-only.
- **Listener errors are re-thrown asynchronously.** A locale-change listener that throws will not break other listeners or the emitter, but the error surfaces as an uncaught exception (standard `queueMicrotask` re-throw, same pattern React uses). Wrap listener bodies in try/catch if you need custom handling.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Alexander Lvov

## Repository

[GitHub](https://github.com/ialexanderlvov/i18n-typed-store)
