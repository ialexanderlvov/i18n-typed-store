# i18n-typed-store

> ⚠️ **WARNING: The library API is under active development and may change significantly between versions. Use exact versions in package.json and carefully read the changelog when updating.**

Type-safe translation store for managing i18n locales with full TypeScript support. A lightweight, zero-dependency library for handling internationalization with compile-time type safety. Designed to work with TypeScript classes or objects for translations, providing full IDE support (go-to definition, autocomplete).

## Features

- ✅ **Full TypeScript support** - Complete type safety for translations and locales
- ✅ **IDE integration** - Go-to definition, autocomplete, and refactoring support with translation classes/objects
- ✅ **Lazy loading** - Load translations only when needed
- ✅ **Type-safe API** - Compile-time validation of translation keys and locales
- ✅ **Translation classes/objects** - Use TypeScript classes or objects for translations
- ✅ **Pluralization support** - Built-in plural form selector using `Intl.PluralRules`
- ✅ **Flexible module loading** - Support for any module format (ESM, CommonJS, dynamic imports)
- ✅ **Zero runtime dependencies** - Lightweight and framework-agnostic
- ✅ **Fallback locales** - Automatic merging with fallback translations
- ✅ **Caching** - Built-in translation caching for better performance
- ✅ **Event system** - Listen to locale changes
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
		return module.default || module;
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

**Returns:** Object with `type<M>()` method that creates a typed store.

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
	extractTranslation: (module) => module.default || module,
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
function createPluralSelector(locale: string, options?: { strict?: boolean }): (count: number, variants: PluralVariants) => string;
```

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
	locale?: keyof L,
): GetTranslationValue<M, Key>;
```

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

- `changeLocale(locale: string | keyof L): void` - Changes the current locale. If the locale string doesn't match exactly, it uses BCP 47 locale matching to find the best match. Notifies all listeners.
- `addChangeLocaleListener(listener: (locale: keyof L) => void): void` - Adds a listener for locale change events
- `removeChangeLocaleListener(listener: (locale: keyof L) => void): void` - Removes a locale change listener

### Namespace API

Each namespace in `store.translations` provides:

- `currentTranslation?: M[K]` - Currently active translation for this namespace
- `currentLocale?: keyof L` - Locale of the current translation
- `translations: Record<keyof L, {...}>` - Translations for all locales
- `load(locale?: string | keyof L, fromCache?: boolean): Promise<void>` - Loads translation for a specific locale. If locale is not provided, uses `currentLocale` or `defaultLocale`. Uses BCP 47 locale matching if the locale string doesn't match exactly.

Each locale in `translations` provides:

- `namespace?: M[K]` - Loaded translation data (undefined if not loaded yet)
- `isLoading: boolean` - Whether translation is currently being loaded
- `isError: boolean` - Whether an error occurred during loading
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
			zero: 'No items',
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
	translation.itemsInCart(0); // => "0 No items in cart"
	translation.itemsInCart(1); // => "1 item in cart"
}
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
  addChangeLocaleListener: (listener: (locale: keyof L) => void) => void;
  removeChangeLocaleListener: (listener: (locale: keyof L) => void) => void;
  translations: { [K in keyof N]: {...} };
};

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
};
```

### Exported Functions

- `createTranslationStore<N, L, Module>(options: CreateTranslationStoreOptions<N, L, Module>): { type<M>(): TranslationStore<N, L, M> }`
- `createTranslationModuleMap<N, L, Module>(namespaces, locales, loadModule): Record<keyof N, Record<keyof L, () => Promise<Module>>>`
- `createPluralSelector(locale: string, options?: { strict?: boolean }): (count: number, variants: PluralVariants) => string`
- `getTranslation<N, L, M, Key>(store: TranslationStore<N, L, M>, key: Key, locale?: keyof L): GetTranslationValue<M, Key>`
- `parseLocale(locale: string): ParsedLocale`
- `generateLocaleCandidates(locale: string): string[]`
- `findBestLocaleMatch<T>(requestedLocale: string, availableLocales: T): keyof T | null`
- `findBestLocaleMatch(requestedLocale: string, availableLocales: string[]): string | null`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Alexander Lvov

## Repository

[GitHub](https://github.com/ialexanderlvov/i18n-typed-store)
