# i18n-typed-store-nest

> ⚠️ **ВНИМАНИЕ: API библиотеки находится в активной разработке и может значительно изменяться от версии к версии. Используйте точные версии в package.json и внимательно читайте changelog при обновлении.**

Type-safe translation store для NestJS с полной поддержкой TypeScript. Интеграция `i18n-typed-store` для NestJS приложений с автоматическим определением локали из запросов, декораторами для удобного доступа к переводам и поддержкой предзагрузки переводов.

## Возможности

- ✅ **Полная поддержка TypeScript** - Типобезопасность для переводов и локалей
- ✅ **IDE интеграция** - Переход к определению, автодополнение с классами переводов
- ✅ **Автоматическое определение локали** - Из query параметров, cookies, headers, route параметров
- ✅ **Декораторы** - Удобные декораторы `@I18n()`, `@Locale()`, `@Translation()` для доступа к переводам
- ✅ **Global Interceptor** - Автоматическая регистрация interceptor для определения локали
- ✅ **Middleware поддержка** - Альтернатива interceptor через middleware
- ✅ **Предзагрузка переводов** - Автоматическая предзагрузка при инициализации модуля
- ✅ **Type-safe API** - Валидация ключей переводов и локалей на этапе компиляции
- ✅ **Lazy loading** - Загрузка переводов только когда необходимо
- ✅ **Fallback локали** - Автоматическое слияние с fallback переводами

## Установка

```bash
npm install i18n-typed-store-nest i18n-typed-store
```

```bash
yarn add i18n-typed-store-nest i18n-typed-store
```

```bash
pnpm add i18n-typed-store-nest i18n-typed-store
```

## Быстрый старт

### 1. Создание translation store

Сначала создайте translation store (общий для всего проекта):

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

### 2. Настройка модуля

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
			// Предзагрузка всех переводов при инициализации
			preload: true,
		}),
	],
})
export class AppModule {}
// I18nInterceptor автоматически зарегистрирован и будет определять локаль для каждого запроса
```

### 3. Использование декораторов

Модуль автоматически определяет локаль из запроса (query параметры, cookies, headers) и устанавливает её в сервисе. Вы можете использовать декораторы для доступа к переводам:

```typescript
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { I18n, Locale, Translation } from 'i18n-typed-store-nest';
import type CommonTranslationsEn from './translations/common/en';

@Controller()
export class AppController {
	@Get()
	async getData(@I18n() i18n: I18nService, @Locale() locale: string, @Translation('common') translation: CommonTranslationsEn) {
		// Использование I18nService напрямую
		const currentLocale = i18n.getLocale();

		// Загрузка перевода при необходимости
		await i18n.loadTranslation('errors');
		const errorTranslation = i18n.getCurrentTranslation('errors');

		// Использование перевода из декоратора
		return {
			locale,
			greeting: translation.greeting,
			title: translation.title,
			errorMessage: errorTranslation?.notFound,
		};
	}
}
```

### 4. Использование метода `getTranslationByKey`

Для получения переводов по строковым ключам используйте метод `getTranslationByKey`:

```typescript
// app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { I18n } from 'i18n-typed-store-nest';

@Controller()
export class AppController {
	@Get()
	async getData(@I18n() i18n: I18nService) {
		// Получение всего namespace объекта
		const common = i18n.getTranslationByKey('common');
		// Возвращает: { greeting: string, title: string, ... }

		// Получение конкретного значения
		const greeting = i18n.getTranslationByKey('common.greeting');
		// Возвращает: string ("Hello")

		// Получение вложенного значения
		const saveButton = i18n.getTranslationByKey('common.buttons.save');
		// Возвращает: string ("Save")

		// Получение с указанием локали
		const greetingRu = i18n.getTranslationByKey('common.greeting', 'ru');
		// Возвращает: string ("Привет")

		return {
			greeting,
			saveButton,
		};
	}
}
```

## Настройка модуля

### I18nModule.forRoot

Модуль настраивается через `I18nModule.forRoot()`:

```typescript
I18nModule.forRoot<N, L, M>(options: I18nModuleOptions<N, L, M>): DynamicModule
```

**Параметры:**

- `store` - Экземпляр translation store (обязательный)
- `defaultLocale` - Локаль по умолчанию (обязательный)
- `availableLocales` - Массив доступных локалей для валидации (опционально)
- `headerName` - Имя header для извлечения локали (по умолчанию: `'accept-language'`)
- `queryParamName` - Имя query параметра для извлечения локали (по умолчанию: `'locale'`)
- `cookieName` - Имя cookie для извлечения локали (по умолчанию: `'locale'`)
- `parseAcceptLanguage` - Парсить ли Accept-Language header (по умолчанию: `true`)
- `preload` - Конфигурация предзагрузки переводов:
    - `true` - предзагрузить все namespace и локали
    - Объект с настройками:
        - `namespaces` - Массив namespace для предзагрузки (если не указано, загружаются все)
        - `locales` - Массив локалей для предзагрузки (если не указано, загружаются все)
        - `fromCache` - Использовать ли кеш при предзагрузке (по умолчанию: `true`)
    - Если не указано, предзагрузка не выполняется

**Примеры:**

```typescript
// Предзагрузка всех переводов
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: true,
});

// Предзагрузка конкретных namespace
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: {
		namespaces: ['common', 'errors'],
		locales: ['en', 'ru'],
	},
});

// Без предзагрузки
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	// preload не указан
});
```

## Использование декораторов

### `@I18n()`

Получает экземпляр I18nService:

```typescript
@Get()
async getData(@I18n() i18n: I18nService) {
  const translation = i18n.getCurrentTranslation('common');
  return translation?.greeting;
}
```

### `@Locale()`

Получает текущую локаль как строку:

```typescript
@Get()
async getData(@Locale() locale: string) {
  return { locale };
}
```

### `@Translation(namespace)`

Получает перевод для указанного namespace. Перевод загружается автоматически, если ещё не загружен:

```typescript
@Get()
async getData(@Translation('common') translation: CommonTranslationsEn) {
  return translation.greeting;
}
```

**Важно:** Декоратор `@Translation()` автоматически загружает перевод, если он ещё не загружен. Это происходит асинхронно, поэтому метод должен быть `async`.

## I18nService API

Сервис для работы с переводами и локалями. Можно инжектить напрямую в контроллеры и сервисы:

```typescript
@Injectable()
export class AppService {
	constructor(
		@Inject(I18N_SERVICE)
		private readonly i18nService: I18nService,
	) {}
}
```

Или использовать токен `I18N_SERVICE`:

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

### Методы

#### `setLocale(locale: keyof L): void`

Устанавливает текущую локаль.

```typescript
this.i18nService.setLocale('ru');
```

#### `getLocale(): keyof L`

Возвращает текущую локаль.

```typescript
const locale = this.i18nService.getLocale(); // 'en'
```

#### `getLocales(): L`

Возвращает объект с доступными локалями.

```typescript
const locales = this.i18nService.getLocales(); // { en: 'en', ru: 'ru' }
```

#### `loadTranslation(namespace: K, locale?: keyof L, fromCache?: boolean): Promise<void>`

Загружает перевод для указанного namespace.

```typescript
await this.i18nService.loadTranslation('common', 'en');
await this.i18nService.loadTranslation('common'); // использует текущую локаль
```

#### `getTranslation(namespace: K, locale?: keyof L): Promise<M[K]>`

Получает перевод для указанного namespace. Автоматически загружает перевод, если он ещё не загружен.

```typescript
const translation = await this.i18nService.getTranslation('common', 'en');
const translation = await this.i18nService.getTranslation('common'); // использует текущую локаль
```

#### `getCurrentTranslation(namespace: K): M[K] | undefined`

Получает текущий перевод для указанного namespace (без автоматической загрузки).

```typescript
const translation = this.i18nService.getCurrentTranslation('common');
// Возвращает undefined, если перевод не загружен
```

#### `getTranslationByKey(key: Key, locale?: keyof L): GetTranslationValue<M, Key>`

Получает значение перевода по ключу. Поддерживает строковые ключи вида `"namespace"`, `"namespace.key"` или `"namespace.nested.key"`.

```typescript
// Получить весь namespace
const common = this.i18nService.getTranslationByKey('common');

// Получить конкретное значение
const greeting = this.i18nService.getTranslationByKey('common.greeting');

// Получить вложенное значение
const saveButton = this.i18nService.getTranslationByKey('common.buttons.save');

// С указанием локали
const greetingRu = this.i18nService.getTranslationByKey('common.greeting', 'ru');
```

#### `getStore(): TranslationStore<N, L, M>`

Возвращает экземпляр translation store для прямого доступа к store API.

```typescript
const store = this.i18nService.getStore();
store.changeLocale('ru');
```

## I18nInterceptor

Global interceptor, который автоматически определяет локаль из запроса и устанавливает её в I18nService. Регистрируется автоматически при использовании `I18nModule.forRoot()`.

### Автоматическая регистрация (Рекомендуется)

Interceptor автоматически регистрируется как global interceptor при использовании `I18nModule.forRoot()`. Дополнительная конфигурация не требуется:

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
// I18nInterceptor автоматически зарегистрирован и будет работать для всех запросов
```

### Использование на уровне контроллера/метода

Вы также можете применять interceptor к конкретным контроллерам или методам:

```typescript
// app.controller.ts
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { I18nInterceptor } from 'i18n-typed-store-nest';

@Controller()
@UseInterceptors(I18nInterceptor) // Применить ко всем методам в этом контроллере
export class AppController {
	@Get()
	@UseInterceptors(I18nInterceptor) // Или применить к конкретному методу
	async getData() {
		// Локаль автоматически определяется и устанавливается
		return { message: 'Hello' };
	}
}
```

### Как это работает

1. Перехватывает все входящие HTTP запросы
2. Извлекает локаль из запроса (query параметры, cookies, headers, route параметры)
3. Устанавливает локаль в I18nService
4. Присоединяет I18nService к объекту запроса для использования в parameter decorators
5. Продолжает обработку запроса

## Использование Middleware (Альтернатива Interceptor)

Если вы предпочитаете использовать middleware вместо global interceptor:

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

**Примечание:** При использовании middleware interceptor всё равно регистрируется автоматически. Вы можете отключить его, удалив из `providers` в `I18nModule.forRoot()`, но это потребует модификации модуля. В большинстве случаев достаточно использовать interceptor.

## Определение локали

Модуль автоматически определяет локаль из запроса в следующем порядке приоритета:

1. **Query параметр** (например, `?locale=en`)
2. **Route параметр** (например, `/api/:locale/users`)
3. **Cookie** (например, `locale=en`)
4. **Header `Accept-Language`** (парсится автоматически)
5. **Локаль по умолчанию** (из конфигурации)

**Пример запроса:**

```http
GET /api/data?locale=ru
Cookie: locale=en
Header: Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8
```

Результат: локаль будет `'ru'` (query параметр имеет наивысший приоритет).

### Парсинг Accept-Language

Когда `parseAcceptLanguage: true`, модуль парсит заголовок `Accept-Language` согласно стандарту RFC 2616:

```http
Accept-Language: ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7
```

Модуль:

1. Разбирает языки по приоритету (q-value)
2. Ищет точное совпадение с доступными локалями
3. Ищет совпадение базового языка (например, `ru` из `ru-RU`)
4. Использует локаль по умолчанию, если ничего не найдено

## Type-Safe переводы

Все переводы полностью типобезопасны:

```typescript
@Controller()
export class AppController {
	@Get()
	async getData(@Translation('common') translation: CommonTranslationsEn) {
		// ✅ TypeScript знает все ключи переводов
		const greeting = translation.greeting;
		const title = translation.title;

		// ❌ TypeScript ошибка: Property 'invalidKey' does not exist
		// const invalid = translation.invalidKey;

		return { greeting, title };
	}
}
```

### Структура классов переводов

Библиотека разработана для работы с классами TypeScript для переводов, обеспечивая полную типобезопасность и поддержку IDE (переход к определению, автодополнение). Пример класса перевода:

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

	// Метод плюрализации
	items = (count: number) =>
		count +
		' ' +
		plur(count, {
			one: 'item',
			other: 'items',
		});
}
```

**Преимущества использования классов:**

- ✅ Полная типобезопасность TypeScript с поддержкой перехода к определению в IDE
- ✅ Методы для плюрализации и динамических переводов
- ✅ Лучшая организация кода и поддерживаемость
- ✅ Валидация ключей переводов на этапе компиляции

## Примеры

### Полный пример контроллера

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

### Пример сервиса

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
		// Загрузка перевода
		await this.i18nService.loadTranslation('common');

		// Получение перевода
		const translation = this.i18nService.getCurrentTranslation('common');

		return translation?.greeting || 'Hello';
	}

	async changeLocale(locale: 'en' | 'ru') {
		this.i18nService.setLocale(locale);
	}

	async getLocalizedMessage(key: string) {
		// Использование getTranslationByKey для строковых ключей
		return this.i18nService.getTranslationByKey(`common.${key}`);
	}
}
```

### Пример с плюрализацией

```typescript
// translations/products/en.ts
import { createPluralSelector } from 'i18n-typed-store';

const plur = createPluralSelector('en');

export default class ProductsTranslationsEn {
	title = 'Products';
	addToCart = 'Add to Cart';

	// Метод плюрализации
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

## Предзагрузка переводов

Модуль поддерживает предзагрузку переводов при инициализации. Это полезно для предварительной загрузки часто используемых переводов.

### Предзагрузка всех переводов

```typescript
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: true, // Предзагрузить все namespace и локали
});
```

### Предзагрузка конкретных namespace

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

### Предзагрузка конкретных локалей

```typescript
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	preload: {
		locales: ['en'], // Только английский
	},
});
```

### Без предзагрузки

```typescript
I18nModule.forRoot({
	store,
	defaultLocale: 'en',
	// preload не указан - переводы загружаются по требованию
});
```

## Продвинутые сценарии

### Работа с несколькими namespace

```typescript
@Controller()
export class AppController {
	@Get()
	async getData(@I18n() i18n: I18nService) {
		// Загрузка нескольких переводов
		await Promise.all([i18n.loadTranslation('common'), i18n.loadTranslation('errors'), i18n.loadTranslation('ui')]);

		// Использование переводов
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

### Использование getTranslationByKey для динамических ключей

```typescript
@Controller()
export class AppController {
	@Get('messages/:key')
	async getMessage(@Param('key') key: string, @I18n() i18n: I18nService) {
		// Использование динамических ключей (с потерей типобезопасности)
		const message = i18n.getTranslationByKey(`common.${key}` as any);
		return { message };
	}
}
```

### Прямой доступ к store

```typescript
@Controller()
export class AppController {
	@Get()
	async getData(@I18n() i18n: I18nService) {
		const store = i18n.getStore();

		// Прямой доступ к store API
		store.changeLocale('ru');
		await store.translations.common.load('ru');

		return store.translations.common.currentTranslation;
	}
}
```

## API Reference

### `I18nModule`

Глобальный NestJS модуль для интернационализации.

```typescript
I18nModule.forRoot<N, L, M>(options: I18nModuleOptions<N, L, M>): DynamicModule
```

### `I18nService`

Сервис для работы с переводами и локалями.

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

Global interceptor, который автоматически определяет и устанавливает локаль из запроса. Регистрируется автоматически при использовании `I18nModule.forRoot()`.

### `I18nMiddleware`

Альтернатива interceptor для установки локали из запроса. Можно использовать вручную:

```typescript
consumer.apply(I18nMiddleware).forRoutes('*');
```

### Декораторы

#### `@I18n()`

Получает экземпляр I18nService.

```typescript
@Get()
async getData(@I18n() i18n: I18nService) {
  const translation = i18n.getTranslation('common');
  return translation?.greeting;
}
```

#### `@Locale()`

Получает текущую локаль как строку.

```typescript
@Get()
async getData(@Locale() locale: string) {
  return { locale };
}
```

#### `@Translation(namespace)`

Получает перевод для указанного namespace.

```typescript
@Get()
async getData(@Translation('common') translation: CommonTranslationsEn) {
  return translation.greeting;
}
```

## Токены для dependency injection

Библиотека экспортирует токены для использования в dependency injection:

- `I18N_STORE` - Токен для translation store
- `I18N_OPTIONS` - Токен для опций модуля
- `I18N_SERVICE` - Токен для I18nService (рекомендуется использовать этот токен для инжекции сервиса)

## Лицензия

MIT

## Автор

Alexander Lvov

## Репозиторий

[GitHub](https://github.com/ialexanderlvov/i18n-typed-store)

## Связанные пакеты

- [i18n-typed-store](../i18n-typed-store/README.md) - Основная библиотека
- [i18n-typed-store-react](../i18n-typed-store-react/README.md) - React интеграция
