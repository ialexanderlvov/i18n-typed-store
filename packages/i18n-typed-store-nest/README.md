# i18n-typed-store-nest

> ⚠️ **WARNING: The library API is under active development and may change significantly between versions. Use exact versions in package.json and carefully read the changelog when updating.**

Type-safe translation store for NestJS with full TypeScript support. Integration of `i18n-typed-store` for NestJS applications with automatic locale detection from requests, decorators for convenient access to translations, and preload support.

## Features

- ✅ **Full TypeScript support** - Complete type safety for translations and locales
- ✅ **IDE integration** - Go-to definition, autocomplete with translation classes
- ✅ **Automatic locale detection** - From query parameters, cookies, headers, route parameters
- ✅ **Decorators** - Convenient decorators `@I18n()`, `@Locale()`, `@Translation()` for accessing translations
- ✅ **Global Interceptor** - Automatic interceptor registration for locale detection
- ✅ **Middleware support** - Alternative to interceptor via middleware
- ✅ **Translation preloading** - Automatic preloading on module initialization
- ✅ **Type-safe API** - Compile-time validation of translation keys and locales
- ✅ **Lazy loading** - Load translations only when needed
- ✅ **Fallback locales** - Automatic merging with fallback translations

## Installation

```bash
npm install i18n-typed-store-nest
```

```bash
yarn add i18n-typed-store-nest
```

```bash
pnpm add i18n-typed-store-nest
```

## Quick Start

### 1. Creating translation store

First, create a translation store (shared across the project):

```typescript
// i18n/store.ts
import { createTranslationStore } from 'i18n-typed-store';
import type CommonTranslationsEn from './translations/common/en';
import type ErrorsTranslationsEn from './translations/errors/en';

const namespaces = { common: 'common', errors: 'errors' } as const;
const locales = { en: 'en', ru: 'ru' } as const;

export interface ITranslationStoreTypes extends Record<keyof typeof namespaces, any> {
	common: CommonTranslationsEn;
	errors: ErrorsTranslationsEn;
}

export const store = createTranslationStore({
	namespaces,
	locales,
	loadModule: async (locale, namespace) => {
		return await import(`./translations/${namespace}/${locale}.ts`);
	},
	extractTranslation: (module) => new module.default(),
	defaultLocale: 'en',
	useFallback: true,
	fallbackLocale: 'en',
}).type<ITranslationStoreTypes>();
```

### 2. Module configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { I18nModule } from 'i18n-typed-store-nest';
import { store } from './i18n/store';

@Module({
	imports: [
		I18nModule.forRoot({
			store,
			defaultLocale: 'en',
			availableLocales: ['en', 'ru'],
			headerName: 'accept-language',
			queryParamName: 'locale',
			cookieName: 'locale',
			parseAcceptLanguage: true,
			// Preload all translations on initialization
			preload: true,
		}),
	],
})
export class AppModule {}
// I18nInterceptor is automatically registered and will detect locale from each request
```

### 3. Using decorators

The module automatically detects locale from the request (query parameters, cookies, headers) and sets it in the service. You can use decorators to access translations:

```typescript
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { I18n, Locale, Translation } from 'i18n-typed-store-nest';
import type CommonTranslationsEn from './translations/common/en';

@Controller()
export class AppController {
	@Get()
	async getData(@I18n() i18n: I18nService, @Locale() locale: string, @Translation('common') translation: CommonTranslationsEn) {
		// Use I18nService directly
		const currentLocale = i18n.getLocale();

		// Load translation if needed
		await i18n.loadTranslation('errors');
		const errorTranslation = i18n.getCurrentTranslation('errors');

		// Use translation from decorator
		return {
			locale,
			greeting: translation.greeting,
			title: translation.title,
			errorMessage: errorTranslation?.notFound,
		};
	}
}
```

### 4. Using `getTranslationByKey` method

To get translations by string keys, use the `getTranslationByKey` method:

```typescript
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { I18n } from 'i18n-typed-store-nest';

@Controller()
export class AppController {
	@Get()
	async getData(@I18n() i18n: I18nService) {
		// Get entire namespace object
		const common = i18n.getTranslationByKey('common');
		// Returns: { greeting: string, title: string, ... }

		// Get specific value
		const greeting = i18n.getTranslationByKey('common.greeting');
		// Returns: string ("Hello")

		// Get nested value
		const saveButton = i18n.getTranslationByKey('common.buttons.save');
		// Returns: string ("Save")

		// Get with specified locale
		const greetingRu = i18n.getTranslationByKey('common.greeting', 'ru');
		// Returns: string ("Привет")

		return {
			greeting,
			saveButton,
		};
	}
}
```

## Module Configuration

### I18nModule.forRoot

The module is configured via `I18nModule.forRoot()`:

```typescript
I18nModule.forRoot<N, L, M>(options: I18nModuleOptions<N, L, M>): DynamicModule
```

**Options:**

- `store` - Translation store instance (required)
- `defaultLocale` - Default locale (required)
- `availableLocales` - Array of available locales for validation (optional)
- `headerName` - Header name for extracting locale (default: `'accept-language'`)
- `queryParamName` - Query parameter name for extracting locale (default: `'locale'`)
- `cookieName` - Cookie name for extracting locale (default: `'locale'`)
- `parseAcceptLanguage` - Whether to parse Accept-Language header (default: `true`)
- `preload` - Translation preload configuration:
    - `true` - preload all namespaces and locales
    - Object with settings:
        - `namespaces` - Array of namespaces to preload (if not specified, all are loaded)
        - `locales` - Array of locales to preload (if not specified, all are loaded)
        - `fromCache` - Whether to use cache when preloading (default: `true`)
    - If not specified, preloading is not performed

**Examples:**

```typescript
// Preload all translations
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: true,
});

// Preload specific namespaces
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: {
		namespaces: ['common', 'errors'],
		locales: ['en', 'ru'],
	},
});

// Without preloading
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	// preload not specified
});
```

## Using Decorators

### `@I18n()`

Gets the I18nService instance:

```typescript
@Get()
async getData(@I18n() i18n: I18nService) {
  const translation = i18n.getCurrentTranslation('common');
  return translation?.greeting;
}
```

### `@Locale()`

Gets the current locale as a string:

```typescript
@Get()
async getData(@Locale() locale: string) {
  return { locale };
}
```

### `@Translation(namespace)`

Gets the translation for the specified namespace. Translation is loaded automatically if not yet loaded:

```typescript
@Get()
async getData(@Translation('common') translation: CommonTranslationsEn) {
  return translation.greeting;
}
```

**Important:** The `@Translation()` decorator automatically loads the translation if it is not yet loaded. This happens asynchronously, so the method must be `async`.

## I18nService API

Service for working with translations and locales. Can be injected directly into controllers and services:

```typescript
@Injectable()
export class AppService {
	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18nService: I18nService,
	) {}
}
```

Or use the `I18N_SERVICE` token:

```typescript
import { I18N_SERVICE, I18nService } from 'i18n-typed-store-nest';

@Injectable()
export class AppService {
	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18nService: I18nService,
	) {}
}
```

### Methods

#### `setLocale(locale: keyof L): void`

Sets the current locale.

```typescript
this.i18nService.setLocale('ru');
```

#### `getLocale(): keyof L`

Returns the current locale.

```typescript
const locale = this.i18nService.getLocale(); // 'en'
```

#### `getLocales(): L`

Returns an object with available locales.

```typescript
const locales = this.i18nService.getLocales(); // { en: 'en', ru: 'ru' }
```

#### `loadTranslation(namespace: K, locale?: keyof L, fromCache?: boolean): Promise<void>`

Loads translation for the specified namespace.

```typescript
await this.i18nService.loadTranslation('common', 'en');
await this.i18nService.loadTranslation('common'); // uses current locale
```

#### `getTranslation(namespace: K, locale?: keyof L): Promise<M[K]>`

Gets translation for the specified namespace. Automatically loads translation if not yet loaded.

```typescript
const translation = await this.i18nService.getTranslation('common', 'en');
const translation = await this.i18nService.getTranslation('common'); // uses current locale
```

#### `getCurrentTranslation(namespace: K): M[K] | undefined`

Gets the current translation for the specified namespace (without automatic loading).

```typescript
const translation = this.i18nService.getCurrentTranslation('common');
// Returns undefined if translation is not loaded
```

#### `getTranslationByKey(key: Key, locale?: keyof L): GetTranslationValue<M, Key>`

Gets translation value by key. Supports string keys in the format `"namespace"`, `"namespace.key"` or `"namespace.nested.key"`.

```typescript
// Get entire namespace
const common = this.i18nService.getTranslationByKey('common');

// Get specific value
const greeting = this.i18nService.getTranslationByKey('common.greeting');

// Get nested value
const saveButton = this.i18nService.getTranslationByKey('common.buttons.save');

// With locale specified
const greetingRu = this.i18nService.getTranslationByKey('common.greeting', 'ru');
```

#### `getStore(): TranslationStore<N, L, M>`

Returns the translation store instance for direct access to store API.

```typescript
const store = this.i18nService.getStore();
store.changeLocale('ru');
```

## I18nInterceptor

Global interceptor that automatically detects locale from the request and sets it in I18nService. Registered automatically when using `I18nModule.forRoot()`.

### Automatic Registration (Recommended)

Interceptor is automatically registered as a global interceptor when using `I18nModule.forRoot()`. No additional configuration needed:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { I18nModule } from 'i18n-typed-store-nest';
import { store } from './i18n/store';

@Module({
	imports: [
		I18nModule.forRoot({
			store,
			defaultLocale: 'en',
			availableLocales: ['en', 'ru'],
		}),
	],
})
export class AppModule {}
// I18nInterceptor is automatically registered and will work for all requests
```

### Controller/Method Level Usage

You can also apply the interceptor to specific controllers or methods:

```typescript
// app.controller.ts
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { I18nInterceptor } from 'i18n-typed-store-nest';

@Controller()
@UseInterceptors(I18nInterceptor) // Apply to all methods in this controller
export class AppController {
	@Get()
	@UseInterceptors(I18nInterceptor) // Or apply to specific method
	async getData() {
		// Locale is automatically detected and set
		return { message: 'Hello' };
	}
}
```

### How It Works

1. Intercepts all incoming HTTP requests
2. Extracts locale from request (query parameters, cookies, headers, route parameters)
3. Sets locale in I18nService
4. Attaches I18nService to request object for use in parameter decorators
5. Continues with request processing

## Using Middleware (Alternative to Interceptor)

If you prefer using middleware instead of a global interceptor:

```typescript
// app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { I18nModule, I18nMiddleware } from 'i18n-typed-store-nest';
import { store } from './i18n/store';

@Module({
	imports: [
		I18nModule.forRoot({
			store,
			defaultLocale: 'en',
			availableLocales: ['en', 'ru'],
		}),
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(I18nMiddleware).forRoutes('*');
	}
}
```

**Note:** When using middleware, the interceptor is still automatically registered. You can disable it by removing it from `providers` in `I18nModule.forRoot()`, but this requires module modification. In most cases, using the interceptor is sufficient.

## Locale Detection

The module automatically detects locale from the request in the following priority order:

1. **Query parameter** (e.g., `?locale=en`)
2. **Route parameter** (e.g., `/api/:locale/users`)
3. **Cookie** (e.g., `locale=en`)
4. **Header `Accept-Language`** (parsed automatically)
5. **Default locale** (from configuration)

**Example request:**

```http
GET /api/data?locale=ru
Cookie: locale=en
Header: Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8
```

Result: locale will be `'ru'` (query parameter has highest priority).

### Accept-Language Parsing

When `parseAcceptLanguage: true`, the module parses the `Accept-Language` header according to RFC 2616 standard:

```http
Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7
```

The module:

1. Parses languages by priority (q-value)
2. Searches for exact match with available locales
3. Searches for base language match (e.g., `ru` from `ru-RU`)
4. Uses default locale if nothing is found

## Type-Safe Translations

All translations are fully type-safe:

```typescript
@Controller()
export class AppController {
	@Get()
	async getData(@Translation('common') translation: CommonTranslationsEn) {
		// ✅ TypeScript knows all translation keys
		const greeting = translation.greeting;
		const title = translation.title;

		// ❌ TypeScript error: Property 'invalidKey' does not exist
		// const invalid = translation.invalidKey;

		return { greeting, title };
	}
}
```

### Translation Class Structure

The library is designed to work with TypeScript classes for translations, providing full type safety and IDE support (go-to definition, autocomplete). Example translation class:

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

**Benefits of using classes:**

- ✅ Full TypeScript type safety with IDE go-to definition support
- ✅ Methods for pluralization and dynamic translations
- ✅ Better code organization and maintainability
- ✅ Compile-time validation of translation keys

## Examples

### Complete Controller Example

```typescript
// app.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { I18n, Locale, Translation } from 'i18n-typed-store-nest';
import type CommonTranslationsEn from './translations/common/en';
import type ErrorsTranslationsEn from './translations/errors/en';

@Controller('api')
export class AppController {
	@Get('greeting')
	async getGreeting(@Locale() locale: string, @Translation('common') translation: CommonTranslationsEn) {
		return {
			locale,
			message: translation.greeting,
			title: translation.title,
		};
	}

	@Get('errors/:code')
	async getError(@Param('code') code: string, @I18n() i18n: I18nService) {
		await i18n.loadTranslation('errors');
		const errors = i18n.getCurrentTranslation('errors');

		return {
			error: errors?.[code] || 'Unknown error',
		};
	}

	@Post('change-locale')
	async changeLocale(@Body('locale') locale: 'en' | 'ru', @I18n() i18n: I18nService) {
		i18n.setLocale(locale);
		return { success: true, locale: i18n.getLocale() };
	}
}
```

### Service Example

```typescript
// app.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { I18N_SERVICE, I18nService } from 'i18n-typed-store-nest';

@Injectable()
export class AppService {
	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18nService: I18nService,
	) {}

	async getGreeting() {
		// Load translation
		await this.i18nService.loadTranslation('common');

		// Get translation
		const translation = this.i18nService.getCurrentTranslation('common');

		return translation?.greeting || 'Hello';
	}

	async changeLocale(locale: 'en' | 'ru') {
		this.i18nService.setLocale(locale);
	}

	async getLocalizedMessage(key: string) {
		// Use getTranslationByKey for string keys
		return this.i18nService.getTranslationByKey(`common.${key}`);
	}
}
```

### Pluralization Example

```typescript
// translations/products/en.ts
import { createPluralSelector } from 'i18n-typed-store';

const plur = createPluralSelector('en');

export default class ProductsTranslationsEn {
	title = 'Products';
	addToCart = 'Add to Cart';

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
```

```typescript
// products.controller.ts
@Controller('products')
export class ProductsController {
	@Get('count')
	async getCount(@Query('count') count: number, @Translation('products') translation: ProductsTranslationsEn) {
		return {
			message: translation.productCount(count),
			cartMessage: translation.itemsInCart(count),
		};
	}
}
```

## Translation Preloading

The module supports translation preloading on initialization. This is useful for preloading frequently used translations.

### Preload All Translations

```typescript
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: true, // Preload all namespaces and locales
});
```

### Preload Specific Namespaces

```typescript
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: {
		namespaces: ['common', 'errors'],
		locales: ['en', 'ru'],
	},
});
```

### Preload Specific Locales

```typescript
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: {
		locales: ['en'], // English only
	},
});
```

### Without Preloading

```typescript
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	// preload not specified - translations are loaded on demand
});
```

## Advanced Scenarios

### Working with Multiple Namespaces

```typescript
@Controller()
export class AppController {
	@Get()
	async getData(@I18n() i18n: I18nService) {
		// Load multiple translations
		await Promise.all([i18n.loadTranslation('common'), i18n.loadTranslation('errors'), i18n.loadTranslation('ui')]);

		// Use translations
		const common = i18n.getCurrentTranslation('common');
		const errors = i18n.getCurrentTranslation('errors');
		const ui = i18n.getCurrentTranslation('ui');

		return {
			greeting: common?.greeting,
			notFound: errors?.notFound,
			saveButton: ui?.buttons?.save,
		};
	}
}
```

### Using getTranslationByKey for Dynamic Keys

```typescript
@Controller()
export class AppController {
	@Get('messages/:key')
	async getMessage(@Param('key') key: string, @I18n() i18n: I18nService) {
		// Use dynamic keys (with loss of type safety)
		const message = i18n.getTranslationByKey(`common.${key}` as any);
		return { message };
	}
}
```

### Direct Store Access

```typescript
@Controller()
export class AppController {
	@Get()
	async getData(@I18n() i18n: I18nService) {
		const store = i18n.getStore();

		// Direct access to store API
		store.changeLocale('ru');
		await store.translations.common.load('ru');

		return store.translations.common.currentTranslation;
	}
}
```

## API Reference

### `I18nModule`

Global NestJS module for internationalization.

```typescript
I18nModule.forRoot<N, L, M>(options: I18nModuleOptions<N, L, M>): DynamicModule
```

### `I18nService`

Service for working with translations and locales.

```typescript
class I18nService<N, L, M> {
	setLocale(locale: keyof L): void;
	getLocale(): keyof L;
	getLocales(): L;
	loadTranslation<K extends keyof N>(namespace: K, locale?: keyof L, fromCache?: boolean): Promise<void>;
	getTranslation<K extends keyof N>(namespace: K, locale?: keyof L): Promise<M[K]>;
	getCurrentTranslation<K extends keyof N>(namespace: K): M[K] | undefined;
	getTranslationByKey<Key extends TranslationKeys<M>>(key: Key, locale?: keyof L): GetTranslationValue<M, Key>;
	getStore(): TranslationStore<N, L, M>;
}
```

### `I18nInterceptor`

Global interceptor that automatically detects and sets locale from request. Registered automatically when using `I18nModule.forRoot()`.

### `I18nMiddleware`

Alternative to interceptor for setting locale from request. Can be used manually:

```typescript
consumer.apply(I18nMiddleware).forRoutes('*');
```

### Decorators

#### `@I18n()`

Gets the I18nService instance.

```typescript
@Get()
async getData(@I18n() i18n: I18nService) {
  const translation = i18n.getTranslation('common');
  return translation?.greeting;
}
```

#### `@Locale()`

Gets the current locale as a string.

```typescript
@Get()
async getData(@Locale() locale: string) {
  return { locale };
}
```

#### `@Translation(namespace)`

Gets the translation for the specified namespace.

```typescript
@Get()
async getData(@Translation('common') translation: CommonTranslationsEn) {
  return translation.greeting;
}
```

## Dependency Injection Tokens

The library exports tokens for use in dependency injection:

- `I18N_STORE` - Token for translation store
- `I18N_OPTIONS` - Token for module options
- `I18N_SERVICE` - Token for I18nService (recommended to use this token for service injection)

## License

MIT

## Author

Alexander Lvov

## Repository

[GitHub](https://github.com/ialexanderlvov/i18n-typed-store)

## Related Packages

- [i18n-typed-store](../i18n-typed-store/README.md) - Core library
- [i18n-typed-store-react](../i18n-typed-store-react/README.md) - React integration
