# i18n-typed-store-react

> ⚠️ **WARNING: The library API is under active development and may change significantly between versions. Use exact versions in package.json and read the changelog carefully when updating.**

React integration for [i18n-typed-store](https://github.com/ialexanderlvov/i18n-typed-store) - a type-safe translation store for managing i18n locales with full TypeScript support. Provides React hooks, components, and SSR utilities for seamless integration with React applications.

## Features

- ✅ **React Hooks** - `useI18nTranslation`, `useI18nTranslationLazy`, `useI18nLocale`
- ✅ **React Suspense Support** - Built-in support for React Suspense with lazy loading
- ✅ **Provider Component** - `I18nTypedStoreProvider` for providing translation context
- ✅ **SSR/SSG Support** - Utilities for Next.js and other SSR frameworks
- ✅ **Type-Safe** - Full TypeScript support with autocomplete and go-to definition
- ✅ **Safe Component** - Error-safe component for accessing translations
- ✅ **Locale Management** - Hook for accessing and changing locales with automatic updates

## Installation

```bash
npm install i18n-typed-store-react
```

```bash
yarn add i18n-typed-store-react
```

```bash
pnpm add i18n-typed-store-react
```

## Quick Start

### Basic Setup

First, create your translation store using `i18n-typed-store`:

```typescript
// store.ts
import { createTranslationStore } from 'i18n-typed-store';
import type CommonTranslationsEn from './translations/common/en';
import { TRANSLATIONS, LOCALES } from './constants';

export interface ITranslationStoreTypes extends Record<keyof typeof TRANSLATIONS, any> {
	common: CommonTranslationsEn;
}

export const store = createTranslationStore({
	namespaces: TRANSLATIONS,
	locales: LOCALES,
	loadModule: async (locale, namespace) => {
		return await import(`./translations/${namespace}/${locale}.tsx`);
	},
	extractTranslation: (module) => new module.default(),
	defaultLocale: 'en',
}).type<ITranslationStoreTypes>();
```

```typescript
// constants.ts
export const TRANSLATIONS = {
	common: 'common',
} as const;

export const LOCALES = {
	en: 'en',
	ru: 'ru',
} as const;
```

### Wrap Your App with Provider

```tsx
// App.tsx
import { I18nTypedStoreProvider } from 'i18n-typed-store-react';
import { store } from './store';
import { MyComponent } from './MyComponent';

function App() {
	return (
		<I18nTypedStoreProvider store={store}>
			<MyComponent />
		</I18nTypedStoreProvider>
	);
}
```

### Use Translations in Components

```tsx
// MyComponent.tsx
import { useI18nTranslation, useI18nLocale } from 'i18n-typed-store-react';
import { TRANSLATIONS, LOCALES } from './constants';
import type { ITranslationStoreTypes } from './store';

function MyComponent() {
	const translations = useI18nTranslation<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, 'common'>('common');
	const { locale, setLocale } = useI18nLocale<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes>();

	if (!translations) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<h1>{translations.title}</h1>
			<p>{translations.greeting}</p>
			<button onClick={() => setLocale('ru')}>Switch to Russian</button>
		</div>
	);
}
```

### Creating Typed Hook Wrappers (Recommended)

For better type safety and cleaner code, create typed wrapper hooks:

```typescript
// hooks/useTranslation.ts
import { useI18nTranslation } from 'i18n-typed-store-react/useI18nTranslation';
import type { TRANSLATIONS, LOCALES } from '../constants';
import type { ITranslationStoreTypes } from '../store';

export const useTranslation = <K extends keyof typeof TRANSLATIONS>(translation: K) => {
	return useI18nTranslation<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, K>(translation);
};
```

```typescript
// hooks/useTranslationLazy.ts
import { useI18nTranslationLazy } from 'i18n-typed-store-react/useI18nTranslationLazy';
import type { TRANSLATIONS, LOCALES } from '../constants';
import type { ITranslationStoreTypes } from '../store';

export const useTranslationLazy = <K extends keyof typeof TRANSLATIONS>(translation: K) => {
	return useI18nTranslationLazy<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, K>(translation);
};
```

Now you can use them with full type inference:

```tsx
// MyComponent.tsx
import { useTranslation } from './hooks/useTranslation';
import { useI18nLocale } from 'i18n-typed-store-react';

function MyComponent() {
	const translations = useTranslation('common');
	const { locale, setLocale } = useI18nLocale();

	if (!translations) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<h1>{translations.title}</h1>
			<p>{translations.greeting}</p>
			<button onClick={() => setLocale('ru')}>Switch to Russian</button>
		</div>
	);
}
```

## React Suspense Support

Use `useI18nTranslationLazy` with React Suspense for automatic loading states:

```tsx
// MyComponent.tsx
import { Suspense } from 'react';
import { useTranslationLazy } from './hooks/useTranslationLazy';

function MyComponent() {
	// This hook throws a promise if translation is not loaded (for Suspense)
	const translations = useTranslationLazy('common');

	return (
		<div>
			<h1>{translations.title}</h1>
			<p>{translations.greeting}</p>
		</div>
	);
}
```

```tsx
// App.tsx
import { Suspense } from 'react';
import { I18nTypedStoreProvider } from 'i18n-typed-store-react';
import { store } from './store';
import { MyComponent } from './MyComponent';

function App() {
	return (
		<I18nTypedStoreProvider store={store} suspenseMode="first-load-locale">
			<Suspense fallback={<div>Loading translations...</div>}>
				<MyComponent />
			</Suspense>
		</I18nTypedStoreProvider>
	);
}
```

## API Reference

### `I18nTypedStoreProvider`

Provider component that wraps your application to provide translation store context.

```tsx
<I18nTypedStoreProvider store={store} suspenseMode="first-load-locale">
	{children}
</I18nTypedStoreProvider>
```

**Props:**

- `store` - Translation store instance (created with `createTranslationStore`)
- `suspenseMode` - Suspense mode: `'once'` | `'first-load-locale'` | `'change-locale'` (default: `'first-load-locale'`)
    - `'once'` - Suspense only on first load
    - `'first-load-locale'` - Suspense on first load for each locale
    - `'change-locale'` - Suspense on every locale change
- `children` - React children

### `useI18nTranslation`

Hook for accessing translations with automatic loading. Returns `undefined` if translation is not yet loaded.

```tsx
// Direct usage
const translations = useI18nTranslation<
  typeof TRANSLATIONS,
  typeof LOCALES,
  ITranslationStoreTypes,
  'common'
>('common', fromCache?: boolean);

// Typed wrapper (recommended)
import { useI18nTranslation } from 'i18n-typed-store-react/useI18nTranslation';
import type { TRANSLATIONS, LOCALES } from './constants';
import type { ITranslationStoreTypes } from './store';

export const useTranslation = <K extends keyof typeof TRANSLATIONS>(translation: K) => {
  return useI18nTranslation<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, K>(translation);
};

// Usage
const translations = useTranslation('common');
if (translations) {
  console.log(translations.greeting);
}
```

**Parameters:**

- `namespace` - Namespace key to load translations for
- `fromCache` - Whether to use cached translation if available (default: `true`)

**Returns:** Translation object for the specified namespace, or `undefined` if not loaded

### `useI18nTranslationLazy`

Hook for accessing translations with React Suspense support. Throws a promise if translation is not loaded.

```tsx
// Direct usage
const translations = useI18nTranslationLazy<
  typeof TRANSLATIONS,
  typeof LOCALES,
  ITranslationStoreTypes,
  'common'
>('common', fromCache?: boolean);

// Typed wrapper (recommended)
import { useI18nTranslationLazy } from 'i18n-typed-store-react/useI18nTranslationLazy';
import type { TRANSLATIONS, LOCALES } from './constants';
import type { ITranslationStoreTypes } from './store';

export const useTranslationLazy = <K extends keyof typeof TRANSLATIONS>(translation: K) => {
  return useI18nTranslationLazy<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, K>(translation);
};

// Usage
function MyComponent() {
  const translations = useTranslationLazy('common');
  return <div>{translations.greeting}</div>;
}
```

**Parameters:**

- `namespace` - Namespace key to load translations for
- `fromCache` - Whether to use cached translation if available (default: `true`)

**Returns:** Translation object for the specified namespace (never `undefined`)

**Throws:** Promise if translation is not yet loaded (for React Suspense)

### `useI18nLocale`

Hook for accessing and managing the current locale. Supports SSR/SSG by using `useSyncExternalStore`.

```tsx
const { locale, setLocale } = useI18nLocale<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes>();
```

**Returns:**

- `locale` - Current locale key
- `setLocale` - Function to change the current locale

**Example:**

```tsx
function LocaleSwitcher() {
	const { locale, setLocale } = useI18nLocale();

	return (
		<select value={locale} onChange={(e) => setLocale(e.target.value as keyof typeof LOCALES)}>
			<option value="en">English</option>
			<option value="ru">Русский</option>
		</select>
	);
}
```

### `Safe`

Component that safely extracts strings from translation objects, catching errors.

```tsx
<Safe errorComponent={<span>N/A</span>} errorHandler={(error) => console.error(error)}>
	{() => translations.common.pages.main.title}
</Safe>
```

**Props:**

- `children` - Function that returns a string (called during render)
- `errorComponent` - Component to display if an error occurs (default: empty string)
- `errorHandler` - Optional error handler callback

## SSR/SSG Support

### Next.js Pages Router

```typescript
// pages/_app.tsx
import { I18nTypedStoreProvider } from 'i18n-typed-store-react';
import { storeFactory } from '../lib/i18n';
import type { AppProps } from 'next/app';

const store = storeFactory.type<TranslationData>();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <I18nTypedStoreProvider store={store}>
      <Component {...pageProps} />
    </I18nTypedStoreProvider>
  );
}

export default MyApp;
```

```typescript
// pages/index.tsx
import type { GetServerSidePropsContext } from 'next';
import { getLocaleFromRequest, initializeStore } from 'i18n-typed-store-react';
import { storeFactory } from '../lib/i18n';
import type { TranslationData } from '../lib/i18n';

export async function getServerSideProps(context: GetServerSidePropsContext) {
	const locale = getLocaleFromRequest(context, {
		defaultLocale: 'en',
		availableLocales: ['en', 'ru'],
		cookieName: 'locale',
		queryParamName: 'locale',
	});

	const store = storeFactory.type<TranslationData>();
	initializeStore(store, locale);

	// Preload translations if needed
	await store.translations.common.load(locale);

	return {
		props: {
			locale,
		},
	};
}
```

### Next.js App Router

```typescript
// app/layout.tsx
import { I18nTypedStoreProvider } from 'i18n-typed-store-react';
import { storeFactory } from '../lib/i18n';
import type { TranslationData } from '../lib/i18n';

const store = storeFactory.type<TranslationData>();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <I18nTypedStoreProvider store={store}>
          {children}
        </I18nTypedStoreProvider>
      </body>
    </html>
  );
}
```

```typescript
// app/page.tsx
import { getLocaleFromRequest, initializeStore } from 'i18n-typed-store-react';
import { storeFactory } from '../lib/i18n';
import type { TranslationData } from '../lib/i18n';
import { headers, cookies } from 'next/headers';

export default async function Page() {
  const headersList = await headers();
  const cookieStore = await cookies();

  const locale = getLocaleFromRequest(
    {
      headers: Object.fromEntries(headersList),
      cookies: Object.fromEntries(cookieStore),
    },
    {
      defaultLocale: 'en',
      availableLocales: ['en', 'ru'],
    }
  );

  const store = storeFactory.type<TranslationData>();
  initializeStore(store, locale);
  await store.translations.common.load(locale);

  return <div>...</div>;
}
```

### SSR API

#### `getLocaleFromRequest`

Gets locale from SSR request context (query params, cookies, headers).

```typescript
function getLocaleFromRequest<L extends Record<string, string>>(context: RequestContext, options: GetLocaleFromRequestOptions): keyof L;
```

**Parameters:**

- `context` - Request context with `query`, `cookies`, and `headers`
- `options` - Options object:
    - `defaultLocale` - Default locale to use if locale cannot be determined
    - `availableLocales` - Array of available locale keys for validation
    - `headerName` - Header name to read locale from (default: `'accept-language'`)
    - `cookieName` - Cookie name to read locale from
    - `queryParamName` - Query parameter name to read locale from (default: `'locale'`)
    - `parseAcceptLanguage` - Whether to parse Accept-Language header (default: `true`)

**Example:**

```typescript
const locale = getLocaleFromRequest(context, {
	defaultLocale: 'en',
	availableLocales: ['en', 'ru'],
	cookieName: 'locale',
	queryParamName: 'locale',
	headerName: 'accept-language',
	parseAcceptLanguage: true,
});
```

#### `initializeStore`

Initializes translation store with a specific locale for SSR.

```typescript
function initializeStore<N, L, M>(store: TranslationStore<N, L, M>, locale: keyof L): void;
```

**Parameters:**

- `store` - Translation store instance
- `locale` - Locale to initialize with

**Example:**

```typescript
const locale = getLocaleFromRequest(context, {
	defaultLocale: 'en',
	availableLocales: ['en', 'ru'],
});

const store = storeFactory.type<TranslationData>();
initializeStore(store, locale);
```

## Complete Example

```typescript
// constants.ts
export const TRANSLATIONS = {
	common: 'common',
	errors: 'errors',
} as const;

export const LOCALES = {
	en: 'en',
	ru: 'ru',
} as const;
```

```typescript
// translations/common/en.tsx
import { createPluralSelector } from 'i18n-typed-store';

const plur = createPluralSelector('en');

export default class CommonTranslationsEn {
	title = 'Welcome';
	greeting = 'Hello, World!';

	buttons = {
		save: 'Save',
		cancel: 'Cancel',
	};

	items = (count: number) =>
		count +
		' ' +
		plur(count, {
			one: 'item',
			other: 'items',
		});
}
```

```typescript
// store.ts
import { createTranslationStore } from 'i18n-typed-store';
import type CommonTranslationsEn from './translations/common/en';
import { TRANSLATIONS, LOCALES } from './constants';

export interface ITranslationStoreTypes extends Record<keyof typeof TRANSLATIONS, any> {
	common: CommonTranslationsEn;
}

export const store = createTranslationStore({
	namespaces: TRANSLATIONS,
	locales: LOCALES,
	loadModule: async (locale, namespace) => {
		return await import(`./translations/${namespace}/${locale}.tsx`);
	},
	extractTranslation: (module) => new module.default(),
	defaultLocale: 'en',
}).type<ITranslationStoreTypes>();
```

```typescript
// hooks/useTranslation.ts
import { useI18nTranslation } from 'i18n-typed-store-react/useI18nTranslation';
import type { TRANSLATIONS, LOCALES } from '../constants';
import type { ITranslationStoreTypes } from '../store';

export const useTranslation = <K extends keyof typeof TRANSLATIONS>(translation: K) => {
	return useI18nTranslation<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, K>(translation);
};
```

```tsx
// App.tsx
import { I18nTypedStoreProvider } from 'i18n-typed-store-react';
import { store } from './store';
import { MyComponent } from './MyComponent';

function App() {
	return (
		<I18nTypedStoreProvider store={store}>
			<MyComponent />
		</I18nTypedStoreProvider>
	);
}

export default App;
```

```tsx
// MyComponent.tsx
import { useTranslation } from './hooks/useTranslation';
import { useI18nLocale } from 'i18n-typed-store-react';

function MyComponent() {
	const translations = useTranslation('common');
	const { locale, setLocale } = useI18nLocale();

	if (!translations) {
		return <div>Loading...</div>;
	}

	return (
		<div>
			<h1>{translations.title}</h1>
			<p>{translations.greeting}</p>
			<p>{translations.items(5)}</p>
			<button onClick={() => setLocale(locale === 'en' ? 'ru' : 'en')}>Switch to {locale === 'en' ? 'Russian' : 'English'}</button>
		</div>
	);
}
```

## Type Safety

All hooks and components are fully type-safe:

```tsx
// ✅ TypeScript knows all available translation keys
const translations = useTranslation('common');
if (translations) {
	const title = translations.title; // ✅ Type-safe
	const greeting = translations.greeting; // ✅ Type-safe
}

// ❌ TypeScript error: 'invalidKey' doesn't exist
// const invalid = translations.invalidKey;

// ✅ TypeScript knows all available locales
const { locale, setLocale } = useI18nLocale();
setLocale('en'); // ✅ Type-safe
setLocale('ru'); // ✅ Type-safe

// ❌ TypeScript error: 'fr' is not a valid locale
// setLocale('fr');
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Alexander Lvov

## Related

- [i18n-typed-store](https://github.com/ialexanderlvov/i18n-typed-store) - Core library
- [React Example](https://github.com/ialexanderlvov/i18n-typed-store-react-example) - Complete working example with React, TypeScript, and all features demonstrated

## Repository

[GitHub](https://github.com/ialexanderlvov/i18n-typed-store)
