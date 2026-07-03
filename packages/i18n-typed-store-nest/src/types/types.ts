import type { ModuleMetadata } from '@nestjs/common';
import { TranslationStore } from 'i18n-typed-store';

/**
 * Preload configuration for translations
 *
 * @template N - Type of namespaces object
 * @template L - Type of locales object
 */
export interface I18nPreloadOptions<N extends Record<string, string>, L extends Record<string, string>> {
	/**
	 * Namespaces to preload. If not specified, all namespaces will be loaded.
	 * If empty array, no namespaces will be preloaded.
	 */
	namespaces?: readonly (keyof N)[];
	/**
	 * Locales to preload. If not specified, all locales will be loaded.
	 * If empty array, no locales will be preloaded.
	 */
	locales?: readonly (keyof L)[];
	/**
	 * Whether to use cache when preloading (default: true)
	 */
	fromCache?: boolean;
}

/**
 * A locale detection source.
 *
 * Built-in sources:
 *  - `'query'`  — query string parameter (`queryParamName`, default `locale`)
 *  - `'route'`  — route parameter (`queryParamName`, default `locale`)
 *  - `'cookie'` — cookie (`cookieName`, default `locale`)
 *  - `'header'` — `Accept-Language`-style header (`headerName`)
 *
 * A custom resolver function receives the raw platform request object (or
 * `undefined` on non-HTTP transports) and returns a locale candidate or
 * `undefined` to pass detection to the next resolver. The returned value is
 * validated/normalized against the store locales via BCP 47 matching, so it
 * may be a tag like `'ru-RU'` even when the store key is `'ru'`.
 */
export type I18nLocaleResolver = 'query' | 'route' | 'cookie' | 'header' | ((request: unknown) => string | undefined);

/**
 * Configuration options for NestJS internationalization module
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template M - Type of translation modules
 */
export interface I18nModuleOptions<
	N extends Record<string, string> = Record<string, string>,
	L extends Record<string, string> = Record<string, string>,
	M extends { [K in keyof N]: any } = { [K in keyof N]: any },
> {
	/** Translation store instance */
	store: TranslationStore<N, L, M>;
	/** Header name for extracting locale from request (default: 'accept-language') */
	headerName?: string;
	/** Query parameter name for extracting locale (default: 'locale') */
	queryParamName?: string;
	/** Cookie name for extracting locale (default: 'locale') */
	cookieName?: string;
	/** Whether to parse Accept-Language header (default: true) */
	parseAcceptLanguage?: boolean;
	/** Available locales for validation */
	availableLocales?: readonly (keyof L)[];
	/**
	 * Default locale. Must be a key of `store.locales` — validated at
	 * configuration time (`forRoot` / `forRootAsync`) with a descriptive error.
	 */
	defaultLocale?: keyof L;
	/**
	 * Locale detection sources, applied in order until one yields a locale.
	 * Defaults to `['query', 'route', 'cookie', 'header']`.
	 *
	 * @example
	 * ```ts
	 * I18nModule.forRoot({
	 *   store,
	 *   // Prefer the authenticated user's saved language over URL/header hints
	 *   resolvers: [(req) => (req as any)?.user?.language, 'query', 'header'],
	 * });
	 * ```
	 */
	resolvers?: readonly I18nLocaleResolver[];
	/**
	 * Whether to register `I18nInterceptor` globally via `APP_INTERCEPTOR`
	 * (default: `true`). Set to `false` to opt out and wire the exported
	 * `I18nInterceptor` manually (e.g. per-controller with `@UseInterceptors`,
	 * or only on selected routes).
	 *
	 * Note: for `forRootAsync` this flag must be set statically on the async
	 * options object (providers cannot depend on factory results).
	 */
	useGlobalInterceptor?: boolean;
	/**
	 * Preload configuration for translations.
	 * If `true`, all namespaces and locales will be preloaded.
	 * If object, allows fine-grained control over what to preload.
	 * If not specified, no preloading will occur.
	 *
	 * @example
	 * ```ts
	 * // Preload all namespaces and locales
	 * preload: true
	 *
	 * // Preload specific namespaces for all locales
	 * preload: { namespaces: ['common', 'errors'] }
	 *
	 * // Preload all namespaces for specific locales
	 * preload: { locales: ['en', 'ru'] }
	 *
	 * // Preload specific combinations
	 * preload: { namespaces: ['common'], locales: ['en', 'ru'] }
	 * ```
	 */
	preload?: boolean | I18nPreloadOptions<N, L>;
}

/**
 * Request context for extracting locale
 */
export interface I18nRequestContext {
	headers?: Record<string, string | string[] | undefined>;
	cookies?: Record<string, string | undefined>;
	query?: Record<string, string | string[] | undefined>;
	params?: Record<string, string | undefined>;
}

/**
 * Async configuration options for `I18nModule.forRootAsync`.
 *
 * Use this when the module options (notably the `store`, or values such as the
 * default locale / header names) must be built from other providers — e.g. a
 * `ConfigService` — rather than being known statically at import time.
 *
 * @template N - Type of namespaces object
 * @template L - Type of locales object
 * @template M - Type of translation modules
 *
 * @example
 * ```ts
 * I18nModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     store,
 *     defaultLocale: config.get('DEFAULT_LOCALE'),
 *     availableLocales: config.get('LOCALES'),
 *   }),
 * });
 * ```
 */
export interface I18nModuleAsyncOptions<
	N extends Record<string, string> = Record<string, string>,
	L extends Record<string, string> = Record<string, string>,
	M extends { [K in keyof N]: any } = { [K in keyof N]: any },
> extends Pick<ModuleMetadata, 'imports'> {
	/** Factory that builds the module options. May be async. */
	useFactory: (...args: any[]) => I18nModuleOptions<N, L, M> | Promise<I18nModuleOptions<N, L, M>>;
	/** Providers to inject into `useFactory` (tokens / classes), in order. */
	inject?: any[];
	/**
	 * Whether to register `I18nInterceptor` globally via `APP_INTERCEPTOR`
	 * (default: `true`). Lives on the async options (not the factory result)
	 * because the provider list is built before the factory runs.
	 */
	useGlobalInterceptor?: boolean;
}
