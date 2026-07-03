# i18n-typed-store-react

[![npm version](https://img.shields.io/npm/v/i18n-typed-store-react.svg)](https://www.npmjs.com/package/i18n-typed-store-react)
[![CI](https://github.com/ialexanderlvov/i18n-typed-store/actions/workflows/ci.yml/badge.svg)](https://github.com/ialexanderlvov/i18n-typed-store/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/i18n-typed-store-react.svg)](https://github.com/ialexanderlvov/i18n-typed-store/blob/main/LICENSE)

> ⚠️ **WARNING: The library API is under active development and may change significantly between versions. Use exact versions in package.json and read the changelog carefully when updating.**

React integration for [i18n-typed-store](https://github.com/ialexanderlvov/i18n-typed-store) - a type-safe translation store for managing i18n locales with full TypeScript support. Provides React hooks, components, and SSR utilities for seamless integration with React applications.

## Features

- ✅ **React Hooks** - `useI18nTranslation`, `useI18nTranslationLazy`, `useI18nLocale`
- ✅ **Concurrent-Safe** - All hooks read store state through `useSyncExternalStore` (no tearing, no lost updates)
- ✅ **React Suspense Support** - Built-in support for React Suspense with lazy loading
- ✅ **Provider Component** - `I18nTypedStoreProvider` for providing translation context
- ✅ **SSR/SSG Support** - Utilities for Next.js and other SSR frameworks, with a dedicated `i18n-typed-store-react/server` entry point for Server Components
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

> A module-scope store like this is fine for **client-only** apps. When rendering on a server, create a fresh store per request instead — see [SSR/SSG Support](#ssrssg-support).

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
import { useI18nTranslation } from 'i18n-typed-store-react';
import type { TRANSLATIONS, LOCALES } from '../constants';
import type { ITranslationStoreTypes } from '../store';

export const useTranslation = <K extends keyof typeof TRANSLATIONS>(translation: K) => {
	return useI18nTranslation<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, K>(translation);
};
```

```typescript
// hooks/useTranslationLazy.ts
import { useI18nTranslationLazy } from 'i18n-typed-store-react';
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
- `suspenseMode` - Suspense mode for `useI18nTranslationLazy`: `'once'` | `'first-load-locale'` | `'change-locale'` (default: `'first-load-locale'`)
    - `'once'` - Suspends only until the **first** translation data is available. After that the hook never suspends again: on a locale switch it keeps returning the previous locale's translation while the new one loads in the background, then re-renders with the new data once it lands.
    - `'first-load-locale'` - Suspends on the first load of **each** locale. Once a locale has been loaded, switching back to it never suspends again.
    - `'change-locale'` - Suspends on **every** locale change until the new locale's translation becomes active.
- `children` - React children

In every mode, if a load fails and a previously loaded translation exists, the hook degrades to that last good translation instead of suspending forever. If the **very first** load fails and there is no data at all to show, the hook throws the load error itself — catch it with an [Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary) (see `useI18nTranslationLazy` below).

### `useI18nTranslation`

Hook for accessing translations with automatic loading. Returns `undefined` if translation is not yet loaded.

```tsx
// Direct usage (fromCache is optional and defaults to true)
const translations = useI18nTranslation<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, 'common'>('common');

// Typed wrapper (recommended)
import { useI18nTranslation } from 'i18n-typed-store-react';
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

Hook for accessing translations with React Suspense support. Throws a promise if translation is not loaded. When and how often it suspends is controlled by the provider's `suspenseMode` (see above).

```tsx
// Direct usage (fromCache is optional and defaults to true)
const translations = useI18nTranslationLazy<typeof TRANSLATIONS, typeof LOCALES, ITranslationStoreTypes, 'common'>('common');

// Typed wrapper (recommended)
import { useI18nTranslationLazy } from 'i18n-typed-store-react';
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

**Throws:**

- A `Promise` while the translation is loading (caught by the nearest `<Suspense>` boundary)
- The **load error itself** when the very first load fails and there is no translation at all to fall back to — catch it with an Error Boundary. Once any translation has been rendered, later load failures degrade to the last good translation instead of throwing.

```tsx
<ErrorBoundary fallback={<p>Failed to load translations</p>}>
	<Suspense fallback={<Loading />}>
		<MyComponent />
	</Suspense>
</ErrorBoundary>
```

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

The extracted string is rendered as-is (no wrapper element is added). Thrown thenables (React Suspense signals) are re-thrown untouched, so `children` may safely read suspending resources — the surrounding `<Suspense>` boundary keeps working.

## SSR/SSG Support

> ⚠️ **Concurrency warning.** The store is mutable, shared state: `changeLocale`/`initializeStore`
> write `store.currentLocale` and `load()` writes the per-locale cache on the _same_ object.
> A Node server serves many requests against one module instance and interleaves them at every
> `await`, so a **single module-level store shared across requests will leak one user's locale and
> translations into another user's response**. Create a **fresh store per request** (call
> `storeFactory.type<...>()` inside the request handler / loader and pass it to the Provider) and
> never reuse one module-scoped store across concurrent SSR requests.

### The `/server` entry point

The main `i18n-typed-store-react` bundle is emitted with a `"use client"` directive (everything it exports is a client-only React construct: context, hooks). Importing it from a React Server Component or from `getServerSideProps`-adjacent server code therefore fails or drags client-only code into the server graph.

Server code must import the SSR utilities from the dedicated server entry point instead:

```typescript
// ✅ In Server Components, route handlers, getServerSideProps, loaders:
import { getLocaleFromRequest, initializeStore } from 'i18n-typed-store-react/server';

// ❌ Not from the root — it is bundled with "use client":
// import { getLocaleFromRequest } from 'i18n-typed-store-react';
```

`i18n-typed-store-react/server` also re-exports the whole `i18n-typed-store` core (`createTranslationStore`, `getTranslation`, `findBestLocaleMatch`, ...), so server code can create and preload stores from a single import. The root entry still re-exports the SSR utilities for backwards compatibility, but only client modules can import it.

### Server rendering requires preloading

`useI18nTranslation` and `useI18nTranslationLazy` trigger translation loading from their store subscription, which runs in an **effect** — and effects never run during `renderToString`/`renderToPipeableStream` or in Server Components. Server-rendered markup therefore only contains translations that were **already in the store before rendering started**. Preload them explicitly:

```typescript
const store = storeFactory.type<TranslationData>(); // fresh per request
initializeStore(store, locale); // set the request's locale
await store.translations.common.load(locale); // preload every namespace you render
```

Without preloading, the server output renders the "not loaded" state (`undefined` from `useI18nTranslation`, a suspended fallback from `useI18nTranslationLazy`) and the real translations only appear after client-side hydration.

The examples below share this setup — note that it exports the **factory**, not a store instance, so every caller can create its own per-request store:

```typescript
// lib/i18n.ts
import { createTranslationStore } from 'i18n-typed-store';
import type CommonTranslationsEn from '../translations/common/en';
import { TRANSLATIONS, LOCALES } from './constants';

export interface TranslationData extends Record<keyof typeof TRANSLATIONS, any> {
	common: CommonTranslationsEn;
}

// The factory is safe to share at module scope — it holds no per-user state.
export const storeFactory = createTranslationStore({
	namespaces: TRANSLATIONS,
	locales: LOCALES,
	loadModule: async (locale, namespace) => import(`../translations/${namespace}/${locale}.tsx`),
	extractTranslation: (module) => new module.default(),
	defaultLocale: 'en',
});
```

### Next.js Pages Router

```tsx
// pages/_app.tsx
import { useState } from 'react';
import { I18nTypedStoreProvider } from 'i18n-typed-store-react';
import { storeFactory } from '../lib/i18n';
import type { TranslationData } from '../lib/i18n';
import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
	// One store per rendered tree: on the server a fresh instance is created for
	// every request (no module-scope sharing), in the browser it is created once.
	const [store] = useState(() => {
		const store = storeFactory.type<TranslationData>();
		if (pageProps.locale) {
			store.changeLocale(pageProps.locale);
		}
		return store;
	});

	return (
		<I18nTypedStoreProvider store={store}>
			<Component {...pageProps} />
		</I18nTypedStoreProvider>
	);
}

export default MyApp;
```

```typescript
// pages/index.tsx — server-side locale detection.
// Note the import from 'i18n-typed-store-react/server': this file's exports run
// on the server, where the client-marked root bundle must not be imported.
import type { GetServerSidePropsContext } from 'next';
import { getLocaleFromRequest, initializeStore } from 'i18n-typed-store-react/server';
import { storeFactory } from '../lib/i18n';
import type { TranslationData } from '../lib/i18n';

export async function getServerSideProps(context: GetServerSidePropsContext) {
	const locale = getLocaleFromRequest(context, {
		defaultLocale: 'en',
		availableLocales: ['en', 'ru'],
		cookieName: 'locale',
		queryParamName: 'locale',
	});

	// Per-request store, created inside the handler — never at module scope.
	const store = storeFactory.type<TranslationData>();
	initializeStore(store, locale);

	// Preload translations if you render translated text on the server
	await store.translations.common.load(locale);

	return {
		props: {
			locale,
		},
	};
}
```

### Next.js App Router

Detect the locale per request in a Server Component (importing from `i18n-typed-store-react/server`) and pass the initial state down to a small client component that owns the store:

```tsx
// app/providers.tsx — client component that owns the per-tree store
'use client';

import { useState } from 'react';
import { I18nTypedStoreProvider } from 'i18n-typed-store-react';
import { storeFactory } from '../lib/i18n';
import type { TranslationData } from '../lib/i18n';

export function I18nProviders({ locale, children }: { locale: string; children: React.ReactNode }) {
	// One store per rendered tree, initialized from the server-detected locale.
	// Never create the store at module scope: on the server that single instance
	// would be shared (and mutated) by every concurrent request.
	const [store] = useState(() => {
		const store = storeFactory.type<TranslationData>();
		store.changeLocale(locale);
		return store;
	});

	return <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>;
}
```

```tsx
// app/layout.tsx — React Server Component: detect the locale per request
import { headers, cookies } from 'next/headers';
import { getLocaleFromRequest } from 'i18n-typed-store-react/server';
import { I18nProviders } from './providers';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const headersList = await headers();
	const cookieStore = await cookies();

	const locale = getLocaleFromRequest(
		{
			headers: Object.fromEntries(headersList),
			cookies: Object.fromEntries(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value])),
		},
		{
			defaultLocale: 'en',
			availableLocales: ['en', 'ru'],
			cookieName: 'locale',
		},
	);

	return (
		<html lang={locale}>
			<body>
				<I18nProviders locale={locale}>{children}</I18nProviders>
			</body>
		</html>
	);
}
```

A Server Component that renders translated text itself creates its own per-request store and reads from it directly (hooks are client-only):

```tsx
// app/page.tsx — React Server Component rendering translated text
import { headers, cookies } from 'next/headers';
import { getLocaleFromRequest, initializeStore } from 'i18n-typed-store-react/server';
import { storeFactory } from '../lib/i18n';
import type { TranslationData } from '../lib/i18n';

export default async function Page() {
	const headersList = await headers();
	const cookieStore = await cookies();

	const locale = getLocaleFromRequest(
		{
			headers: Object.fromEntries(headersList),
			cookies: Object.fromEntries(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value])),
		},
		{
			defaultLocale: 'en',
			availableLocales: ['en', 'ru'],
			cookieName: 'locale',
		},
	);

	// Per-request store: created inside the request, never shared between users.
	const store = storeFactory.type<TranslationData>();
	initializeStore(store, locale);
	await store.translations.common.load(locale);

	const common = store.translations.common.currentTranslation!;

	return <h1>{common.title}</h1>;
}
```

### SSR API

Import these from `i18n-typed-store-react/server` in server code (they are also re-exported from the root for backwards-compatible client-side use).

#### `getLocaleFromRequest`

Gets locale from SSR request context. Sources are checked in priority order: **query parameter → cookie → header**.

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

**BCP 47 matching.** Query and cookie values are resolved with BCP 47 locale matching (`findBestLocaleMatch` from the core), not strict equality:

- `?locale=ru-RU` resolves to an available `'ru'` locale (region stripped when no exact match exists)
- Matching is case-insensitive per the spec: `?locale=RU` resolves to `'ru'`
- Values with no match (e.g. `?locale=ja-JP` with `['en', 'ru']`) fall through to the next source (cookie, then header)

**Accept-Language parsing.** When `headerName` is `'accept-language'` and `parseAcceptLanguage` is enabled (default), the header is parsed per RFC 9110 and each requested language is matched with BCP 47 rules, in quality order:

- Languages are sorted by their `q` values (`'en;q=0.5,ru;q=0.9'` prefers `ru`)
- A missing or malformed `q` value (`'ru;q=garbage'`) falls back to the spec default of `1`
- `q=0` means "not acceptable" and the language is skipped entirely
- Language subtags match regional locales (`'en'` matches an available `'en-US'`), but never unrelated locales that merely share a prefix (`'fr'` does **not** match `'fris'`)

**Example:**

```typescript
import { getLocaleFromRequest } from 'i18n-typed-store-react/server';

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
import { getLocaleFromRequest, initializeStore } from 'i18n-typed-store-react/server';

const locale = getLocaleFromRequest(context, {
	defaultLocale: 'en',
	availableLocales: ['en', 'ru'],
});

const store = storeFactory.type<TranslationData>(); // fresh per request
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
import { useI18nTranslation } from 'i18n-typed-store-react';
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
