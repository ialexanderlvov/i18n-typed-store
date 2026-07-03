import { describe, it, expect } from 'vitest';
import {} from '../src/lib/decorators';
import { I18nRequestContext } from '../src';
import { extractLocaleFromContext, parseAcceptLanguageHeader } from '../src/lib/utils';

describe('extractLocaleFromContext', () => {
	describe('query parameter', () => {
		it('should extract locale from query parameter', () => {
			const context: I18nRequestContext = {
				query: { locale: 'en' },
				headers: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('en');
		});

		it('should extract locale from custom query parameter name', () => {
			const context: I18nRequestContext = {
				query: { lang: 'ru' },
				headers: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'lang',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('ru');
		});

		it('should handle array query parameter', () => {
			const context: I18nRequestContext = {
				query: { locale: ['en', 'ru'] },
				headers: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('en');
		});

		it('should return undefined if locale is not in available locales', () => {
			const context: I18nRequestContext = {
				query: { locale: 'de' },
				headers: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBeUndefined();
		});

		it('should return locale if availableLocales is not specified', () => {
			const context: I18nRequestContext = {
				query: { locale: 'de' },
				headers: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
			});

			expect(result).toBe('de');
		});
	});

	describe('route parameter', () => {
		it('should extract locale from route parameter', () => {
			const context: I18nRequestContext = {
				params: { locale: 'en' },
				headers: {},
				cookies: {},
				query: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('en');
		});

		it('should prioritize query parameter over route parameter', () => {
			const context: I18nRequestContext = {
				query: { locale: 'ru' },
				params: { locale: 'en' },
				headers: {},
				cookies: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('ru');
		});
	});

	describe('cookie', () => {
		it('should extract locale from cookie', () => {
			const context: I18nRequestContext = {
				cookies: { locale: 'en' },
				headers: {},
				query: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				cookieName: 'locale',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('en');
		});

		it('should extract locale from custom cookie name', () => {
			const context: I18nRequestContext = {
				cookies: { lang: 'ru' },
				headers: {},
				query: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				cookieName: 'lang',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('ru');
		});

		it('should prioritize query parameter over cookie', () => {
			const context: I18nRequestContext = {
				query: { locale: 'ru' },
				cookies: { locale: 'en' },
				headers: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
				cookieName: 'locale',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('ru');
		});
	});

	describe('header', () => {
		it('should extract locale from header', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: false,
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('en');
		});

		it('should parse Accept-Language header', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en-US,en;q=0.9,ru;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('en');
		});

		it('should handle array header value', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': ['en', 'ru'] },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: false,
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('en');
		});

		it('should extract base locale from Accept-Language header', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en-US,en;q=0.9' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en'],
			});

			expect(result).toBe('en');
		});

		it('should prioritize query parameter over header', () => {
			const context: I18nRequestContext = {
				query: { locale: 'ru' },
				headers: { 'accept-language': 'en' },
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
				headerName: 'accept-language',
				parseAcceptLanguage: false,
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('ru');
		});
	});

	describe('default locale', () => {
		it('should return default locale if no locale found', () => {
			const context: I18nRequestContext = {
				headers: {},
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				defaultLocale: 'en',
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBe('en');
		});

		it('should return undefined if no locale found and no default', () => {
			const context: I18nRequestContext = {
				headers: {},
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBeUndefined();
		});
	});

	describe('priority order', () => {
		it('should follow priority: query > route > cookie > header > default', () => {
			const context: I18nRequestContext = {
				query: { locale: 'query' },
				params: { locale: 'route' },
				cookies: { locale: 'cookie' },
				headers: { 'accept-language': 'header' },
			};

			const result = extractLocaleFromContext(context, {
				queryParamName: 'locale',
				cookieName: 'locale',
				headerName: 'accept-language',
				parseAcceptLanguage: false,
				availableLocales: ['query', 'route', 'cookie', 'header'],
				defaultLocale: 'default',
			});

			expect(result).toBe('query');
		});
	});

	describe('parseAcceptLanguageHeader edge cases', () => {
		it('should handle array header value with parseAcceptLanguage (covers lines 79-86)', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': ['en-US,en;q=0.9', 'ru;q=0.8'] },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en', 'ru'],
			});

			// This covers lines 79-86: Array.isArray(headerValue) && headerValue.length > 0
			// and parseAcceptLanguageHeader(firstValue, availableLocales)
			expect(result).toBe('en');
		});

		it('should handle array header value without parseAcceptLanguage (covers lines 87-92)', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': ['ru', 'en'] },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: false,
				availableLocales: ['en', 'ru'],
			});

			// This covers lines 87-92: else branch when parseAcceptLanguage is false
			expect(result).toBe('ru');
		});

		it('should handle partial locale matching (en-US matches en)', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en-US,en;q=0.9' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en'],
			});

			expect(result).toBe('en');
		});

		it('should handle partial locale matching (en matches en-US)', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en,ru;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en-US', 'ru'],
			});

			expect(result).toBe('en-US');
		});

		// NOTE: the tests below were rewritten for the BCP 47 / case-insensitive
		// detection fix. The old versions pinned buggy behavior: every header tag
		// was lowercased before matching (so 'EN-us' could never match an
		// available 'en-US') and query/cookie/route were compared with a strict
		// `includes`. Detection now goes through `findBestLocaleMatch`, which is
		// case-insensitive, resolves BCP 47 tags ('ru-RU' → 'ru'), and returns
		// the *available* key in its original casing.
		it('should preserve the original casing of the header tag when availableLocales is not specified', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en-US,ru;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			// Without availableLocales the raw highest-quality tag is returned
			// unchanged — no lossy lowercasing.
			expect(result).toBe('en-US');
		});

		it('should return the highest-quality raw tag when availableLocales is not specified', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'fr-FR,en-US;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(result).toBe('fr-FR');
		});

		it('should fall back to the base language when only the base locale is available', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en-US,ru;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en'], // 'en-US' has no exact match, BCP 47 matching falls back to 'en'
			});

			expect(result).toBe('en');
		});

		it('should match a same-language regional variant when no exact/base match exists', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en-US,ru;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en-GB'], // same language, different region — still the best match
			});

			expect(result).toBe('en-GB');
		});

		it('should match an Accept-Language tag with arbitrary casing against available keys (EN-us -> en-US)', () => {
			// Regression: the old implementation lowercased the tag and compared
			// it strictly, so 'EN-us' never matched an available 'en-US'.
			const result = parseAcceptLanguageHeader('EN-us,ru;q=0.8', ['en-US', 'ru']);
			expect(result).toBe('en-US');
		});

		it('should resolve a BCP 47 region tag to the base available locale (ru-RU -> ru)', () => {
			const result = parseAcceptLanguageHeader('ru-RU,en;q=0.5', ['en', 'ru']);
			expect(result).toBe('ru');
		});

		it('should ignore wildcard entries in Accept-Language', () => {
			const result = parseAcceptLanguageHeader('*,en;q=0.8', ['en', 'ru']);
			expect(result).toBe('en');
		});

		it('should return undefined when no locale matches', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'de-DE,fr;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en', 'ru'],
			});

			expect(result).toBeUndefined();
		});

		it('should handle complex Accept-Language header with multiple languages', () => {
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7,ru;q=0.6' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en', 'ru'],
			});

			// Should match 'en' from 'en-US' or 'en'
			expect(result).toBe('en');
		});
	});
});
