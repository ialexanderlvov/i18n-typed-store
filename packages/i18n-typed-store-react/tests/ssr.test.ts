import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { getLocaleFromRequest, initializeStore, parseAcceptLanguage } from '../src/server';
import type { RequestContext } from '../src/server';
import { createTranslationStore } from 'i18n-typed-store';

describe('getLocaleFromRequest', () => {
	const locales = { en: 'en', ru: 'ru', de: 'de', fr: 'fr' } as const;
	const availableLocales = Object.values(locales);
	const defaultOptions = {
		defaultLocale: 'en',
		availableLocales,
	} as const;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('type inference', () => {
		it('should infer the exact locale union from a readonly tuple', () => {
			const typedAvailableLocales = ['en', 'ru', 'de-DE'] as const;
			const locale = getLocaleFromRequest(
				{},
				{
					availableLocales: typedAvailableLocales,
					defaultLocale: 'en',
				},
			);

			expectTypeOf(locale).toEqualTypeOf<'en' | 'ru' | 'de-DE'>();
			expect(locale).toBe('en');
		});

		it('should reject a default locale outside the available tuple', () => {
			const typedAvailableLocales = ['en', 'ru'] as const;
			const invalidOptions = {
				availableLocales: typedAvailableLocales,
				defaultLocale: 'de',
			} as const;

			// @ts-expect-error defaultLocale must be one of availableLocales
			getLocaleFromRequest({}, invalidOptions);
		});

		it('should preserve the explicit locale-map generic overload', () => {
			const locale = getLocaleFromRequest<typeof locales>({}, defaultOptions);
			const broadlyTypedLocale = getLocaleFromRequest<Record<string, string>>({}, defaultOptions);

			expectTypeOf(locale).toEqualTypeOf<keyof typeof locales>();
			expectTypeOf(broadlyTypedLocale).toEqualTypeOf<string>();
			expect(locale).toBe('en');
			expect(broadlyTypedLocale).toBe('en');
		});
	});

	describe('query parameter detection', () => {
		it('should return locale from query parameter', () => {
			const context: RequestContext = {
				query: { locale: 'ru' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('ru');
		});

		it('should return first element if query parameter is an array', () => {
			const context: RequestContext = {
				query: { locale: ['ru', 'de'] },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('ru');
		});

		it('should use custom query parameter name', () => {
			const context: RequestContext = {
				query: { lang: 'de' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'lang',
			});

			expect(locale).toBe('de');
		});

		it('should return default locale if query parameter is not available', () => {
			const context: RequestContext = {
				query: { other: 'value' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if query parameter value is not in available locales', () => {
			const context: RequestContext = {
				query: { locale: 'invalid' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if query is undefined', () => {
			const context: RequestContext = {};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('en');
		});

		it('should accept an explicitly undefined query value', () => {
			const context: RequestContext = {
				query: { locale: undefined },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('en');
		});
	});

	describe('cookie detection', () => {
		it('should return locale from cookie', () => {
			const context: RequestContext = {
				cookies: { locale: 'ru' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'locale',
			});

			expect(locale).toBe('ru');
		});

		it('should use custom cookie name', () => {
			const context: RequestContext = {
				cookies: { lang: 'de' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'lang',
			});

			expect(locale).toBe('de');
		});

		it('should return default locale if cookie is not set', () => {
			const context: RequestContext = {
				cookies: { other: 'value' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'locale',
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if cookie value is not in available locales', () => {
			const context: RequestContext = {
				cookies: { locale: 'invalid' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'locale',
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if cookies is undefined', () => {
			const context: RequestContext = {};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'locale',
			});

			expect(locale).toBe('en');
		});

		it('should accept an explicitly undefined cookie value', () => {
			const context: RequestContext = {
				cookies: { locale: undefined },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'locale',
			});

			expect(locale).toBe('en');
		});
	});

	describe('header detection', () => {
		it('should return locale from header', () => {
			const context: RequestContext = {
				headers: { 'x-locale': 'ru' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('ru');
		});

		it('should return first element if header is an array', () => {
			const context: RequestContext = {
				headers: { 'x-locale': ['ru', 'de'] },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('ru');
		});

		it('should use custom header name', () => {
			const context: RequestContext = {
				headers: { 'custom-locale': 'de' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'custom-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('de');
		});

		it('should return default locale if header is not set', () => {
			const context: RequestContext = {
				headers: { other: 'value' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if header value is not in available locales', () => {
			const context: RequestContext = {
				headers: { 'x-locale': 'invalid' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('en');
		});

		it('should work with Headers object', () => {
			const headers = new Headers();
			headers.set('x-locale', 'ru');
			const context: RequestContext = {
				headers,
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('ru');
		});

		it('should find a plain-object header case-insensitively', () => {
			const context: RequestContext = {
				headers: { 'X-Locale': 'ru' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('ru');
		});

		it('should accept an explicitly undefined plain-object header value', () => {
			const context: RequestContext = {
				headers: { 'x-locale': undefined },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if headers is undefined', () => {
			const context: RequestContext = {};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('en');
		});
	});

	describe('Accept-Language header parsing', () => {
		it('should find an Accept-Language plain-object header case-insensitively', () => {
			const context: RequestContext = {
				headers: { 'Accept-Language': 'ru,en;q=0.9' },
			};

			const locale = getLocaleFromRequest(context, defaultOptions);

			expect(locale).toBe('ru');
		});

		it('should combine multiple Accept-Language field lines', () => {
			const context: RequestContext = {
				headers: { 'accept-language': ['fr;q=0.1', 'ru;q=1'] },
			};

			const locale = getLocaleFromRequest(context, defaultOptions);

			expect(locale).toBe('ru');
		});

		it('should parse Accept-Language header and return exact match', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'ru,en;q=0.9' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('ru');
		});

		it('should parse Accept-Language header and return best match by quality', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'en;q=0.5,ru;q=0.9,de;q=0.8' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('ru');
		});

		it('should parse Accept-Language header and match language code', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'en-US,en;q=0.9' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('en');
		});

		it('should parse Accept-Language header case-insensitively', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'RU,en;q=0.9' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('ru');
		});

		it('should return default locale if Accept-Language has no matches', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'zh-CN,ja;q=0.9' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if Accept-Language is empty', () => {
			const context: RequestContext = {
				headers: { 'accept-language': '' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if Accept-Language header is undefined', () => {
			const context: RequestContext = {
				headers: {},
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('en');
		});

		it('should return default locale if Accept-Language header is missing with Headers object', () => {
			const headers = new Headers();
			const context: RequestContext = {
				headers,
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('en');
		});

		it('should not parse Accept-Language if parseAcceptLanguage is false', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'ru,en;q=0.9' },
			};

			// With parseAcceptLanguage: false, it should try to match 'ru,en;q=0.9' as a single locale
			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('en'); // Should return default because 'ru,en;q=0.9' is not in available locales
		});

		it('should parse Accept-Language with Headers object', () => {
			const headers = new Headers();
			headers.set('accept-language', 'de,ru;q=0.9');
			const context: RequestContext = {
				headers,
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('de');
		});

		it('should not match a language onto an unrelated locale sharing its prefix (fr vs fris)', () => {
			// The old startsWith matching resolved 'fr' to a 'fris' locale.
			// BCP 47 subtag matching must not: 'fr' and 'fris' are different languages.
			const context: RequestContext = {
				headers: { 'accept-language': 'fr' },
			};

			const locale = getLocaleFromRequest(context, {
				defaultLocale: 'en',
				availableLocales: ['fris', 'en'],
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('en');
		});

		it('should still match language subtags onto regional locales (en matches en-US)', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'en' },
			};

			const locale = getLocaleFromRequest(context, {
				defaultLocale: 'ru',
				availableLocales: ['ru', 'en-US'],
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('en-US');
		});

		it('should ignore a language range with a malformed q value', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'ru;q=garbage,en;q=0.5' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('en');
		});

		it('should ignore languages explicitly rejected with q=0', () => {
			const context: RequestContext = {
				headers: { 'accept-language': 'ru;q=0,de;q=0.5' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'accept-language',
				parseAcceptLanguage: true,
			});

			expect(locale).toBe('de');
		});
	});

	describe('BCP 47 matching for query and cookie values', () => {
		it('should accept ?locale=ru-RU when only base locales are available', () => {
			const context: RequestContext = {
				query: { locale: 'ru-RU' },
			};

			const locale = getLocaleFromRequest(context, {
				defaultLocale: 'en',
				availableLocales: ['en', 'ru'],
				queryParamName: 'locale',
			});

			expect(locale).toBe('ru');
		});

		it('should accept a BCP 47 cookie value when only base locales are available', () => {
			const context: RequestContext = {
				cookies: { locale: 'de-AT' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'locale',
			});

			expect(locale).toBe('de');
		});

		it('should fall through to the next source when the query value has no BCP 47 match', () => {
			const context: RequestContext = {
				query: { locale: 'ja-JP' },
				cookies: { locale: 'ru' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
				cookieName: 'locale',
			});

			expect(locale).toBe('ru');
		});
	});

	describe('priority order', () => {
		it('should prioritize query parameter over cookie', () => {
			const context: RequestContext = {
				query: { locale: 'ru' },
				cookies: { locale: 'de' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
				cookieName: 'locale',
			});

			expect(locale).toBe('ru');
		});

		it('should prioritize query parameter over header', () => {
			const context: RequestContext = {
				query: { locale: 'ru' },
				headers: { 'x-locale': 'de' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('ru');
		});

		it('should prioritize cookie over header', () => {
			const context: RequestContext = {
				cookies: { locale: 'de' },
				headers: { 'x-locale': 'ru' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'locale',
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('de');
		});

		it('should prioritize query parameter over cookie and header', () => {
			const context: RequestContext = {
				query: { locale: 'fr' },
				cookies: { locale: 'de' },
				headers: { 'x-locale': 'ru' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
				cookieName: 'locale',
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('fr');
		});
	});

	describe('default locale', () => {
		it('should return default locale when no source provides valid locale', () => {
			const context: RequestContext = {};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
			});

			expect(locale).toBe('en');
		});

		it('should use custom default locale', () => {
			const context: RequestContext = {};

			const locale = getLocaleFromRequest(context, {
				defaultLocale: 'ru',
				availableLocales,
			});

			expect(locale).toBe('ru');
		});
	});

	describe('edge cases', () => {
		it('should handle empty query parameter value', () => {
			const context: RequestContext = {
				query: { locale: '' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('en');
		});

		it('should handle empty cookie value', () => {
			const context: RequestContext = {
				cookies: { locale: '' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				cookieName: 'locale',
			});

			expect(locale).toBe('en');
		});

		it('should handle empty header value', () => {
			const context: RequestContext = {
				headers: { 'x-locale': '' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				headerName: 'x-locale',
				parseAcceptLanguage: false,
			});

			expect(locale).toBe('en');
		});

		it('should match query locale case-insensitively (BCP 47 matching)', () => {
			// Rewritten: query/cookie values now go through BCP 47 matching
			// (findBestLocaleMatch), which is case-insensitive per the spec —
			// 'RU' resolves to the available 'ru' locale instead of falling back
			// to the default.
			const context: RequestContext = {
				query: { locale: 'RU' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('ru');
		});
	});
});

describe('parseAcceptLanguage', () => {
	it('should reject a default locale outside the available tuple', () => {
		const availableLocales = ['en', 'ru'] as const;

		// @ts-expect-error -- defaultLocale must be one of availableLocales
		parseAcceptLanguage(undefined, availableLocales, 'de');

		expect(true).toBe(true);
	});

	it('should use a wildcard to select the first available locale', () => {
		const availableLocales = ['de', 'en', 'ru'] as const;
		const locale = parseAcceptLanguage('fr;q=0.9,*;q=0.8', availableLocales, 'en');

		expectTypeOf(locale).toEqualTypeOf<'de' | 'en' | 'ru'>();
		expect(locale).toBe('de');
	});

	it('should exclude a q=0 range from a wildcard match', () => {
		const locale = parseAcceptLanguage('en;q=0,*;q=0.8', ['en', 'ru', 'de'] as const, 'en');

		expect(locale).toBe('ru');
	});

	it('should not return the default locale when it is explicitly rejected', () => {
		const locale = parseAcceptLanguage('fr;q=0.9,en;q=0', ['en', 'ru'] as const, 'en');

		expect(locale).toBe('ru');
	});

	it('should allow a specific positive range to override a rejected wildcard', () => {
		const locale = parseAcceptLanguage('en;q=1,*;q=0', ['ru', 'en'] as const, 'ru');

		expect(locale).toBe('en');
	});

	it('should let a more specific range control quality over a wildcard', () => {
		const locale = parseAcceptLanguage('*;q=1,en;q=0.5', ['en', 'ru'] as const, 'en');

		expect(locale).toBe('ru');
	});

	it('should not bypass a direct q=0 exclusion through locale fallback', () => {
		const locale = parseAcceptLanguage('en-US;q=1,en;q=0', ['en', 'ru'] as const, 'ru');

		expect(locale).toBe('ru');
	});

	it('should let a specific q=0 range override a positive general range', () => {
		const locale = parseAcceptLanguage('en;q=1,en-US;q=0', ['en-US', 'en-GB'] as const, 'en-US');

		expect(locale).toBe('en-GB');
	});

	it('should let a specific positive range override a general q=0 range', () => {
		const locale = parseAcceptLanguage('en;q=0,en-US;q=1', ['en-US', 'ru'] as const, 'ru');

		expect(locale).toBe('en-US');
	});

	it('should use the effective quality of each available locale', () => {
		const locale = parseAcceptLanguage('en;q=0.8,en-US;q=0.7', ['en-US', 'en-GB'] as const, 'en-US');

		expect(locale).toBe('en-GB');
	});

	it('should prefer a positive locale fallback over a lower-quality wildcard', () => {
		const locale = parseAcceptLanguage('en-US;q=1,*;q=0.5', ['en', 'ru'] as const, 'ru');

		expect(locale).toBe('en');
	});

	it('should use the core matcher specificity for a locale fallback', () => {
		const locale = parseAcceptLanguage('zh-Hans-SG', ['zh', 'zh-Hans-CN'] as const, 'zh');

		expect(locale).toBe('zh-Hans-CN');
	});

	it('should preserve direct q=0 exclusions when choosing a specific fallback', () => {
		const locale = parseAcceptLanguage('zh-Hans-SG;q=1,zh-Hans-CN;q=0,*;q=0.5', ['zh', 'zh-Hans-CN'] as const, 'zh');

		expect(locale).toBe('zh');
	});

	it('should use quality to choose between equally specific locale fallbacks', () => {
		const locale = parseAcceptLanguage('en-US;q=0.1,en-GB;q=0.9,*;q=0.5', ['en', 'ru'] as const, 'ru');

		expect(locale).toBe('en');
	});

	it.each(['garbage', '1.1', '2', '-0.1', '.5', '0.1234', '1.0001'])(
		'should ignore a range with malformed or out-of-range quality %s',
		(quality) => {
			const locale = parseAcceptLanguage(`ru;q=${quality},en;q=0.5`, ['ru', 'en'] as const, 'ru');

			expect(locale).toBe('en');
		},
	);

	it('should preserve header order for equally weighted ranges', () => {
		const locale = parseAcceptLanguage('ru;q=0.8,en;q=0.8', ['en', 'ru'] as const, 'en');

		expect(locale).toBe('ru');
	});
});

describe('initializeStore', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru', de: 'de' } as const;

	const createTestStore = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async () => ({}),
			extractTranslation: () => ({}),
			defaultLocale: 'en',
		});

		return storeFactory.type<{ common: { greeting: string } }>();
	};

	it('should change store locale to the specified locale', () => {
		const store = createTestStore();
		expect(store.currentLocale).toBe('en');

		initializeStore(store, 'ru');

		expect(store.currentLocale).toBe('ru');
	});

	it('should change store locale multiple times', () => {
		const store = createTestStore();
		expect(store.currentLocale).toBe('en');

		initializeStore(store, 'ru');
		expect(store.currentLocale).toBe('ru');

		initializeStore(store, 'de');
		expect(store.currentLocale).toBe('de');

		initializeStore(store, 'en');
		expect(store.currentLocale).toBe('en');
	});

	it('should trigger locale change listeners', () => {
		const store = createTestStore();
		const listener = vi.fn();

		store.addChangeLocaleListener(listener);
		initializeStore(store, 'ru');

		expect(listener).toHaveBeenCalledWith('ru', { source: 'sync', loadedNamespaces: [] });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('should trigger multiple locale change listeners', () => {
		const store = createTestStore();
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		store.addChangeLocaleListener(listener1);
		store.addChangeLocaleListener(listener2);
		initializeStore(store, 'de');

		expect(listener1).toHaveBeenCalledWith('de', { source: 'sync', loadedNamespaces: [] });
		expect(listener2).toHaveBeenCalledWith('de', { source: 'sync', loadedNamespaces: [] });
	});
});
