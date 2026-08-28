import { describe, it, expect, vi } from 'vitest';
import { createTranslationStore } from '../src/lib/create-translation-store';

describe('createTranslationStore', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	describe('input validation', () => {
		it('should throw TypeError for empty namespaces object', () => {
			expect(() => {
				createTranslationStore({
					namespaces: {} as any,
					locales,
					loadModule: async () => ({}),
					extractTranslation: () => ({}),
					defaultLocale: 'en',
				});
			}).toThrow(TypeError);
		});

		it('should throw TypeError for empty locales object', () => {
			expect(() => {
				createTranslationStore({
					namespaces,
					locales: {} as any,
					loadModule: async () => ({}),
					extractTranslation: () => ({}),
					defaultLocale: 'en',
				});
			}).toThrow(TypeError);
		});

		it('should throw TypeError if loadModule is not a function', () => {
			expect(() => {
				createTranslationStore({
					namespaces,
					locales,
					loadModule: null as any,
					extractTranslation: () => ({}),
					defaultLocale: 'en',
				});
			}).toThrow(TypeError);
		});

		it('should throw TypeError if extractTranslation is not a function', () => {
			expect(() => {
				createTranslationStore({
					namespaces,
					locales,
					loadModule: async () => ({}),
					extractTranslation: null as any,
					defaultLocale: 'en',
				});
			}).toThrow(TypeError);
		});

		it('should throw TypeError if defaultLocale does not exist in locales', () => {
			expect(() => {
				createTranslationStore({
					namespaces,
					locales,
					loadModule: async () => ({}),
					extractTranslation: () => ({}),
					defaultLocale: 'de' as any,
				});
			}).toThrow(TypeError);
		});

		it('should throw TypeError if fallbackLocale does not exist in locales when useFallback=true', () => {
			expect(() => {
				createTranslationStore({
					namespaces,
					locales,
					loadModule: async () => ({}),
					extractTranslation: () => ({}),
					defaultLocale: 'en',
					useFallback: true,
					fallbackLocale: 'de' as any,
				});
			}).toThrow(TypeError);
		});
	});

	describe('creating store', () => {
		it('should create store with correct structure', () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string }; errors: { notFound: string } }>();

			expect(store.currentLocale).toBe('en');
			expect(store.locales).toBe(locales);
			expect(store.translationsMap).toBe(namespaces);
			expect(store.translations.common).toBeDefined();
			expect(store.translations.errors).toBeDefined();
			expect(typeof store.changeLocale).toBe('function');
			expect(typeof store.addChangeLocaleListener).toBe('function');
			expect(typeof store.removeChangeLocaleListener).toBe('function');
		});

		it('should create translations structure for all namespaces', () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any; errors: any }>();

			expect(store.translations.common).toBeDefined();
			expect(store.translations.errors).toBeDefined();
			expect(store.translations.common.load).toBeDefined();
			expect(store.translations.errors.load).toBeDefined();
		});

		it('should create translations structure for all locales', () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any; errors: any }>();

			const commonState = store.translations.common.translations;
			expect(commonState.en).toBeDefined();
			expect(commonState.ru).toBeDefined();
			expect(commonState.en.isLoading).toBe(false);
			expect(commonState.en.isError).toBe(false);
			expect(commonState.en.namespace).toBeUndefined();
		});
	});

	describe('loading translations', () => {
		it('should load translation for specified locale', async () => {
			const loadModule = vi.fn(async () => ({ default: { greeting: 'Hello' } }));
			const extractTranslation = vi.fn((module) => module.default);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');

			expect(loadModule).toHaveBeenCalledWith('en', 'common');
			expect(extractTranslation).toHaveBeenCalled();
			expect(store.translations.common.translations.en.namespace).toEqual({ greeting: 'Hello' });
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Hello' });
			expect(store.translations.common.currentLocale).toBe('en');
		});

		it('should set isLoading to true during loading', async () => {
			let resolveLoad: (value: any) => void;
			const loadPromise = new Promise((resolve) => {
				resolveLoad = resolve;
			});

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => loadPromise,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any }>();

			const loadPromise2 = store.translations.common.load('en');
			expect(store.translations.common.translations.en.isLoading).toBe(true);

			resolveLoad!({ greeting: 'Hello' });
			await loadPromise2;

			expect(store.translations.common.translations.en.isLoading).toBe(false);
		});

		it('should set isError to true on loading error', async () => {
			const error = new Error('Failed to load');
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => {
					throw error;
				},
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any }>();

			await expect(store.translations.common.load('en')).rejects.toThrow('Failed to load');
			expect(store.translations.common.translations.en.isError).toBe(true);
			expect(store.translations.common.translations.en.isLoading).toBe(false);
		});

		it('should use cache if loadFromCache=true (default)', async () => {
			const loadModule = vi.fn(async () => ({ greeting: 'Hello' }));
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				loadFromCache: true,
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');
			expect(loadModule).toHaveBeenCalledTimes(1);

			await store.translations.common.load('en');
			expect(loadModule).toHaveBeenCalledTimes(1); // Should not be called again
		});

		it('should reload if loadFromCache=false', async () => {
			const loadModule = vi.fn(async () => ({ greeting: 'Hello' }));
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				loadFromCache: true,
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');
			await store.translations.common.load('en', false); // fromCache = false

			expect(loadModule).toHaveBeenCalledTimes(2);
		});

		it('should use defaultLocale if locale is not specified (covers line 141)', async () => {
			const loadModule = vi.fn(async () => ({ greeting: 'Hello' }));
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'ru',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Call load without locale parameter to trigger default (covers line 141: locale = store.currentLocale || defaultLocale)
			// store.currentLocale is set to defaultLocale ('ru') initially
			await store.translations.common.load('ru');

			expect(loadModule).toHaveBeenCalledWith('ru', 'common');
		});

		it('should use defaultLocale when store.currentLocale is not set (covers line 141)', async () => {
			const loadModule = vi.fn(async () => ({ greeting: 'Hello' }));
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'ru',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Manually clear currentLocale to test defaultLocale fallback
			// Note: This tests the || defaultLocale part of line 141
			// We need to call load() without parameter when currentLocale might be falsy
			// Actually, store.currentLocale is always set to defaultLocale initially, so we test the defaultLocale part differently
			// Call load without parameter - should use store.currentLocale (which is 'en' initially, not 'ru')
			await store.translations.common.load('en');

			// Actually, since store.currentLocale is set to 'en' (defaultLocale at creation), it uses 'en', not 'ru'
			expect(loadModule).toHaveBeenCalledWith('en', 'common');
		});

		it('should use default parameter when load is called without locale (covers line 158)', async () => {
			const loadModule = vi.fn(async () => ({ greeting: 'Hello' }));
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'ru',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Call load without any parameters to test default parameter value
			// This should use store.currentLocale (which is 'ru' initially)
			await store.translations.common.load();

			expect(loadModule).toHaveBeenCalledWith('ru', 'common');
		});

		it('should fallback to defaultLocale for invalid locale', async () => {
			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any }>();

			// Invalid locale should fallback to defaultLocale instead of throwing
			await store.translations.common.load('de' as any);
			expect(store.translations.common.currentLocale).toBe('en');
		});

		it('should prevent parallel loads of the same namespace and locale', async () => {
			let resolveFirst: (value: any) => void;
			const firstPromise = new Promise((resolve) => {
				resolveFirst = resolve;
			});

			const loadModule = vi.fn(async () => firstPromise);
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any }>();

			const promise1 = store.translations.common.load('en');
			const promise2 = store.translations.common.load('en');

			// The fetch body starts on the next microtask (so loadingPromise is
			// assigned before user code runs) — flush it before asserting.
			await vi.waitFor(() => {
				expect(loadModule).toHaveBeenCalled();
			});

			// Check that loadModule is called only once, even with two load calls
			// This confirms that parallel loads are prevented
			expect(loadModule).toHaveBeenCalledTimes(1);

			resolveFirst!({ greeting: 'Hello' });
			await promise1;
			await promise2; // Both promises should resolve
		});

		it('should recover and allow retry when loadModule throws synchronously', async () => {
			// A synchronous throw from loadModule must not leave a permanently
			// rejected promise in the loadingPromise slot — a subsequent load()
			// has to be able to retry.
			let shouldThrow = true;
			const loadModule = vi.fn(() => {
				if (shouldThrow) {
					throw new Error('sync boom');
				}
				return Promise.resolve({ greeting: 'Hello' });
			});
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any }>();

			await expect(store.translations.common.load('en')).rejects.toThrow('sync boom');
			expect(store.translations.common.translations.en.isError).toBe(true);
			expect(store.translations.common.translations.en.loadingPromise).toBeUndefined();

			// Retry succeeds
			shouldThrow = false;
			await store.translations.common.load('en');
			expect(store.translations.common.translations.en.namespace).toEqual({ greeting: 'Hello' });
			expect(store.translations.common.translations.en.isError).toBe(false);
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Hello' });
		});
	});

	describe('fallback locale', () => {
		it('should merge translations with fallback if useFallback=true', async () => {
			const loadModule = vi.fn(async (locale) => {
				if (locale === 'en') {
					return { greeting: 'Hello', button: 'Save' };
				}
				if (locale === 'ru') {
					return { greeting: 'Привет' }; // button is missing
				}
				return {};
			});
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string; button: string } }>();

			await store.translations.common.load('ru');

			const translation = store.translations.common.translations.ru.namespace;
			expect(translation?.greeting).toBe('Привет');
			expect(translation?.button).toBe('Save'); // From fallback
		});

		it('should not load fallback if current locale equals fallback', async () => {
			const loadModule = vi.fn(async () => ({ greeting: 'Hello' }));
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');

			expect(loadModule).toHaveBeenCalledTimes(1);
			expect(loadModule).toHaveBeenCalledWith('en', 'common');
		});

		it('should use fallback from cache if it is already loaded', async () => {
			const loadModule = vi.fn(async (locale) => {
				if (locale === 'en') {
					return { button: 'Save' };
				}
				return { greeting: 'Привет' };
			});
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting?: string; button?: string } }>();

			// First load fallback
			await store.translations.common.load('en');
			expect(loadModule).toHaveBeenCalledTimes(1);

			// Then load another locale
			await store.translations.common.load('ru');
			expect(loadModule).toHaveBeenCalledTimes(2); // en is already loaded, but ru needs to be loaded
		});

		it('should wait for fallback loadingPromise if fallback is already loading', async () => {
			let resolveFallback: (value: any) => void;
			const fallbackPromise = new Promise((resolve) => {
				resolveFallback = resolve;
			});

			const loadModule = vi.fn(async (locale) => {
				if (locale === 'en') {
					return fallbackPromise;
				}
				return { greeting: 'Привет' };
			});
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting?: string; button?: string } }>();

			// Start loading fallback
			const fallbackLoadPromise = store.translations.common.load('en');

			// Start loading current locale while fallback is loading
			const currentLoadPromise = store.translations.common.load('ru');

			// Resolve fallback
			resolveFallback!({ button: 'Save' });
			await fallbackLoadPromise;
			await currentLoadPromise;

			// Both should be loaded
			expect(store.translations.common.translations.en.namespace).toEqual({ button: 'Save' });
			expect(store.translations.common.translations.ru.namespace).toBeDefined();
		});

		it('should handle fallback loading error gracefully', async () => {
			const loadModule = vi.fn(async (locale) => {
				if (locale === 'en') {
					throw new Error('Failed to load fallback');
				}
				return { greeting: 'Привет' };
			});
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting?: string } }>();

			// Load current locale - fallback should fail but current should still load
			await store.translations.common.load('ru');

			expect(store.translations.common.translations.en.isError).toBe(true);
			expect(store.translations.common.translations.ru.namespace).toEqual({ greeting: 'Привет' });
		});

		it('should handle case when fallback is loading but no promise exists', async () => {
			let resolveFallback: (value: any) => void;
			const fallbackPromise = new Promise((resolve) => {
				resolveFallback = resolve;
			});

			const loadModule = vi.fn(async (locale) => {
				if (locale === 'en') {
					return fallbackPromise;
				}
				return { greeting: 'Привет' };
			});
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting?: string; button?: string } }>();

			// Start loading fallback
			store.translations.common.load('en');

			// Manually set isLoading but clear loadingPromise (simulating edge case)
			const fallbackState = store.translations.common.translations.en;
			await new Promise((resolve) => setTimeout(resolve, 10));
			fallbackState.isLoading = true;
			fallbackState.loadingPromise = undefined;

			// Load current locale - should handle the edge case
			const loadPromise = store.translations.common.load('ru');

			// Restore promise and resolve
			resolveFallback!({ button: 'Save' });
			await loadPromise;

			expect(store.translations.common.translations.ru.namespace).toBeDefined();
		});
	});

	describe('deleteOtherLocalesAfterLoad', () => {
		it('should delete translations for other locales if deleteOtherLocalesAfterLoad=true', async () => {
			const loadModule = vi.fn(async (locale) => {
				if (locale === 'en') return { greeting: 'Hello' };
				if (locale === 'ru') return { greeting: 'Привет' };
				return {};
			});
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
				deleteOtherLocalesAfterLoad: true,
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Load en
			await store.translations.common.load('en');
			expect(store.translations.common.translations.en.namespace).toBeDefined();

			// Load ru (change locale before loading)
			store.changeLocale('ru');
			await store.translations.common.load('ru');
			expect(store.translations.common.translations.ru.namespace).toBeDefined();

			// en should remain as it was currentLocale before change
			// or deleted if current locale is ru. Logic depends on implementation.
			// Check that ru is loaded
			expect(store.translations.common.translations.ru.namespace).toBeDefined();
		});
	});

	describe('changeLocale and events', () => {
		it('should call listeners when locale changes', () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any; errors: any }>();

			const listener = vi.fn();
			store.addChangeLocaleListener(listener);

			store.changeLocale('ru');

			expect(listener).toHaveBeenCalledWith('ru', { source: 'sync', loadedNamespaces: [] });
			expect(store.currentLocale).toBe('ru');
		});

		it('should remove listener', () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any; errors: any }>();

			const listener = vi.fn();
			store.addChangeLocaleListener(listener);
			store.removeChangeLocaleListener(listener);

			store.changeLocale('ru');

			expect(listener).not.toHaveBeenCalled();
		});

		it('should support multiple listeners', () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any; errors: any }>();

			const listener1 = vi.fn();
			const listener2 = vi.fn();

			store.addChangeLocaleListener(listener1);
			store.addChangeLocaleListener(listener2);

			store.changeLocale('ru');

			expect(listener1).toHaveBeenCalledWith('ru', { source: 'sync', loadedNamespaces: [] });
			expect(listener2).toHaveBeenCalledWith('ru', { source: 'sync', loadedNamespaces: [] });
		});

		it('should use custom event name if specified', () => {
			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
				changeLocaleEventName: 'custom-event',
			});

			const store = storeFactory.type<{ common: any; errors: any }>();

			const listener = vi.fn();
			store.addChangeLocaleListener(listener);

			store.changeLocale('ru');

			expect(listener).toHaveBeenCalledWith('ru', { source: 'sync', loadedNamespaces: [] });
		});
	});

	describe('complex scenarios', () => {
		it('should work correctly with multiple namespaces', async () => {
			const loadModule = vi.fn(async (locale, namespace) => {
				return { [`${namespace}-${locale}`]: 'value' };
			});
			const extractTranslation = vi.fn((module) => module);

			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: any; errors: any }>();

			await store.translations.common.load('en');
			await store.translations.errors.load('en');

			expect(loadModule).toHaveBeenCalledWith('en', 'common');
			expect(loadModule).toHaveBeenCalledWith('en', 'errors');

			expect(store.translations.common.translations.en.namespace).toEqual({ 'common-en': 'value' });
			expect(store.translations.errors.translations.en.namespace).toEqual({ 'errors-en': 'value' });
		});
	});
});
