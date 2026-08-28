import { describe, it, expect } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { defer, of } from 'rxjs';
import { createTranslationStore } from 'i18n-typed-store';
import {
	I18nModule,
	I18nModuleOptions as GenericI18nModuleOptions,
	I18nService,
	I18nInterceptor,
	I18nMiddleware,
	I18nLang,
	Locale,
	getRequestLocale,
	runWithRequestLocale,
} from '../src';
import { resolveTranslationParam } from '../src/lib/decorators';
import { attachI18nServiceToRequest, extractLocaleFromContext } from '../src/lib/utils';

/**
 * Tests for the production-hardening audit fixes:
 *  1. getCurrentTranslation reads the per-request locale slot (no shared-slot race).
 *  2. The interceptor survives GraphQL / WS / RPC execution contexts.
 *  3. Locale detection is BCP 47 aware and case-insensitive on every source.
 *  4. @Translation() resolves to undefined on a failed load (no 500).
 *  6. Configurable resolvers (order + custom functions).
 *  7. setLocale is request-scoped inside a request, global outside;
 *     @I18nLang alias; defaultLocale validated at configuration time.
 */
describe('production fixes (nest)', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	type TestTranslations = { common: { greeting: string } };
	type I18nModuleOptions = GenericI18nModuleOptions<any, any, any>;

	const createStore = (loadDelayMs = 0) => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale) => {
				if (loadDelayMs > 0) {
					await new Promise((resolve) => setTimeout(resolve, loadDelayMs));
				}
				return { greeting: locale === 'ru' ? 'Привет' : 'Hello' };
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});
		return storeFactory.type<TestTranslations>();
	};

	const createService = (store = createStore(), options?: Partial<I18nModuleOptions>) =>
		new I18nService(store, { store, ...options } as I18nModuleOptions);

	const createInterceptorSetup = (options?: Partial<I18nModuleOptions>) => {
		const store = createStore();
		const interceptorOptions: I18nModuleOptions = {
			store,
			availableLocales: ['en', 'ru'],
			defaultLocale: 'en',
			...options,
		};
		const service = new I18nService(store, interceptorOptions);
		const interceptor = new I18nInterceptor(service, interceptorOptions);
		return { interceptor, service, store };
	};

	const createHttpContext = (request: any): ExecutionContext =>
		({
			getType: () => 'http',
			getArgs: () => [request, {}, () => undefined],
			switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
		}) as unknown as ExecutionContext;

	const createCapturingHandler = (capture: { locale?: string; requestLocale?: string }, service: I18nService): CallHandler => ({
		handle: () =>
			defer(() => {
				capture.locale = String(service.getLocale());
				capture.requestLocale = getRequestLocale();
				return of({});
			}),
	});

	describe('fix 1: getCurrentTranslation is per-request (no shared currentTranslation reads)', () => {
		it('returns each request locale while the shared pointer follows the store-selected locale', async () => {
			const store = createStore();
			const service = createService(store);
			await service.loadTranslation('common', 'en');
			await service.loadTranslation('common', 'ru');
			// Loading an off-selected locale warms its raw cache without replacing
			// the store-wide pointer, which still belongs to the selected `en` locale.
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Hello' });
			expect(store.translations.common.translations.ru.namespace).toEqual({ greeting: 'Привет' });

			// Request-scoped reads use those per-locale cache slots, not the pointer.
			runWithRequestLocale('en', () => {
				expect(service.getCurrentTranslation('common')).toEqual({ greeting: 'Hello' });
			});
			runWithRequestLocale('ru', () => {
				expect(service.getCurrentTranslation('common')).toEqual({ greeting: 'Привет' });
			});
		});

		it('returns undefined when the request locale is not loaded yet, even if another locale is', async () => {
			const service = createService();
			await service.loadTranslation('common', 'en');

			runWithRequestLocale('ru', () => {
				expect(service.getCurrentTranslation('common')).toBeUndefined();
			});
		});

		it('loadTranslation without an explicit locale loads for the request (ALS) locale', async () => {
			const store = createStore();
			const service = createService(store);

			await runWithRequestLocale('ru', async () => {
				await service.loadTranslation('common');
			});

			expect(store.translations.common.translations.ru.namespace).toEqual({ greeting: 'Привет' });
			expect(store.translations.common.translations.en.namespace).toBeUndefined();
		});
	});

	describe('fix 2: interceptor on non-HTTP execution contexts', () => {
		it('does not crash on a GraphQL context and detects the locale from args[2].req', () => {
			const { interceptor, service } = createInterceptorSetup();
			const gqlRequest = { query: { locale: 'ru' }, headers: {}, cookies: {}, params: {} };
			const context = {
				getType: () => 'graphql',
				getArgs: () => [{}, {}, { req: gqlRequest }, {}],
				switchToHttp: () => {
					throw new Error('switchToHttp must not be called for graphql contexts');
				},
			} as unknown as ExecutionContext;
			const capture: { locale?: string; requestLocale?: string } = {};

			interceptor.intercept(context, createCapturingHandler(capture, service)).subscribe();

			expect(capture.locale).toBe('ru');
			expect((gqlRequest as any).i18nService).toBe(service);
		});

		it('does not crash on a GraphQL context WITHOUT a req (e.g. subscriptions) and uses the default locale', () => {
			const { interceptor, service } = createInterceptorSetup();
			const context = {
				getType: () => 'graphql',
				getArgs: () => [{}, {}, undefined, {}],
			} as unknown as ExecutionContext;
			const capture: { locale?: string; requestLocale?: string } = {};

			expect(() => interceptor.intercept(context, createCapturingHandler(capture, service)).subscribe()).not.toThrow();
			expect(capture.locale).toBe('en');
		});

		it('does not crash on a WS context and binds the default locale', () => {
			const { interceptor, service } = createInterceptorSetup();
			const context = {
				getType: () => 'ws',
				getArgs: () => ['client', 'payload'],
			} as unknown as ExecutionContext;
			const capture: { locale?: string; requestLocale?: string } = {};

			expect(() => interceptor.intercept(context, createCapturingHandler(capture, service)).subscribe()).not.toThrow();
			expect(capture.locale).toBe('en');
			expect(capture.requestLocale).toBe('en');
		});

		it('does not crash on an RPC context', () => {
			const { interceptor, service } = createInterceptorSetup();
			const context = {
				getType: () => 'rpc',
				getArgs: () => [{}],
			} as unknown as ExecutionContext;
			const capture: { locale?: string } = {};

			expect(() => interceptor.intercept(context, createCapturingHandler(capture, service)).subscribe()).not.toThrow();
			expect(capture.locale).toBe('en');
		});

		it('attachI18nServiceToRequest tolerates repeated attachment and hostile requests', () => {
			const service = { marker: 'service' };
			const request: Record<string, unknown> = {};

			// First define: non-configurable — the historical crash was the second define.
			attachI18nServiceToRequest(request, service);
			expect(() => attachI18nServiceToRequest(request, { marker: 'other' })).not.toThrow();
			expect((request as any).i18nService).toBe(service);

			// Non-object requests are a no-op.
			expect(() => attachI18nServiceToRequest(undefined, service)).not.toThrow();
			expect(() => attachI18nServiceToRequest(null, service)).not.toThrow();
			expect(() => attachI18nServiceToRequest('socket', service)).not.toThrow();

			// Frozen request: defineProperty throw is swallowed.
			const frozen = Object.freeze({});
			expect(() => attachI18nServiceToRequest(frozen, service)).not.toThrow();
		});
	});

	describe('fix 3: BCP 47 and case-insensitive locale detection', () => {
		it('resolves ?locale=ru-RU to the "ru" store key through the interceptor', () => {
			const { interceptor, service } = createInterceptorSetup();
			const context = createHttpContext({ query: { locale: 'ru-RU' }, headers: {}, cookies: {}, params: {} });
			const capture: { locale?: string; requestLocale?: string } = {};

			interceptor.intercept(context, createCapturingHandler(capture, service)).subscribe();

			expect(capture.locale).toBe('ru');
			expect(capture.requestLocale).toBe('ru');
		});

		it('matches Accept-Language "EN-us" against a store keyed by "en-US"', () => {
			const regionLocales = { 'en-US': 'en-US', ru: 'ru' } as const;
			const storeFactory = createTranslationStore({
				namespaces,
				locales: regionLocales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en-US',
			});
			const store = storeFactory.type<TestTranslations>();
			const options: I18nModuleOptions = { store, availableLocales: ['en-US', 'ru'], defaultLocale: 'en-US' };
			const service = new I18nService(store, options);
			const interceptor = new I18nInterceptor(service, options);

			const context = createHttpContext({ headers: { 'accept-language': 'EN-us' }, query: {}, cookies: {}, params: {} });
			const capture: { locale?: string; requestLocale?: string } = {};

			interceptor.intercept(context, createCapturingHandler(capture, service)).subscribe();

			expect(capture.requestLocale).toBe('en-US');
		});

		it('resolves a BCP 47 cookie value through the middleware', () => {
			const store = createStore();
			const options: I18nModuleOptions = { store, availableLocales: ['en', 'ru'], defaultLocale: 'en' };
			const service = new I18nService(store, options);
			const middleware = new I18nMiddleware(service, options);
			let captured: string | undefined;

			middleware.use({ cookies: { locale: 'RU-ru' }, headers: {}, query: {}, params: {} } as any, {} as any, () => {
				captured = getRequestLocale();
			});

			expect(captured).toBe('ru');
		});
	});

	describe('fix 4: @Translation() with a failing loader resolves to undefined', () => {
		const createFailingService = () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => {
					throw new Error('network down');
				},
				extractTranslation: (module) => module as TestTranslations['common'],
				defaultLocale: 'en',
			});
			const store = storeFactory.type<TestTranslations>();
			return new I18nService(store, { store } as I18nModuleOptions);
		};

		it('service.getTranslation resolves to undefined instead of rejecting', async () => {
			const service = createFailingService();
			await expect(service.getTranslation('common')).resolves.toBeUndefined();
		});

		it('resolveTranslationParam (the @Translation() body) resolves to undefined instead of rejecting', async () => {
			const service = createFailingService();
			const request: any = {};
			attachI18nServiceToRequest(request, service);
			const context = createHttpContext(request);

			await expect(resolveTranslationParam('common', context)).resolves.toBeUndefined();
		});
	});

	describe('fix 6: configurable resolvers', () => {
		const context = {
			query: { locale: 'en' },
			headers: { 'accept-language': 'ru' },
			cookies: {},
			params: {},
		};

		it('applies sources in the configured order (header before query)', () => {
			const result = extractLocaleFromContext(context, {
				availableLocales: ['en', 'ru'],
				resolvers: ['header', 'query'],
			});
			expect(result).toBe('ru');
		});

		it('defaults to query > route > cookie > header', () => {
			const result = extractLocaleFromContext(context, {
				availableLocales: ['en', 'ru'],
			});
			expect(result).toBe('en');
		});

		it('supports a custom resolver function receiving the raw request', () => {
			const request = { user: { language: 'ru-RU' } };
			const result = extractLocaleFromContext(context, {
				availableLocales: ['en', 'ru'],
				resolvers: [(req) => (req as { user?: { language?: string } })?.user?.language, 'query'],
				request,
			});
			// Custom value is BCP 47-normalized against availableLocales too.
			expect(result).toBe('ru');
		});

		it('falls through to the next resolver when the custom function returns undefined', () => {
			const result = extractLocaleFromContext(context, {
				availableLocales: ['en', 'ru'],
				resolvers: [() => undefined, 'query'],
			});
			expect(result).toBe('en');
		});

		it('is honored end-to-end by the interceptor', () => {
			const { interceptor, service } = createInterceptorSetup({ resolvers: ['header', 'query'] });
			const httpContext = createHttpContext({
				query: { locale: 'en' },
				headers: { 'accept-language': 'ru' },
				cookies: {},
				params: {},
			});
			const capture: { locale?: string; requestLocale?: string } = {};

			interceptor.intercept(httpContext, createCapturingHandler(capture, service)).subscribe();

			expect(capture.locale).toBe('ru');
		});
	});

	describe('fix 7: API polish', () => {
		it('@I18nLang is an alias of @Locale', () => {
			expect(I18nLang).toBe(Locale);
		});

		it('setLocale inside a request scope changes ONLY the request locale', () => {
			const store = createStore();
			const service = createService(store);

			runWithRequestLocale('en', () => {
				service.setLocale('ru');
				expect(getRequestLocale()).toBe('ru');
				expect(String(service.getLocale())).toBe('ru');
			});

			// The global default was NOT touched.
			expect(store.currentLocale).toBe('en');
		});

		it('setLocale outside a request scope changes the global store locale', () => {
			const store = createStore();
			const service = createService(store);

			service.setLocale('ru');

			expect(store.currentLocale).toBe('ru');
		});

		it('setLocale accepts a BCP 47 tag and rejects unknown locales', () => {
			const store = createStore();
			const service = createService(store);

			service.setLocale('ru-RU');
			expect(store.currentLocale).toBe('ru');

			expect(() => service.setLocale('de')).toThrow("Invalid locale: 'de' is not a valid locale key");
		});

		it('forRoot throws a descriptive error when defaultLocale is not a store locale key', () => {
			const store = createStore();
			expect(() => I18nModule.forRoot({ store, defaultLocale: 'de' as any })).toThrow(
				/defaultLocale 'de' is not a key of store\.locales.*'en', 'ru'/,
			);
		});
	});

	describe('useGlobalInterceptor option', () => {
		it('registers APP_INTERCEPTOR by default', () => {
			const store = createStore();
			const dynamicModule = I18nModule.forRoot({ store, defaultLocale: 'en' });

			const appInterceptor = dynamicModule.providers?.find((provider: any) => provider.provide === APP_INTERCEPTOR);
			expect(appInterceptor).toBeDefined();
			expect((appInterceptor as any).useExisting).toBe(I18nInterceptor);
		});

		it('useGlobalInterceptor: false omits APP_INTERCEPTOR but still provides and exports I18nInterceptor', () => {
			const store = createStore();
			const dynamicModule = I18nModule.forRoot({ store, defaultLocale: 'en', useGlobalInterceptor: false });

			const appInterceptor = dynamicModule.providers?.find((provider: any) => provider.provide === APP_INTERCEPTOR);
			expect(appInterceptor).toBeUndefined();
			expect(dynamicModule.providers).toContain(I18nInterceptor);
			expect(dynamicModule.exports).toContain(I18nInterceptor);
		});

		it('useGlobalInterceptor: false is honored by forRootAsync (static flag)', () => {
			const store = createStore();
			const dynamicModule = I18nModule.forRootAsync({
				useFactory: () => ({ store, defaultLocale: 'en' }) as I18nModuleOptions,
				useGlobalInterceptor: false,
			});

			const appInterceptor = dynamicModule.providers?.find((provider: any) => provider.provide === APP_INTERCEPTOR);
			expect(appInterceptor).toBeUndefined();
		});
	});
});
