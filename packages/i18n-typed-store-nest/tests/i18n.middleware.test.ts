import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nMiddleware, I18nModuleOptions, I18nService } from '../src';
import { createTranslationStore } from 'i18n-typed-store';

describe('I18nMiddleware', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	const createTestMiddleware = (options?: Partial<I18nModuleOptions>) => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async () => ({}),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<{ common: any }>();

		const service = new I18nService(store, {
			store,
			...options,
		} as I18nModuleOptions);

		const middlewareOptions: I18nModuleOptions = {
			store,
			queryParamName: 'locale',
			cookieName: 'locale',
			headerName: 'accept-language',
			parseAcceptLanguage: true,
			availableLocales: ['en', 'ru'],
			defaultLocale: 'en',
			...options,
		};

		const middleware = new I18nMiddleware(service, middlewareOptions);

		return { middleware, service, store };
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should attach I18nService to request', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = {};
		const res: any = {};
		const next = vi.fn();

		middleware.use(req, res, next);

		expect(req.i18nService).toBe(service);
		expect(next).toHaveBeenCalled();
	});

	it('should extract locale from query parameter', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = {
			query: { locale: 'ru' },
			headers: {},
			cookies: {},
			params: {},
		};
		const res: any = {};
		const next = vi.fn();

		middleware.use(req, res, next);

		expect(service.getLocale()).toBe('ru');
		expect(next).toHaveBeenCalled();
	});

	it('should extract locale from cookie', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = {
			cookies: { locale: 'ru' },
			headers: {},
			query: {},
			params: {},
		};
		const res: any = {};
		const next = vi.fn();

		middleware.use(req, res, next);

		expect(service.getLocale()).toBe('ru');
		expect(next).toHaveBeenCalled();
	});

	it('should extract locale from header', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = {
			headers: { 'accept-language': 'ru' },
			query: {},
			cookies: {},
			params: {},
		};
		const res: any = {};
		const next = vi.fn();

		middleware.use(req, res, next);

		expect(service.getLocale()).toBe('ru');
		expect(next).toHaveBeenCalled();
	});

	it('should use default locale if no locale found', () => {
		const { middleware, service } = createTestMiddleware({ defaultLocale: 'ru' });
		const req: any = {
			headers: {},
			query: {},
			cookies: {},
			params: {},
		};
		const res: any = {};
		const next = vi.fn();

		middleware.use(req, res, next);

		expect(service.getLocale()).toBe('ru');
		expect(next).toHaveBeenCalled();
	});

	it('should not set locale if extracted locale is not in available locales', () => {
		const { middleware, service } = createTestMiddleware();
		service.setLocale('en');
		const req: any = {
			query: { locale: 'de' },
			headers: {},
			cookies: {},
			params: {},
		};
		const res: any = {};
		const next = vi.fn();

		middleware.use(req, res, next);

		expect(service.getLocale()).toBe('en');
		expect(next).toHaveBeenCalled();
	});

	it('should set locale when extracted locale is valid (covers lines 67-71)', () => {
		const { middleware, service } = createTestMiddleware();
		service.setLocale('en');
		const req: any = {
			query: { locale: 'ru' },
			headers: {},
			cookies: {},
			params: {},
		};
		const res: any = {};
		const next = vi.fn();

		middleware.use(req, res, next);

		// This covers lines 67-71: if (locale) { ... if (locale in locales) { setLocale } }
		expect(service.getLocale()).toBe('ru');
		expect(next).toHaveBeenCalled();
	});

	it('should not set locale when extracted locale is undefined (covers line 67)', () => {
		const { middleware, service } = createTestMiddleware();
		service.setLocale('en');
		const req: any = {
			headers: {},
			query: {},
			cookies: {},
			params: {},
		};
		const res: any = {};
		const next = vi.fn();

		middleware.use(req, res, next);

		// This covers line 67: if (locale) - when locale is undefined, the block is skipped
		expect(service.getLocale()).toBe('en');
		expect(next).toHaveBeenCalled();
	});
});
