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
	/** Default locale */
	defaultLocale?: keyof L;
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
