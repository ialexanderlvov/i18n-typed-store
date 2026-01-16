import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocaleFromRequest, initializeStore, RequestContext } from '../src/index';
import { createTranslationStore } from 'i18n-typed-store';

describe('getLocaleFromRequest', () => {
	const locales = { en: 'en', ru: 'ru', de: 'de', fr: 'fr' } as const;
	const availableLocales = Object.values(locales);
	const defaultOptions = {
		defaultLocale: 'en',
		availableLocales,
	};

	beforeEach(() => {
		vi.clearAllMocks();
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

		it('should handle case sensitivity in available locales', () => {
			const context: RequestContext = {
				query: { locale: 'RU' },
			};

			const locale = getLocaleFromRequest(context, {
				...defaultOptions,
				queryParamName: 'locale',
			});

			expect(locale).toBe('en'); // 'RU' !== 'ru', so should return default
		});
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

		expect(listener).toHaveBeenCalledWith('ru');
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('should trigger multiple locale change listeners', () => {
		const store = createTestStore();
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		store.addChangeLocaleListener(listener1);
		store.addChangeLocaleListener(listener2);
		initializeStore(store, 'de');

		expect(listener1).toHaveBeenCalledWith('de');
		expect(listener2).toHaveBeenCalledWith('de');
	});
});
