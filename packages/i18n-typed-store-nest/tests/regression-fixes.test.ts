import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { defer, of } from 'rxjs';
import { createTranslationStore } from 'i18n-typed-store';
import {
	I18nModule,
	I18nModuleOptions,
	I18nService,
	I18nInterceptor,
	I18N_OPTIONS,
	I18N_STORE,
	getRequestLocale,
	i18nRequestStorage,
} from '../src';

/**
 * Regression tests for the audit fixes:
 *  - getTranslation / getTranslationByKey no longer crash on a BCP 47 locale
 *    that resolves to a different store key (e.g. 'en-US' -> 'en').
 *  - preload uses allSettled and never crashes bootstrap on a failing load.
 *  - forRootAsync wires the store from the resolved options.
 *  - the interceptor does not clobber a locale already set upstream (guard).
 */
describe('audit regression fixes (nest)', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	type TestTranslations = { common: { greeting: string } };

	const createTestService = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale) => (locale === 'ru' ? { greeting: 'Привет' } : { greeting: 'Hello' }),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});
		const store = storeFactory.type<TestTranslations>();
		return new I18nService(store, { store } as I18nModuleOptions);
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getTranslation with a BCP 47 locale that is not a literal store key', () => {
		it('getTranslation("common", "en-US") resolves to "en" instead of throwing', async () => {
			const service = createTestService();
			const result = await service.getTranslation('common', 'en-US' as any);
			expect(result).toEqual({ greeting: 'Hello' });
		});

		it('getTranslationByKey("common.greeting", "ru-RU") resolves to "ru" instead of throwing', async () => {
			const service = createTestService();
			await service.loadTranslation('common', 'ru-RU' as any);
			const greeting = service.getTranslationByKey('common.greeting', 'ru-RU' as any);
			expect(greeting).toBe('Привет');
		});
	});

	describe('preload uses allSettled (does not crash bootstrap)', () => {
		it('onModuleInit resolves even when a translation fails to load', async () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async (locale) => {
					if (locale === 'ru') throw new Error('missing ru file');
					return { greeting: 'Hello' };
				},
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});
			const store = storeFactory.type<TestTranslations>();
			const options = { store, defaultLocale: 'en', preload: true } as I18nModuleOptions;
			const service = new I18nService(store, options);
			const module = new I18nModule(service, options);

			const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

			await expect(module.onModuleInit()).resolves.toBeUndefined();
			// The successful locale was still preloaded.
			expect(store.translations.common.translations.en.namespace).toEqual({ greeting: 'Hello' });
			// The failure was reported, not thrown.
			expect(warnSpy).toHaveBeenCalled();

			warnSpy.mockRestore();
		});
	});

	describe('forRootAsync', () => {
		it('builds the store from the resolved options via a factory', async () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});
			const store = storeFactory.type<TestTranslations>();

			const dynamicModule = I18nModule.forRootAsync({
				useFactory: () => ({ store, defaultLocale: 'en' }) as I18nModuleOptions,
			});

			expect(dynamicModule.module).toBe(I18nModule);

			const optionsProvider = dynamicModule.providers?.find((p: any) => p.provide === I18N_OPTIONS) as any;
			const storeProvider = dynamicModule.providers?.find((p: any) => p.provide === I18N_STORE) as any;

			expect(typeof optionsProvider.useFactory).toBe('function');
			const resolvedOptions = await optionsProvider.useFactory();
			expect(resolvedOptions.store).toBe(store);
			// Defaults applied by normalizeOptions.
			expect(resolvedOptions.preload).toBe(false);
			expect(resolvedOptions.availableLocales).toEqual(['en', 'ru']);

			expect(storeProvider.inject).toEqual([I18N_OPTIONS]);
			expect(storeProvider.useFactory(resolvedOptions)).toBe(store);
		});
	});

	describe('interceptor does not clobber an upstream-set request locale', () => {
		const createExecutionContext = (request: any): ExecutionContext =>
			({
				getType: () => 'http',
				getArgs: () => [request, {}, () => undefined],
				switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
			}) as unknown as ExecutionContext;

		const createCapturingHandler = (capture: { requestLocale?: string }): CallHandler => ({
			handle: () =>
				defer(() => {
					capture.requestLocale = getRequestLocale();
					return of({});
				}),
		});

		it('keeps a locale a guard set before the interceptor ran', () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({ greeting: 'Hello' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});
			const store = storeFactory.type<TestTranslations>();
			const options: I18nModuleOptions = { store, availableLocales: ['en', 'ru'], defaultLocale: 'en' };
			const service = new I18nService(store, options);
			const interceptor = new I18nInterceptor(service, options);

			// Request carries 'en' (would be detected), but a guard already bound 'ru'.
			const ctx = createExecutionContext({ query: { locale: 'en' }, headers: {}, cookies: {}, params: {} });
			const capture: { requestLocale?: string } = {};

			i18nRequestStorage.run({ locale: 'ru' }, () => {
				interceptor.intercept(ctx, createCapturingHandler(capture)).subscribe();
			});

			expect(capture.requestLocale).toBe('ru');
		});
	});
});
