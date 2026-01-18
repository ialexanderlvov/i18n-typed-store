import { createTranslationStore } from 'i18n-typed-store';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nModuleOptions, I18nModule, I18N_STORE, I18N_OPTIONS, I18N_SERVICE, I18nService } from '../src';

describe('I18nModule', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	const createTestStore = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => {
				if (locale === 'en') {
					if (namespace === 'common') return { greeting: 'Hello' };
					if (namespace === 'errors') return { notFound: 'Not Found' };
				}
				if (locale === 'ru') {
					if (namespace === 'common') return { greeting: 'Привет' };
					if (namespace === 'errors') return { notFound: 'Не найдено' };
				}
				return {};
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		});

		return storeFactory.type<{ common: { greeting: string }; errors: { notFound: string } }>();
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('forRoot', () => {
		it('should create dynamic module with providers', () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
			};

			const module = I18nModule.forRoot(options);

			expect(module.module).toBe(I18nModule);
			expect(module.providers).toBeDefined();
			expect(module.providers?.length).toBeGreaterThan(0);
			expect(module.exports).toBeDefined();
		});

		it('should provide I18N_STORE token', () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
			};

			const module = I18nModule.forRoot(options);
			const storeProvider = module.providers?.find((p: any) => p.provide === I18N_STORE);

			expect(storeProvider).toBeDefined();
			expect(storeProvider?.useValue).toBe(store);
		});

		it('should provide I18N_OPTIONS token', () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				availableLocales: ['en', 'ru'],
			};

			const module = I18nModule.forRoot(options);
			const optionsProvider = module.providers?.find((p: any) => p.provide === I18N_OPTIONS);

			expect(optionsProvider).toBeDefined();
			expect(optionsProvider?.useValue).toBeDefined();
			expect(optionsProvider?.useValue.defaultLocale).toBe('en');
			expect(optionsProvider?.useValue.availableLocales).toEqual(['en', 'ru']);
		});

		it('should provide I18N_SERVICE token', () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
			};

			const module = I18nModule.forRoot(options);
			const serviceProvider = module.providers?.find((p: any) => p.provide === I18N_SERVICE);

			expect(serviceProvider).toBeDefined();
			expect(serviceProvider?.useClass).toBe(I18nService);
		});

		it('should export I18nService and tokens', () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
			};

			const module = I18nModule.forRoot(options);

			expect(module.exports).toContain(I18nService);
			expect(module.exports).toContain(I18N_SERVICE);
			expect(module.exports).toContain(I18N_STORE);
			expect(module.exports).toContain(I18N_OPTIONS);
		});

		it('should set default preload to true', () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
			};

			const module = I18nModule.forRoot(options);
			const optionsProvider = module.providers?.find((p: any) => p.provide === I18N_OPTIONS);

			expect(optionsProvider?.useValue.preload).toBe(true);
		});

		it('should set availableLocales from store if not provided', () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
			};

			const module = I18nModule.forRoot(options);
			const optionsProvider = module.providers?.find((p: any) => p.provide === I18N_OPTIONS);

			expect(optionsProvider?.useValue.availableLocales).toEqual(['en', 'ru']);
		});
	});

	describe('onModuleInit', () => {
		it('should set default locale on initialization', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'ru',
			};

			const module = I18nModule.forRoot(options);
			const i18nModule = new I18nModule(new I18nService(store, options), options);

			await i18nModule.onModuleInit();

			expect(i18nModule['i18nService'].getLocale()).toBe('ru');
		});

		it('should preload all translations when preload is true', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				preload: true,
			};

			const service = new I18nService(store, options);
			const loadSpy = vi.spyOn(service, 'loadTranslation');

			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			// Should load all combinations: 2 namespaces * 2 locales = 4 calls
			expect(loadSpy).toHaveBeenCalledTimes(4);
			expect(loadSpy).toHaveBeenCalledWith('common', 'en', true);
			expect(loadSpy).toHaveBeenCalledWith('common', 'ru', true);
			expect(loadSpy).toHaveBeenCalledWith('errors', 'en', true);
			expect(loadSpy).toHaveBeenCalledWith('errors', 'ru', true);
		});

		it('should preload specific namespaces and locales', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				preload: {
					namespaces: ['common'],
					locales: ['en'],
				},
			};

			const service = new I18nService(store, options);
			const loadSpy = vi.spyOn(service, 'loadTranslation');

			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			expect(loadSpy).toHaveBeenCalledTimes(1);
			expect(loadSpy).toHaveBeenCalledWith('common', 'en', true);
		});

		it('should not preload when preload is false', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				preload: false,
			};

			const service = new I18nService(store, options);
			const loadSpy = vi.spyOn(service, 'loadTranslation');

			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			expect(loadSpy).not.toHaveBeenCalled();
		});

		it('should use fromCache option from preload config', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				preload: {
					namespaces: ['common'],
					locales: ['en'],
					fromCache: false,
				},
			};

			const service = new I18nService(store, options);
			const loadSpy = vi.spyOn(service, 'loadTranslation');

			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			expect(loadSpy).toHaveBeenCalledWith('common', 'en', false);
		});

		it('should not set default locale if not specified', async () => {
			const store = createTestStore();
			store.changeLocale('ru');
			const options: I18nModuleOptions = {
				store,
				preload: false,
			};

			const service = new I18nService(store, options);
			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			// Should remain as store's current locale
			expect(service.getLocale()).toBe('ru');
		});

		it('should use all namespaces when preload.namespaces is not specified', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				preload: {
					locales: ['en'],
					// namespaces not specified - should use all
				},
			};

			const service = new I18nService(store, options);
			const loadSpy = vi.spyOn(service, 'loadTranslation');

			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			// Should load both namespaces
			expect(loadSpy).toHaveBeenCalledWith('common', 'en', true);
			expect(loadSpy).toHaveBeenCalledWith('errors', 'en', true);
			expect(loadSpy).toHaveBeenCalledTimes(2);
		});

		it('should use all locales when preload.locales is not specified', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				preload: {
					namespaces: ['common'],
					// locales not specified - should use all
				},
			};

			const service = new I18nService(store, options);
			const loadSpy = vi.spyOn(service, 'loadTranslation');

			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			// Should load both locales
			expect(loadSpy).toHaveBeenCalledWith('common', 'en', true);
			expect(loadSpy).toHaveBeenCalledWith('common', 'ru', true);
			expect(loadSpy).toHaveBeenCalledTimes(2);
		});

		it('should set default locale when specified (covers line 93)', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'ru',
				preload: false,
			};

			const service = new I18nService(store, options);
			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			// This covers line 93: if (this.options.defaultLocale)
			expect(service.getLocale()).toBe('ru');
		});

		it('should use all namespaces when preload.namespaces is not specified (covers line 103)', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				preload: {
					locales: ['en'],
					// namespaces not specified - should use all
				},
			};

			const service = new I18nService(store, options);
			const loadSpy = vi.spyOn(service, 'loadTranslation');

			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			// This covers line 103: this.options.preload === true ? allNamespaces : (this.options.preload.namespaces ?? allNamespaces)
			expect(loadSpy).toHaveBeenCalledWith('common', 'en', true);
			expect(loadSpy).toHaveBeenCalledWith('errors', 'en', true);
			expect(loadSpy).toHaveBeenCalledTimes(2);
		});

		it('should use all locales when preload.locales is not specified (covers line 105)', async () => {
			const store = createTestStore();
			const options: I18nModuleOptions = {
				store,
				defaultLocale: 'en',
				preload: {
					namespaces: ['common'],
					// locales not specified - should use all
				},
			};

			const service = new I18nService(store, options);
			const loadSpy = vi.spyOn(service, 'loadTranslation');

			const i18nModule = new I18nModule(service, options);
			await i18nModule.onModuleInit();

			// This covers line 105: this.options.preload === true ? allLocales : (this.options.preload.locales ?? allLocales)
			expect(loadSpy).toHaveBeenCalledWith('common', 'en', true);
			expect(loadSpy).toHaveBeenCalledWith('common', 'ru', true);
			expect(loadSpy).toHaveBeenCalledTimes(2);
		});
	});
});
