import { findBestLocaleMatch, TranslationStore } from 'i18n-typed-store';

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
			const [locale, q] = lang.trim().split(';');
			// Malformed q= values (e.g. "q=abc") must not poison the sort with
			// NaN — fall back to the spec default of 1.
			let quality = 1;
			if (q && q.includes('q=')) {
				const parsedQuality = parseFloat(q.split('q=')[1]);
				if (!Number.isNaN(parsedQuality)) {
					quality = parsedQuality;
				}
			}
			return { locale: locale.trim(), quality };
		})
		// q=0 explicitly means "not acceptable" (RFC 9110); empty tags are noise.
		.filter(({ locale, quality }) => locale !== '' && quality > 0)
		.sort((a, b) => b.quality - a.quality);

	// Match each requested language in preference order using BCP 47 subtag
	// matching. The previous prefix comparison produced false positives —
	// e.g. requested 'fr' matched an available 'fris' locale via startsWith.
	for (const { locale } of languages) {
		const match = findBestLocaleMatch(locale, availableLocales as string[]);
		if (match) {
			return match;
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

	// 1. Check query parameter. BCP 47 matching (instead of a strict includes)
	// lets '?locale=ru-RU' resolve to an available 'ru' locale.
	if (queryParamName && context.query?.[queryParamName]) {
		const queryLocale = Array.isArray(context.query[queryParamName]) ? context.query[queryParamName][0] : context.query[queryParamName];
		if (typeof queryLocale === 'string' && queryLocale) {
			const matchedLocale = findBestLocaleMatch(queryLocale, availableLocales as string[]);
			if (matchedLocale) {
				return matchedLocale as keyof L;
			}
		}
	}

	// 2. Check cookie (BCP 47 matching, same as the query parameter).
	if (cookieName && context.cookies?.[cookieName]) {
		const cookieLocale = context.cookies[cookieName];
		if (typeof cookieLocale === 'string' && cookieLocale) {
			const matchedLocale = findBestLocaleMatch(cookieLocale, availableLocales as string[]);
			if (matchedLocale) {
				return matchedLocale as keyof L;
			}
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
 * @remarks
 * **Concurrency warning (SSR):** the store is mutable, shared state. `changeLocale`
 * writes `store.currentLocale` and `load()` writes the per-locale translation cache
 * on the *same* object. A Node server handles many requests against one module
 * instance and interleaves them at every `await`, so a single module-level store
 * shared across requests will leak one user's locale and loaded translations into
 * another user's response. Create a **fresh store per request** (call
 * `storeFactory.type<...>()` inside the request handler and pass it down via the
 * Provider / props) — do not reuse one module-scoped store across concurrent requests.
 *
 * @example
 * ```ts
 * // In SSR handler — create a per-request store, then initialize it.
 * const locale = getLocaleFromRequest(context, {
 *   defaultLocale: 'en',
 *   availableLocales: ['en', 'ru'],
 * });
 *
 * const store = storeFactory.type<MyTranslations>(); // fresh per request
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
