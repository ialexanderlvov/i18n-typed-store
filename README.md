# i18n-typed-store

Type-safe translation store for managing i18n locales with full TypeScript support. A lightweight, zero-dependency library for handling internationalization with compile-time type safety.

## Features

- ✅ **Full TypeScript support** - Complete type safety for translations and locales
- ✅ **Lazy loading** - Load translations only when needed
- ✅ **Type-safe API** - Compile-time validation of translation keys and locales
- ✅ **Pluralization support** - Built-in plural form selector using `Intl.PluralRules`
- ✅ **Flexible module loading** - Support for any module format (ESM, CommonJS, dynamic imports)
- ✅ **Zero runtime dependencies** - Lightweight and framework-agnostic

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

// Define your translation keys
const translations = {
  common: 'common',
  errors: 'errors',
} as const;

// Define your locales
const locales = {
  en: 'en',
  ru: 'ru',
} as const;

// Define your translation data structure
type TranslationData = {
  common: {
    title: string;
    description: string;
  };
  errors: {
    notFound: string;
  };
};

// Create the store
const storeFactory = createTranslationStore(
  translations,
  locales,
  async (locale, translation) => {
    // Load translation module dynamically
    const module = await import(`./locales/${locale}/${translation}.json`);
    return module.default;
  },
  (module, locale, translation) => module // Extract translation data
);

// Create typed store
const store = storeFactory.type<TranslationData>();

// Load and use translations
await store.common.load('en');
console.log(store.common.translation?.title); // Type-safe access
```

## Core API

### `createTranslationStore`

Creates a type-safe translation store with lazy loading support.

```typescript
const storeFactory = createTranslationStore<T, L, Module>(
  translations: T,
  locales: L,
  loadModule: (locale: keyof L, translation: keyof T) => Promise<Module>,
  extractTranslation: (module: Module, locale: keyof L, translation: keyof T) => unknown
);
```

**Parameters:**

- `translations` - Object with translation keys (e.g., `{ common: 'common', errors: 'errors' }`)
- `locales` - Object with locale keys (e.g., `{ en: 'en', ru: 'ru' }`)
- `loadModule` - Async function to load a translation module
- `extractTranslation` - Function to extract translation data from the loaded module. Receives the module, locale, and translation key as parameters, allowing for locale-specific or translation-specific extraction logic.

**Returns:** Object with `type<M>()` method that creates a typed store.

**Example:**

```typescript
const storeFactory = createTranslationStore(
  { common: 'common' },
  { en: 'en', ru: 'ru' },
  async (locale, translation) => {
    return await import(`./locales/${locale}/${translation}.json`);
  },
  (module, locale, translation) => module.default
);

type TranslationData = {
  common: { title: string; description: string };
};

const store = storeFactory.type<TranslationData>();

// Load translation
await store.common.load('en');

// Access translation (type-safe)
const title = store.common.translation?.title;
```

### `createTranslationModuleMap`

Creates a map of translation module loaders for all combinations of translations and locales.

```typescript
const moduleMap = createTranslationModuleMap<T, L, Module>(
  translations: T,
  locales: L,
  loadModule: (locale: keyof L, translation: keyof T) => Promise<Module>
);
```

**Example:**

```typescript
const moduleMap = createTranslationModuleMap(
  { common: 'common' },
  { en: 'en', ru: 'ru' },
  async (locale, translation) => {
    return await import(`./locales/${locale}/${translation}.json`);
  }
);

// Access loader
const loader = moduleMap.common.en;
const module = await loader();
```

### `createPluralSelector`

Creates a plural form selector function for a specific locale using `Intl.PluralRules`.

```typescript
const selectPlural = createPluralSelector(locale: string);
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

selectPlural(1, variants);  // => 'яблоко'
selectPlural(2, variants);  // => 'яблока'
selectPlural(5, variants);  // => 'яблок'
```

## Advanced Usage

### Working with Dynamic Imports

```typescript
const storeFactory = createTranslationStore(
  translations,
  locales,
  async (locale, translation) => {
    // Dynamic import with error handling
    try {
      const module = await import(
        `./locales/${locale}/${translation}.json`
      );
      return module.default;
    } catch (error) {
      console.error(`Failed to load ${translation} for ${locale}`);
      throw error;
    }
  },
  (module, locale, translation) => module
);
```

### Custom Module Extraction

The `extractTranslation` function receives the module, locale, and translation key, allowing for advanced extraction logic:

```typescript
const storeFactory = createTranslationStore(
  translations,
  locales,
  async (locale, translation) => {
    // Load module that exports default
    return await import(`./locales/${locale}/${translation}.ts`);
  },
  (module, locale, translation) => {
    // Extract from module.default or module
    // You can use locale and translation parameters for custom logic
    if (locale === 'en' && translation === 'common') {
      // Special handling for English common translations
      return module.default?.en || module.default;
    }
    return module.default || module;
  }
);
```

### Handling Multiple Translation Namespaces

```typescript
const translations = {
  common: 'common',
  errors: 'errors',
  ui: 'ui',
  admin: 'admin',
} as const;

type TranslationData = {
  common: { title: string };
  errors: { notFound: string };
  ui: { buttons: { save: string } };
  admin: { dashboard: { title: string } };
};

const store = storeFactory.type<TranslationData>();

// Load specific translations
await store.common.load('en');
await store.ui.load('en');

// Access translations
const title = store.common.translation?.title;
const saveButton = store.ui.translation?.buttons.save;
```

## Type Safety

The library provides complete type safety:

```typescript
// ✅ TypeScript knows all available translation keys
const title = store.common.translation?.title;

// ❌ TypeScript error: 'invalidKey' doesn't exist
const invalid = store.common.translation?.invalidKey;

// ✅ TypeScript knows all available locales
await store.common.load('en');

// ❌ TypeScript error: 'fr' is not a valid locale
await store.common.load('fr');
```

## Pluralization

The library uses `Intl.PluralRules` for plural form selection, supporting all Unicode CLDR plural rules:

- `zero` - For languages with explicit zero form (e.g., Arabic)
- `one` - Singular form
- `two` - Dual form (e.g., Arabic, Slovenian)
- `few` - Few form (e.g., Russian, Polish)
- `many` - Many form (e.g., Russian, Polish)
- `other` - Default/plural form

**Supported locales:**

- English, German, French, Spanish, etc. (one/other)
- Russian, Ukrainian, Serbian, etc. (one/few/many/other)
- Polish (one/few/many/other)
- Arabic (zero/one/two/few/many/other)
- And many more...

## API Reference

### `createTranslationStore`

```typescript
function createTranslationStore<
  T extends Record<string, string>,
  L extends Record<string, string>,
  Module = unknown
>(
  translations: T,
  locales: L,
  loadModule: (locale: keyof L, translation: keyof T) => Promise<Module>,
  extractTranslation: (module: Module, locale: keyof L, translation: keyof T) => unknown
): {
  type<M extends { [K in keyof T]: Record<string, unknown> }>(): TranslationStore<T, L, M>;
}
```

### `createTranslationModuleMap`

```typescript
function createTranslationModuleMap<
  T extends Record<string, string>,
  L extends Record<string, string>,
  Module = unknown
>(
  translations: T,
  locales: L,
  loadModule: (locale: keyof L, translation: keyof T) => Promise<Module>
): Record<keyof T, Record<keyof L, () => Promise<Module>>>
```

### `createPluralSelector`

```typescript
function createPluralSelector(locale: string): (
  count: number,
  variants: PluralVariants
) => string
```

### `PluralVariants`

```typescript
type PluralVariants = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other?: string;
};
```

## Examples

### Example: E-commerce Application

```typescript
const translations = {
  products: 'products',
  cart: 'cart',
  checkout: 'checkout',
} as const;

const locales = {
  en: 'en',
  ru: 'ru',
  de: 'de',
} as const;

type TranslationData = {
  products: {
    title: string;
    addToCart: string;
    price: string;
  };
  cart: {
    title: string;
    empty: string;
    total: string;
  };
  checkout: {
    title: string;
    placeOrder: string;
  };
};

const storeFactory = createTranslationStore(
  translations,
  locales,
  async (locale, translation) => {
    return await import(`./locales/${locale}/${translation}.json`);
  },
  (module, locale, translation) => module.default
);

const store = storeFactory.type<TranslationData>();

// Load translations
await store.products.load('en');
await store.cart.load('en');

// Use translations
const productTitle = store.products.translation?.title;
const cartTitle = store.cart.translation?.title;
```

### Example: Pluralization in Product List

```typescript
import { createPluralSelector } from 'i18n-typed-store';

const selectPlural = createPluralSelector('en');

function getProductCountText(count: number): string {
  return selectPlural(count, {
    one: `${count} product`,
    other: `${count} products`,
  });
}

// Usage
getProductCountText(1);  // => "1 product"
getProductCountText(5);  // => "5 products"
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Alexander Lvov

## Repository

[GitHub](https://github.com/ialexanderlvov/i18n-typed-store)
