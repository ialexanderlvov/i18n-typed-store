import { findBestLocaleMatch, TranslationStore } from 'i18n-typed-store';

/**
 * Request context interface for locale detection in SSR environments.
 * Compatible with various SSR frameworks (Next.js, Remix, SvelteKit, etc.)
 * and standard request objects that provide query, cookies, and headers.
 */
export interface RequestContext {
	query?: Record<string, string | string[] | undefined>;
	cookies?: Record<string, string | undefined>;
	headers?: Record<string, string | string[] | undefined> | Headers;
}

/**
 * Options for getting locale from SSR request.
 */
export interface GetLocaleFromRequestOptions<AvailableLocales extends readonly string[] = readonly string[]> {
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
	defaultLocale: AvailableLocales[number];
	/**
	 * Available locales to validate against
	 */
	availableLocales: readonly [...AvailableLocales];
	/**
	 * Whether to parse Accept-Language header and find best match
	 * @default true
	 */
	parseAcceptLanguage?: boolean;
}

interface LanguagePreference {
	range: string;
	quality: number;
	order: number;
	/** Core match for lookup-style fallbacks, resolved against the full locale set. */
	fallbackLocale?: string;
}

interface LocalePreferenceMatch {
	preference: LanguagePreference;
	/** Direct ranges outrank locale fallbacks, which outrank a wildcard. */
	kind: 1 | 2 | 3;
	specificity: number;
}

const languageRangePattern = /^(?:\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/;
const qualityValuePattern = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

function parseLanguagePreference(value: string, order: number): LanguagePreference | null {
	const [rawRange, ...rawParameters] = value.split(';');
	const range = rawRange?.trim();

	if (!range || !languageRangePattern.test(range)) {
		return null;
	}

	if (rawParameters.length === 0) {
		return { range, quality: 1, order };
	}

	// Accept-Language permits only one weight parameter. Ignoring the whole
	// malformed range is safer than accidentally promoting it to q=1.
	if (rawParameters.length !== 1) {
		return null;
	}

	const qualityMatch = /^q\s*=\s*(\S+)$/i.exec(rawParameters[0]?.trim() ?? '');
	if (!qualityMatch || !qualityValuePattern.test(qualityMatch[1] ?? '')) {
		return null;
	}

	return {
		range,
		quality: Number(qualityMatch[1]),
		order,
	};
}

function languageRangeMatches(range: string, locale: string): boolean {
	if (range === '*') {
		return true;
	}

	const normalizedRange = range.toLowerCase();
	const normalizedLocale = locale.toLowerCase();
	return normalizedLocale === normalizedRange || normalizedLocale.startsWith(`${normalizedRange}-`);
}

function getRangeSpecificity(range: string): number {
	return range === '*' ? 0 : range.split('-').length;
}

function getLocalePreferenceMatch(locale: string, preference: LanguagePreference): LocalePreferenceMatch | null {
	if (preference.range === '*') {
		return { preference, kind: 1, specificity: 0 };
	}

	const specificity = getRangeSpecificity(preference.range);
	if (languageRangeMatches(preference.range, locale)) {
		return { preference, kind: 3, specificity };
	}

	// The core matcher deliberately supports lookup-style fallbacks such as
	// `en-US` -> `en`. A positive preference may use that fallback, but a q=0
	// range must only reject locales it directly covers: rejecting `en-US`
	// must not accidentally reject the distinct base `en` representation.
	if (preference.quality > 0 && preference.fallbackLocale === locale) {
		return { preference, kind: 2, specificity };
	}

	return null;
}

function getControllingPreference(locale: string, preferences: readonly LanguagePreference[]): LanguagePreference | undefined {
	let controllingMatch: LocalePreferenceMatch | null = null;

	for (const preference of preferences) {
		const match = getLocalePreferenceMatch(locale, preference);
		if (
			match &&
			(!controllingMatch ||
				match.kind > controllingMatch.kind ||
				(match.kind === controllingMatch.kind && match.specificity > controllingMatch.specificity) ||
				(match.kind === controllingMatch.kind &&
					match.specificity === controllingMatch.specificity &&
					match.preference.quality > controllingMatch.preference.quality) ||
				(match.kind === controllingMatch.kind &&
					match.specificity === controllingMatch.specificity &&
					match.preference.quality === controllingMatch.preference.quality &&
					match.preference.order < controllingMatch.preference.order))
		) {
			controllingMatch = match;
		}
	}

	return controllingMatch?.preference;
}

/**
 * Parses Accept-Language header and returns the best matching locale.
 *
 * @param acceptLanguage - Accept-Language header value
 * @param availableLocales - Available locales
 * @param defaultLocale - Default locale to use if no match found
 * @returns Best matching locale
 *
 * @example
 * ```ts
 * parseAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8', ['en', 'ru'], 'en'); // => 'ru'
 * parseAcceptLanguage(undefined, ['en', 'ru'], 'en'); // => 'en'
 * ```
 */
export function parseAcceptLanguage<AvailableLocales extends readonly string[]>(
	acceptLanguage: string | undefined,
	availableLocales: readonly [...AvailableLocales],
	defaultLocale: AvailableLocales[number],
): AvailableLocales[number] {
	if (!acceptLanguage) {
		return defaultLocale;
	}

	const preferences = acceptLanguage
		.split(',')
		.map((value, order) => parseLanguagePreference(value.trim(), order))
		.filter((preference): preference is LanguagePreference => preference !== null)
		.map((preference) => ({
			...preference,
			fallbackLocale:
				preference.range !== '*' && preference.quality > 0
					? (findBestLocaleMatch(preference.range, [...availableLocales]) ?? undefined)
					: undefined,
		}));

	// Quality belongs to an available representation, not merely to the first
	// header range after sorting. The most specific applicable range controls
	// each locale. This also prevents a lookup fallback from bypassing q=0.
	const rankedLocales = availableLocales
		.map((locale, index) => ({ locale, index, preference: getControllingPreference(locale, preferences) }))
		.filter(
			(candidate): candidate is typeof candidate & { preference: LanguagePreference } =>
				candidate.preference !== undefined && candidate.preference.quality > 0,
		)
		.sort(
			(left, right) =>
				right.preference.quality - left.preference.quality ||
				left.preference.order - right.preference.order ||
				left.index - right.index,
		);

	const bestMatch = rankedLocales[0];
	if (bestMatch !== undefined) {
		return bestMatch.locale;
	}

	const defaultPreference = getControllingPreference(defaultLocale, preferences);
	if (defaultPreference?.quality !== 0) {
		return defaultLocale;
	}

	// The default locale can itself be explicitly forbidden. Keep the function
	// total by selecting the first remaining locale; if every locale is
	// forbidden, there is no representable acceptable result, so retain the
	// configured default as the final server-side fallback.
	return availableLocales.find((locale) => getControllingPreference(locale, preferences)?.quality !== 0) ?? defaultLocale;
}

/**
 * Gets locale from SSR request context.
 * Checks query params, cookies, and headers in that order.
 * Works with any SSR framework that provides these standard request properties.
 *
 * @template AvailableLocales - Readonly tuple or array of available locale names
 * @param context - SSR request context with query, cookies, and headers
 * @param options - Options for locale detection
 * @returns Detected locale as an exact member of `availableLocales`
 *
 * @example
 * ```ts
 * // Next.js Pages Router example
 * import type { GetServerSidePropsContext } from 'next';
 *
 * export async function getServerSideProps(context: GetServerSidePropsContext) {
 *   const locale = getLocaleFromRequest(
 *     {
 *       query: context.query,
 *       cookies: context.req.cookies,
 *       headers: context.req.headers,
 *     },
 *     {
 *       defaultLocale: 'en',
 *       availableLocales: ['en', 'ru'],
 *       cookieName: 'locale',
 *       queryParamName: 'locale',
 *     },
 *   );
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
export function getLocaleFromRequest<AvailableLocales extends readonly string[]>(
	context: RequestContext,
	options: GetLocaleFromRequestOptions<AvailableLocales>,
): AvailableLocales[number];
/**
 * Backwards-compatible overload for callers that explicitly provide a locale
 * map type, as supported by versions before tuple inference was introduced.
 */
export function getLocaleFromRequest<L extends Record<string, string> = never>(
	context: RequestContext,
	options: [L] extends [never] ? never : GetLocaleFromRequestOptions,
): keyof L;
export function getLocaleFromRequest(context: RequestContext, options: GetLocaleFromRequestOptions): string {
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
	if (queryParamName) {
		const queryValue = context.query?.[queryParamName];
		const queryLocale = Array.isArray(queryValue) ? queryValue[0] : queryValue;
		if (typeof queryLocale === 'string' && queryLocale) {
			const matchedLocale = findBestLocaleMatch(queryLocale, availableLocales as string[]);
			if (matchedLocale) {
				return matchedLocale;
			}
		}
	}

	// 2. Check cookie (BCP 47 matching, same as the query parameter).
	if (cookieName && context.cookies?.[cookieName]) {
		const cookieLocale = context.cookies[cookieName];
		if (typeof cookieLocale === 'string' && cookieLocale) {
			const matchedLocale = findBestLocaleMatch(cookieLocale, availableLocales as string[]);
			if (matchedLocale) {
				return matchedLocale;
			}
		}
	}

	// 3. Check header (for Accept-Language, parse it)
	if (headerName && context.headers) {
		let headerValue: string | undefined;

		if (context.headers instanceof Headers) {
			headerValue = context.headers.get(headerName) || undefined;
		} else {
			const normalizedHeaderName = headerName.toLowerCase();
			const headerKey = Object.keys(context.headers).find((key) => key.toLowerCase() === normalizedHeaderName);
			const header = headerKey === undefined ? undefined : context.headers[headerKey];
			// Multiple Accept-Language field lines are equivalent to one
			// comma-separated field value. Custom headers remain single-valued and
			// preserve the established first-value behaviour.
			headerValue = Array.isArray(header) ? (normalizedHeaderName === 'accept-language' ? header.join(',') : header[0]) : header;
		}

		// For Accept-Language, always call parseAcceptLanguage (even if headerValue is empty/undefined)
		if (headerName.toLowerCase() === 'accept-language' && shouldParseAcceptLanguage) {
			return parseAcceptLanguage(headerValue, availableLocales, defaultLocale);
		}

		if (headerValue && availableLocales.includes(headerValue)) {
			return headerValue;
		}
	}

	return defaultLocale;
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
 * await store.translations.common.load(locale);
 * ```
 */
export function initializeStore<N extends Record<string, string>, L extends Record<string, string>, M extends { [K in keyof N]: any }>(
	store: TranslationStore<N, L, M>,
	locale: keyof L,
): void {
	store.changeLocale(locale);
}
