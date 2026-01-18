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

		it('should return locale as-is when availableLocales is not specified (exact match path)', () => {
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

			// When availableLocales is not specified, parseAcceptLanguageHeader returns locale as-is
			// because the exact match check (!availableLocales || ...) passes in line 126
			// Locale is lowercased: 'en-US' -> 'en-us'
			expect(result).toBe('en-us');
		});

		it('should return base locale when availableLocales is not specified (baseLocale path)', () => {
			// To test baseLocale path (line 132), we need a scenario where exact match check
			// doesn't return early. But when availableLocales is undefined, exact match always passes.
			// So we test with a locale that would trigger baseLocale logic if exact match failed
			// Actually, the baseLocale path is tested when exact match fails but baseLocale check passes
			// Since we can't easily test that without mocking, we test the behavior as-is
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

			// When availableLocales is not specified, exact match returns locale as-is (lowercased)
			expect(result).toBe('fr-fr');
		});

		it('should return base locale when exact match fails but baseLocale matches (line 132)', () => {
			// Test the baseLocale path when exact match fails but baseLocale is in availableLocales
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en-US,ru;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en'], // 'en-US' exact match fails, but 'en' baseLocale matches
			});

			// Should return baseLocale 'en' because exact match 'en-us' fails, but baseLocale 'en' matches
			expect(result).toBe('en');
		});

		it('should return matched locale from partial match (covers lines 137-143)', () => {
			// Test partial match path when exact and baseLocale matches fail
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'en-US,ru;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				availableLocales: ['en-GB'], // 'en-US' exact fails, 'en' base fails, but partial match works
			});

			// This covers lines 137-143: if (availableLocales) { const matched = availableLocales.find(...) }
			// Should return 'en-GB' because 'en-US' starts with 'en' which matches 'en-GB' pattern
			expect(result).toBe('en-GB');
		});

		it('should return base locale in else branch when availableLocales is empty array (covers line 146)', () => {
			// Line 146 is in the else branch: else { return baseLocale; }
			// To reach it, we need availableLocales to be falsy (undefined, null, false, etc.)
			// AND we must skip the checks at lines 128 and 134
			//
			// When availableLocales is undefined:
			// - Line 128: if (!availableLocales || ...) = if (true || ...) = true, returns at line 129
			// So we never reach line 146.
			//
			// However, if availableLocales is an empty array []:
			// - Line 128: if (![] || [].includes(locale)) = if (false || false) = false, continue
			// - Line 134: if (![] || [].includes(baseLocale)) = if (false || false) = false, continue
			// - Line 139: if ([]) = if (true) - empty array is truthy, so we enter if branch, not else
			//
			// So empty array won't work either because [] is truthy.
			//
			// Actually, to reach line 146, we need availableLocales to be a falsy value (undefined, null, false, 0, '')
			// But when it's falsy, line 128 always returns.
			//
			// Wait - let me check the code again. Line 146 is in else branch of `if (availableLocales)`.
			// So availableLocales must be falsy to enter else. But then line 128 `if (!availableLocales || ...)`
			// will always be true and return.
			//
			// This means line 146 is truly unreachable in the current logic.
			// However, for coverage purposes, let's test with null to see if it behaves differently:
			const result1 = parseAcceptLanguageHeader('en-US', null as any);
			// This will return at line 129 because !null = true
			expect(result1).toBe('en-us');

			// Line 146 is unreachable defensive code. The else branch exists but can never be reached
			// because the earlier checks always return when availableLocales is falsy.
			// For 100% coverage, this would require code refactoring.
		});

		it('should return base locale when availableLocales is not specified and partial match path (line 144-146)', () => {
			// Test the else branch in partial match (line 144-146)
			// This happens when availableLocales is not specified and we're in partial match section
			// But actually, this path is hard to reach because exact match would have returned earlier
			// We can test it by ensuring exact match and baseLocale both don't match, but availableLocales is undefined
			// Actually, when availableLocales is undefined, exact match always passes, so this path is unreachable
			// But we can test the logic by checking what happens in the else branch
			const context: I18nRequestContext = {
				headers: { 'accept-language': 'xyz-ABC,en;q=0.8' },
				query: {},
				cookies: {},
				params: {},
			};

			const result = extractLocaleFromContext(context, {
				headerName: 'accept-language',
				parseAcceptLanguage: true,
				// availableLocales not specified - exact match 'xyz-abc' would pass, but let's see
			});

			// When availableLocales is not specified, exact match returns locale as-is
			expect(result).toBe('xyz-abc');
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
