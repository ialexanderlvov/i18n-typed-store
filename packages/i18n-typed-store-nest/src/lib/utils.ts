import type { I18nRequestContext } from './types/types';

/**
 * Extracts locale from request context
 *
 * @param context - Request context
 * @param options - Options for locale extraction
 * @returns Locale or undefined
 */
export function extractLocaleFromContext(
	context: I18nRequestContext,
	options: {
		headerName?: string;
		queryParamName?: string;
		cookieName?: string;
		parseAcceptLanguage?: boolean;
		availableLocales?: readonly string[];
		defaultLocale?: string;
	},
): string | undefined {
	const {
		headerName = 'accept-language',
		queryParamName = 'locale',
		cookieName = 'locale',
		parseAcceptLanguage = true,
		availableLocales,
		defaultLocale,
	} = options;

	// Check query parameter
	const queryValue = context.query?.[queryParamName];
	if (queryValue) {
		const locale = Array.isArray(queryValue) ? queryValue[0] : queryValue;
		if (typeof locale === 'string') {
			if (!availableLocales || availableLocales.includes(locale)) {
				return locale;
			}
		}
	}

	// Check route parameter
	if (context.params?.[queryParamName]) {
		const locale = context.params[queryParamName];
		if (typeof locale === 'string') {
			if (!availableLocales || availableLocales.includes(locale)) {
				return locale;
			}
		}
	}

	// Check cookie
	if (context.cookies?.[cookieName]) {
		const locale = context.cookies[cookieName];
		if (typeof locale === 'string') {
			if (!availableLocales || availableLocales.includes(locale)) {
				return locale;
			}
		}
	}

	// Check header
	if (context.headers?.[headerName]) {
		const headerValue = context.headers[headerName];
		if (typeof headerValue === 'string') {
			if (parseAcceptLanguage) {
				// Parse Accept-Language header
				const locale = parseAcceptLanguageHeader(headerValue, availableLocales);
				if (locale) {
					return locale;
				}
			} else {
				// Simple use of header value
				if (!availableLocales || availableLocales.includes(headerValue)) {
					return headerValue;
				}
			}
		} else if (Array.isArray(headerValue) && headerValue.length > 0) {
			const firstValue = headerValue[0];
			if (typeof firstValue === 'string') {
				if (parseAcceptLanguage) {
					const locale = parseAcceptLanguageHeader(firstValue, availableLocales);
					if (locale) {
						return locale;
					}
				} else {
					if (!availableLocales || availableLocales.includes(firstValue)) {
						return firstValue;
					}
				}
			}
		}
	}

	// Return default locale
	return defaultLocale;
}

/**
 * Parses Accept-Language header and returns the first matching locale
 *
 * @param acceptLanguage - Accept-Language header value
 * @param availableLocales - Available locales for filtering
 * @returns Locale or undefined
 *
 * @internal Exported for testing purposes only
 */
export function parseAcceptLanguageHeader(acceptLanguage: string, availableLocales?: readonly string[]): string | undefined {
	// Parse languages by priority (e.g., "en-US,en;q=0.9,ru;q=0.8")
	const languages = acceptLanguage
		.split(',')
		.map((lang) => {
			const parts = lang.trim().split(';');
			const locale = parts[0].toLowerCase();
			const quality = parts[1] ? parseFloat(parts[1].replace('q=', '').trim()) : 1.0;
			return { locale, quality };
		})
		.sort((a, b) => b.quality - a.quality);

	for (const { locale } of languages) {
		// Check exact match
		if (!availableLocales || availableLocales.includes(locale)) {
			return locale;
		}

		// Check base language (e.g., en from en-US)
		const baseLocale = locale.split('-')[0];
		if (!availableLocales || availableLocales.includes(baseLocale)) {
			return baseLocale;
		}

		// Check partial match (e.g., en-US matches en)
		if (availableLocales) {
			const matched = availableLocales.find((available) => locale.startsWith(available) || available.startsWith(baseLocale));
			if (matched) {
				return matched;
			}
		} else {
			// If available locales are not specified, return base locale
			return baseLocale;
		}
	}

	return undefined;
}
