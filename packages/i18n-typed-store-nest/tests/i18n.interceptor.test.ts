import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { defer, of } from 'rxjs';
import { createTranslationStore } from 'i18n-typed-store';
import { I18nModuleOptions, I18nService, I18nInterceptor, getRequestLocale } from '../src';

describe('I18nInterceptor', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	const createTestInterceptor = (options?: Partial<I18nModuleOptions>) => {
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

		const interceptorOptions: I18nModuleOptions = {
			store,
			queryParamName: 'locale',
			cookieName: 'locale',
			headerName: 'accept-language',
			parseAcceptLanguage: true,
			availableLocales: ['en', 'ru'],
			defaultLocale: 'en',
			...options,
		};

		const interceptor = new I18nInterceptor(service, interceptorOptions);

		return { interceptor, service, store };
	};

	const createExecutionContext = (request: any): ExecutionContext =>
		({
			switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
		}) as ExecutionContext;

	/**
	 * Returns a CallHandler whose `handle()` lazily reads the locale from the
	 * current ALS scope, mimicking what a controller would do.
	 */
	const createCapturingHandler = (capture: { locale?: string; requestLocale?: string }, service: I18nService): CallHandler => ({
		handle: () =>
			defer(() => {
				capture.locale = String(service.getLocale());
				capture.requestLocale = getRequestLocale();
				return of({});
			}),
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should attach I18nService to request', () => {
		const { interceptor, service } = createTestInterceptor();
		const request: any = {};
		const ctx = createExecutionContext(request);

		interceptor.intercept(ctx, { handle: () => of({}) }).subscribe();

		expect(request.i18nService).toBe(service);
	});

	it('should expose query-locale to the handler scope', () => {
		const { interceptor, service } = createTestInterceptor();
		const ctx = createExecutionContext({ query: { locale: 'ru' }, headers: {}, cookies: {}, params: {} });
		const capture: { locale?: string; requestLocale?: string } = {};

		interceptor.intercept(ctx, createCapturingHandler(capture, service)).subscribe();

		expect(capture.locale).toBe('ru');
		expect(capture.requestLocale).toBe('ru');
	});

	it('should expose cookie locale to the handler scope', () => {
		const { interceptor, service } = createTestInterceptor();
		const ctx = createExecutionContext({ cookies: { locale: 'ru' }, headers: {}, query: {}, params: {} });
		const capture: { locale?: string; requestLocale?: string } = {};

		interceptor.intercept(ctx, createCapturingHandler(capture, service)).subscribe();

		expect(capture.locale).toBe('ru');
	});

	it('should expose header locale to the handler scope', () => {
		const { interceptor, service } = createTestInterceptor();
		const ctx = createExecutionContext({ headers: { 'accept-language': 'ru' }, query: {}, cookies: {}, params: {} });
		const capture: { locale?: string; requestLocale?: string } = {};

		interceptor.intercept(ctx, createCapturingHandler(capture, service)).subscribe();

		expect(capture.locale).toBe('ru');
	});

	it('should fall back to default locale when no signal is present', () => {
		const { interceptor, service } = createTestInterceptor({ defaultLocale: 'ru' });
		const ctx = createExecutionContext({ headers: {}, query: {}, cookies: {}, params: {} });
		const capture: { locale?: string; requestLocale?: string } = {};

		interceptor.intercept(ctx, createCapturingHandler(capture, service)).subscribe();

		expect(capture.locale).toBe('ru');
		expect(capture.requestLocale).toBe('ru');
	});

	it('should ignore locales not in availableLocales', () => {
		const { interceptor, service } = createTestInterceptor();
		const ctx = createExecutionContext({ query: { locale: 'de' }, headers: {}, cookies: {}, params: {} });
		const capture: { locale?: string; requestLocale?: string } = {};

		interceptor.intercept(ctx, createCapturingHandler(capture, service)).subscribe();

		// 'de' is rejected, so detection falls back to defaultLocale 'en',
		// which IS valid and gets bound as the request locale.
		expect(capture.locale).toBe('en');
		expect(capture.requestLocale).toBe('en');
	});

	it('should not leak locale outside the observable scope', () => {
		const { interceptor, service } = createTestInterceptor();
		const ctx = createExecutionContext({ query: { locale: 'ru' }, headers: {}, cookies: {}, params: {} });

		interceptor.intercept(ctx, { handle: () => of({}) }).subscribe();

		// Outside the ALS scope, the singleton default is unchanged.
		expect(service.getLocale()).toBe('en');
	});

	it('should call next handler', async () => {
		const { interceptor } = createTestInterceptor();
		const ctx = createExecutionContext({ headers: {}, query: {}, cookies: {}, params: {} });
		const handler: CallHandler = { handle: () => of({}) };
		const handleSpy = vi.spyOn(handler, 'handle');

		await new Promise<void>((resolve) => {
			interceptor.intercept(ctx, handler).subscribe({
				complete: () => {
					expect(handleSpy).toHaveBeenCalled();
					resolve();
				},
			});
		});
	});

	it('should isolate locales across concurrent intercepts (no race condition)', async () => {
		const { interceptor, service } = createTestInterceptor();
		const seen: Record<string, string> = {};

		const run = (id: string, locale: string) =>
			new Promise<void>((resolve) => {
				const ctx = createExecutionContext({ query: { locale }, headers: {}, cookies: {}, params: {} });
				const handler: CallHandler = {
					handle: () =>
						defer(async () => {
							await new Promise((r) => setTimeout(r, 0));
							seen[id] = String(service.getLocale());
							return {};
						}),
				};
				interceptor.intercept(ctx, handler).subscribe({ complete: () => resolve() });
			});

		await Promise.all([run('a', 'ru'), run('b', 'en')]);

		expect(seen.a).toBe('ru');
		expect(seen.b).toBe('en');
	});
});
