import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nMiddleware, I18nModuleOptions as GenericI18nModuleOptions, I18nService, getRequestLocale } from '../src';
import { createTranslationStore } from 'i18n-typed-store';

describe('I18nMiddleware', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;
	type TestTranslations = { common: any };
	type I18nModuleOptions = GenericI18nModuleOptions<typeof namespaces, typeof locales, TestTranslations>;
	type TestI18nService = I18nService<typeof namespaces, typeof locales, TestTranslations>;

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

	/**
	 * Helper that runs `next` synchronously inside the middleware's ALS scope
	 * and captures `service.getLocale()` from within that scope, since the
	 * locale is now request-scoped (not a singleton mutation).
	 */
	const captureLocaleInScope = (middleware: I18nMiddleware, service: TestI18nService, req: any) => {
		let captured: string | undefined;
		let requestLocale: string | undefined;
		let nextCalled = false;
		middleware.use(req, {}, () => {
			nextCalled = true;
			captured = String(service.getLocale());
			requestLocale = getRequestLocale();
		});
		return { captured, requestLocale, nextCalled };
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should attach I18nService to request', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = {};
		const next = vi.fn();

		middleware.use(req, {}, next);

		expect(req.i18nService).toBe(service);
		expect(next).toHaveBeenCalled();
	});

	it('should expose locale from query parameter to handler scope', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = { query: { locale: 'ru' }, headers: {}, cookies: {}, params: {} };

		const { captured, requestLocale, nextCalled } = captureLocaleInScope(middleware, service, req);

		expect(captured).toBe('ru');
		expect(requestLocale).toBe('ru');
		expect(nextCalled).toBe(true);
	});

	it('should expose locale from cookie to handler scope', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = { cookies: { locale: 'ru' }, headers: {}, query: {}, params: {} };

		const { captured } = captureLocaleInScope(middleware, service, req);

		expect(captured).toBe('ru');
	});

	it('should expose locale from header to handler scope', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = { headers: { 'accept-language': 'ru' }, query: {}, cookies: {}, params: {} };

		const { captured } = captureLocaleInScope(middleware, service, req);

		expect(captured).toBe('ru');
	});

	it('should fall back to default locale when no header/query/cookie provided', () => {
		const { middleware, service } = createTestMiddleware({ defaultLocale: 'ru' });
		const req: any = { headers: {}, query: {}, cookies: {}, params: {} };

		const { captured, requestLocale } = captureLocaleInScope(middleware, service, req);

		expect(captured).toBe('ru');
		expect(requestLocale).toBe('ru');
	});

	it('should ignore locales that are not in availableLocales', () => {
		const { middleware, service } = createTestMiddleware();
		const req: any = { query: { locale: 'de' }, headers: {}, cookies: {}, params: {} };

		const { captured, requestLocale } = captureLocaleInScope(middleware, service, req);

		// 'de' is not in availableLocales, so locale detection falls back to
		// the configured defaultLocale ('en'), which is valid and gets bound
		// to the request scope.
		expect(captured).toBe('en');
		expect(requestLocale).toBe('en');
	});

	it('should not leak locale outside the request scope (per-request isolation)', () => {
		const { middleware, service } = createTestMiddleware();

		captureLocaleInScope(middleware, service, {
			query: { locale: 'ru' },
			headers: {},
			cookies: {},
			params: {},
		});

		// Outside the ALS scope the singleton is unchanged.
		expect(service.getLocale()).toBe('en');
	});

	it('should isolate concurrent requests (no race condition)', async () => {
		const { middleware, service } = createTestMiddleware();

		const seen: Record<string, string> = {};

		const handle = (id: string, locale: string) =>
			new Promise<void>((resolve) => {
				middleware.use({ query: { locale }, headers: {}, cookies: {}, params: {} } as any, {} as any, async () => {
					// Yield to the event loop so the other request runs interleaved.
					await new Promise((r) => setTimeout(r, 0));
					seen[id] = String(service.getLocale());
					resolve();
				});
			});

		await Promise.all([handle('a', 'ru'), handle('b', 'en')]);

		expect(seen.a).toBe('ru');
		expect(seen.b).toBe('en');
	});
});
