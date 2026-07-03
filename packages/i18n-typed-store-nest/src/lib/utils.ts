import type { ExecutionContext } from '@nestjs/common';
import { findBestLocaleMatch } from 'i18n-typed-store';
import type { I18nLocaleResolver, I18nRequestContext } from '../types/types';

/**
 * Default order in which locale detection sources are applied.
 */
export const DEFAULT_LOCALE_RESOLVERS: readonly I18nLocaleResolver[] = ['query', 'route', 'cookie', 'header'];

/**
 * Options accepted by {@link extractLocaleFromContext}.
 */
export interface ExtractLocaleOptions {
	/** Header to read the locale from (default: 'accept-language') */
	headerName?: string;
	/** Query/route parameter name (default: 'locale') */
	queryParamName?: string;
	/** Cookie name (default: 'locale') */
	cookieName?: string;
	/** Whether to parse the header as an Accept-Language list (default: true) */
	parseAcceptLanguage?: boolean;
	/** Locales the detected value is validated against (BCP 47 aware) */
	availableLocales?: readonly string[];
	/** Fallback returned when no source yields a locale */
	defaultLocale?: string;
	/** Detection sources, applied in order (default: query → route → cookie → header) */
	resolvers?: readonly I18nLocaleResolver[];
	/** Raw platform request, passed to custom resolver functions */
	request?: unknown;
}

/**
 * Validates a raw locale candidate against the available locales using BCP 47
 * matching (case-insensitive, region/script fallbacks: 'ru-RU' → 'ru',
 * 'EN-us' → 'en-US'). Returns the matched *available* key — not the raw
 * value — so downstream code can index the store directly. When no available
 * locales are configured the raw value is returned as-is.
 */
function matchAvailableLocale(value: string, availableLocales?: readonly string[]): string | undefined {
	if (!availableLocales) {
		return value;
	}
	return findBestLocaleMatch(value, availableLocales as string[]) ?? undefined;
}

/**
 * Extracts locale from request context.
 *
 * Every source (query / route / cookie / header) is validated through
 * {@link findBestLocaleMatch}, so BCP 47 tags and case differences are
 * tolerated: `?locale=ru-RU` matches an available `'ru'`, and an
 * `Accept-Language: EN-us` header matches an available `'en-US'`.
 *
 * @param context - Request context
 * @param options - Options for locale extraction
 * @returns Matched available locale (or the raw value when `availableLocales`
 * is not provided), falling back to `defaultLocale`, or undefined
 */
export function extractLocaleFromContext(context: I18nRequestContext, options: ExtractLocaleOptions): string | undefined {
	const {
		headerName = 'accept-language',
		queryParamName = 'locale',
		cookieName = 'locale',
		parseAcceptLanguage = true,
		availableLocales,
		defaultLocale,
		resolvers = DEFAULT_LOCALE_RESOLVERS,
		request,
	} = options;

	for (const resolver of resolvers) {
		let candidate: string | undefined;

		if (typeof resolver === 'function') {
			const custom = resolver(request);
			candidate = typeof custom === 'string' && custom !== '' ? matchAvailableLocale(custom, availableLocales) : undefined;
		} else {
			switch (resolver) {
				case 'query': {
					const queryValue = context.query?.[queryParamName];
					const locale = Array.isArray(queryValue) ? queryValue[0] : queryValue;
					if (typeof locale === 'string' && locale !== '') {
						candidate = matchAvailableLocale(locale, availableLocales);
					}
					break;
				}
				case 'route': {
					const locale = context.params?.[queryParamName];
					if (typeof locale === 'string' && locale !== '') {
						candidate = matchAvailableLocale(locale, availableLocales);
					}
					break;
				}
				case 'cookie': {
					const locale = context.cookies?.[cookieName];
					if (typeof locale === 'string' && locale !== '') {
						candidate = matchAvailableLocale(locale, availableLocales);
					}
					break;
				}
				case 'header': {
					const headerValue = context.headers?.[headerName];
					const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
					if (typeof raw === 'string' && raw !== '') {
						candidate = parseAcceptLanguage
							? parseAcceptLanguageHeader(raw, availableLocales)
							: matchAvailableLocale(raw, availableLocales);
					}
					break;
				}
			}
		}

		if (candidate !== undefined) {
			return candidate;
		}
	}

	// Return default locale
	return defaultLocale;
}

/**
 * Parses an Accept-Language header and returns the best matching locale.
 *
 * Entries are ordered by quality, then each is matched against
 * `availableLocales` via {@link findBestLocaleMatch} — case-insensitive and
 * BCP 47 aware, so `'EN-us'` matches an available `'en-US'` and `'ru-RU'`
 * falls back to an available `'ru'`. The *available* key is returned in its
 * original casing. Without `availableLocales` the first (highest-quality)
 * raw tag is returned unchanged.
 *
 * @param acceptLanguage - Accept-Language header value
 * @param availableLocales - Available locales for matching
 * @returns Matched locale or undefined
 *
 * @internal Exported for testing purposes only
 */
export function parseAcceptLanguageHeader(acceptLanguage: string, availableLocales?: readonly string[]): string | undefined {
	// Parse languages by priority (e.g., "en-US,en;q=0.9,ru;q=0.8")
	const languages = acceptLanguage
		.split(',')
		.map((lang) => {
			const parts = lang.trim().split(';');
			const locale = parts[0].trim();
			const quality = parts[1] ? parseFloat(parts[1].replace('q=', '').trim()) : 1.0;
			return { locale, quality };
		})
		.filter(({ locale }) => locale !== '' && locale !== '*')
		.sort((a, b) => b.quality - a.quality);

	for (const { locale } of languages) {
		const matched = matchAvailableLocale(locale, availableLocales);
		if (matched !== undefined) {
			return matched;
		}
	}

	return undefined;
}

/**
 * Extracts the platform request object from any Nest execution context type.
 *
 * - `http` — `switchToHttp().getRequest()`.
 * - `graphql` — the `req` inside the GraphQL context object (argument #3 of a
 *   resolver). Read positionally from `getArgs()` so this package does NOT
 *   depend on `@nestjs/graphql`. May be `undefined` (e.g. subscriptions).
 * - `ws` / `rpc` / anything else — `undefined`: there are no HTTP headers or
 *   cookies to detect a locale from, callers should use the default locale.
 *
 * @internal Exported for testing purposes only
 */
export function getRequestFromExecutionContext(context: ExecutionContext): unknown {
	const contextType = context.getType<string>();

	if (contextType === 'http') {
		return context.switchToHttp().getRequest();
	}

	if (contextType === 'graphql') {
		// GraphQL resolver arguments: [root, args, context, info]. Apollo /
		// Mercurius conventionally expose the HTTP request as `context.req`
		// (Express) or `context.request` (some Fastify setups).
		const args = context.getArgs() as unknown[];
		const gqlContext = args?.[2] as { req?: unknown; request?: unknown } | undefined;
		if (gqlContext && typeof gqlContext === 'object') {
			return gqlContext.req ?? gqlContext.request ?? undefined;
		}
		return undefined;
	}

	// 'ws', 'rpc' and unknown transports carry no HTTP-shaped request.
	return undefined;
}

/**
 * Attaches a value to the request object as a non-enumerable `i18nService`
 * property, tolerating every hostile shape:
 *  - non-object / null requests (WS, RPC, missing GraphQL req) — no-op;
 *  - a property already defined with `configurable: false` (e.g. both the
 *    middleware and the interceptor ran) — redefining with a different value
 *    would throw a TypeError, so the existing value is kept;
 *  - frozen/sealed requests — the `defineProperty` throw is swallowed.
 *
 * @internal Exported for testing purposes only
 */
export function attachI18nServiceToRequest(request: unknown, service: unknown): void {
	if (typeof request !== 'object' || request === null) {
		return;
	}

	const existing = Object.getOwnPropertyDescriptor(request, 'i18nService');
	if (existing && !existing.configurable) {
		// Already attached by an earlier layer (middleware before interceptor).
		// Redefining a non-configurable property with a different value throws,
		// and the first writer wins by design.
		return;
	}

	try {
		Object.defineProperty(request, 'i18nService', {
			value: service,
			writable: false,
			enumerable: false,
			configurable: false,
		});
	} catch {
		// Frozen / sealed / proxy-guarded request — locale detection still
		// works, only the request-attached service shortcut is unavailable.
	}
}

/**
 * Builds the plain {@link I18nRequestContext} (headers/cookies/query/params)
 * from an arbitrary platform request object. Returns empty context parts for
 * non-object requests so detection degrades to the default locale.
 *
 * @internal Exported for testing purposes only
 */
export function buildRequestContext(request: unknown): I18nRequestContext {
	if (typeof request !== 'object' || request === null) {
		return {};
	}
	const req = request as Record<string, unknown>;
	return {
		headers: req.headers as I18nRequestContext['headers'],
		cookies: req.cookies as I18nRequestContext['cookies'],
		query: req.query as I18nRequestContext['query'],
		params: req.params as I18nRequestContext['params'],
	};
}
