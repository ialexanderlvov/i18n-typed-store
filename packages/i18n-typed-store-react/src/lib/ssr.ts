import { TranslationStore } from 'i18n-typed-store';

/**
 * Request context interface for locale detection in SSR environments.
 * Compatible with various SSR frameworks (Next.js, Remix, SvelteKit, etc.)
 * and standard request objects that provide query, cookies, and headers.
 */
export interface RequestContext {
	query?: Record<string, string | string[]>;
	cookies?: Record<string, string>;
	headers?: Record<string, string | string[]> | Headers;
}

/**
 * Options for getting locale from SSR request.
 */
export interface GetLocaleFromRequestOptions {
	/**
	 * Header name to read locale from (e.g., 'accept-language', 'x-locale')
	 * @default 'accept-language'
	 */
	headerName?: string;
	/**
	 * Cookie name to read locale from
	 */
	cookieName?: string;
	/**
	 * Query parameter name to read locale from (e.g., 'locale', 'lang')
	 */
	queryParamName?: string;
	/**
	 * Default locale to use if locale cannot be determined
	 */
	defaultLocale: string;
	/**
	 * Available locales to validate against
	 */
	availableLocales: readonly string[];
	/**
	 * Whether to parse Accept-Language header and find best match
	 * @default true
	 */
	parseAcceptLanguage?: boolean;
}

/**
 * Parses Accept-Language header and returns the best matching locale.
 *
 * @param acceptLanguage - Accept-Language header value
 * @param availableLocales - Available locales
 * @param defaultLocale - Default locale to use if no match found
 * @returns Best matching locale
 */
function parseAcceptLanguage(acceptLanguage: string | undefined, availableLocales: readonly string[], defaultLocale: string): string {
	if (!acceptLanguage) {
		return defaultLocale;
	}

	// Parse Accept-Language header (e.g., "en-US,en;q=0.9,ru;q=0.8")
	const languages = acceptLanguage
		.split(',')
		.map((lang) => {
			const [locale, q = '1'] = lang.trim().split(';');
			const quality = q.includes('q=') ? parseFloat(q.split('q=')[1]) : 1;
			return { locale: locale.toLowerCase(), quality };
		})
		.sort((a, b) => b.quality - a.quality);

	// Try to find exact match first
	for (const { locale } of languages) {
		const exactMatch = availableLocales.find((l) => l.toLowerCase() === locale);
		if (exactMatch) {
			return exactMatch;
		}

		// Try to find language match (e.g., 'en' matches 'en-US')
		const languageCode = locale.split('-')[0];
		const languageMatch = availableLocales.find((l) => l.toLowerCase().startsWith(languageCode));
		if (languageMatch) {
			return languageMatch;
		}
	}

	return defaultLocale;
}

/**
 * Gets locale from SSR request context.
 * Checks query params, cookies, and headers in that order.
 * Works with any SSR framework that provides these standard request properties.
 *
 * @template L - Type of locales object
 * @param context - SSR request context with query, cookies, and headers
 * @param options - Options for locale detection
 * @returns Detected locale key
 *
 * @example
 * ```ts
 * // Next.js example
 * import type { GetServerSidePropsContext } from 'next';
 *
 * export async function getServerSideProps(context: GetServerSidePropsContext) {
 *   const locale = getLocaleFromRequest(context, {
 *     defaultLocale: 'en',
 *     availableLocales: ['en', 'ru'],
 *     cookieName: 'locale',
 *     queryParamName: 'locale',
 *   });
 *
 *   const store = storeFactory.type<MyTranslations>();
 *   initializeStore(store, locale);
 *
 *   return { props: { locale } };
 * }
 * ```
 *
 * @example
 * ```ts
 * // Remix example
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const url = new URL(request.url);
 *   const context: RequestContext = {
 *     query: Object.fromEntries(url.searchParams),
 *     headers: Object.fromEntries(request.headers),
 *   };
 *
 *   const locale = getLocaleFromRequest(context, {
 *     defaultLocale: 'en',
 *     availableLocales: ['en', 'ru'],
 *   });
 *
 *   return { locale };
 * }
 * ```
 */
export function getLocaleFromRequest<L extends Record<string, string>>(
	context: RequestContext,
	options: GetLocaleFromRequestOptions,
): keyof L {
	const {
		queryParamName = 'locale',
		cookieName,
		headerName = 'accept-language',
		defaultLocale,
		availableLocales,
		parseAcceptLanguage: shouldParseAcceptLanguage = true,
	} = options;

	// 1. Check query parameter
	if (queryParamName && context.query?.[queryParamName]) {
		const queryLocale = Array.isArray(context.query[queryParamName]) ? context.query[queryParamName][0] : context.query[queryParamName];
		if (typeof queryLocale === 'string' && availableLocales.includes(queryLocale)) {
			return queryLocale as keyof L;
		}
	}

	// 2. Check cookie
	if (cookieName && context.cookies?.[cookieName]) {
		const cookieLocale = context.cookies[cookieName];
		if (typeof cookieLocale === 'string' && availableLocales.includes(cookieLocale)) {
			return cookieLocale as keyof L;
		}
	}

	// 3. Check header (for Accept-Language, parse it)
	if (headerName && context.headers) {
		let headerValue: string | undefined;

		if (context.headers instanceof Headers) {
			headerValue = context.headers.get(headerName) || undefined;
		} else {
			const header = context.headers[headerName];
			headerValue = Array.isArray(header) ? header[0] : header;
		}

		// For Accept-Language, always call parseAcceptLanguage (even if headerValue is empty/undefined)
		if (headerName.toLowerCase() === 'accept-language' && shouldParseAcceptLanguage) {
			const parsedLocale = parseAcceptLanguage(headerValue, availableLocales, defaultLocale);
			return parsedLocale as keyof L;
		}

		if (headerValue && availableLocales.includes(headerValue)) {
			return headerValue as keyof L;
		}
	}

	return defaultLocale as keyof L;
}

/**
 * Initializes translation store with a specific locale.
 * Useful for SSR/SSG where you need to set the locale before rendering.
 *
 * @template N - Type of namespaces object
 * @template L - Type of locales object
 * @template M - Type of translation modules mapping
 * @param store - Translation store instance
 * @param locale - Locale to initialize with
 *
 * @example
 * ```ts
 * // In SSR handler
 * const locale = getLocaleFromRequest(context, {
 *   defaultLocale: 'en',
 *   availableLocales: ['en', 'ru'],
 * });
 *
 * const store = storeFactory.type<MyTranslations>();
 * initializeStore(store, locale);
 *
 * // Preload translations if needed
 * await store.common.load(locale);
 * ```
 */
export function initializeStore<N extends Record<string, string>, L extends Record<string, string>, M extends { [K in keyof N]: any }>(
	store: TranslationStore<N, L, M>,
	locale: keyof L,
): void {
	store.changeLocale(locale);
}
