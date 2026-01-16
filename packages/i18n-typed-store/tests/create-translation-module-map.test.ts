import { describe, it, expect, vi } from 'vitest';
import { createTranslationModuleMap } from '../src/lib/create-translation-module-map';

describe('createTranslationModuleMap', () => {
	describe('input validation', () => {
		it('should throw TypeError for empty namespaces object', () => {
			expect(() => {
				createTranslationModuleMap({}, { en: 'en' }, async () => ({}));
			}).toThrow(TypeError);

			expect(() => {
				createTranslationModuleMap(null as any, { en: 'en' }, async () => ({}));
			}).toThrow(TypeError);
		});

		it('should throw TypeError for empty locales object', () => {
			expect(() => {
				createTranslationModuleMap({ common: 'common' }, {}, async () => ({}));
			}).toThrow(TypeError);

			expect(() => {
				createTranslationModuleMap({ common: 'common' }, null as any, async () => ({}));
			}).toThrow(TypeError);
		});

		it('should throw TypeError if loadModule is not a function', () => {
			expect(() => {
				createTranslationModuleMap({ common: 'common' }, { en: 'en' }, null as any);
			}).toThrow(TypeError);

			expect(() => {
				createTranslationModuleMap({ common: 'common' }, { en: 'en' }, 'not a function' as any);
			}).toThrow(TypeError);
		});
	});

	describe('creating module map', () => {
		it('should create a map for one namespace and one locale', async () => {
			const namespaces = { common: 'common' } as const;
			const locales = { en: 'en' } as const;
			const loadModule = async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => {
				return { locale, namespace, data: 'test' };
			};

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			expect(moduleMap.common).toBeDefined();
			expect(moduleMap.common.en).toBeDefined();
			expect(typeof moduleMap.common.en).toBe('function');

			const module = await moduleMap.common.en();
			expect(module).toEqual({ locale: 'en', namespace: 'common', data: 'test' });
		});

		it('should create a map for multiple namespaces and one locale', async () => {
			const namespaces = { common: 'common', errors: 'errors' } as const;
			const locales = { en: 'en' } as const;
			const loadModule = vi.fn(async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => {
				return { locale, namespace };
			});

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			expect(moduleMap.common).toBeDefined();
			expect(moduleMap.errors).toBeDefined();
			expect(moduleMap.common.en).toBeDefined();
			expect(moduleMap.errors.en).toBeDefined();

			await moduleMap.common.en();
			expect(loadModule).toHaveBeenCalledWith('en', 'common');

			await moduleMap.errors.en();
			expect(loadModule).toHaveBeenCalledWith('en', 'errors');
		});

		it('should create a map for one namespace and multiple locales', async () => {
			const namespaces = { common: 'common' } as const;
			const locales = { en: 'en', ru: 'ru' } as const;
			const loadModule = vi.fn(async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => {
				return { locale, namespace };
			});

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			expect(moduleMap.common.en).toBeDefined();
			expect(moduleMap.common.ru).toBeDefined();

			await moduleMap.common.en();
			expect(loadModule).toHaveBeenCalledWith('en', 'common');

			await moduleMap.common.ru();
			expect(loadModule).toHaveBeenCalledWith('ru', 'common');
		});

		it('should create a map for multiple namespaces and multiple locales', async () => {
			const namespaces = { common: 'common', errors: 'errors' } as const;
			const locales = { en: 'en', ru: 'ru' } as const;
			const loadModule = vi.fn(async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => {
				return { locale, namespace, data: `${locale}-${namespace}` };
			});

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			// Check that all combinations are created
			expect(moduleMap.common.en).toBeDefined();
			expect(moduleMap.common.ru).toBeDefined();
			expect(moduleMap.errors.en).toBeDefined();
			expect(moduleMap.errors.ru).toBeDefined();

			// Check that each loader returns correct data
			const commonEn = await moduleMap.common.en();
			expect(commonEn).toEqual({ locale: 'en', namespace: 'common', data: 'en-common' });

			const commonRu = await moduleMap.common.ru();
			expect(commonRu).toEqual({ locale: 'ru', namespace: 'common', data: 'ru-common' });

			const errorsEn = await moduleMap.errors.en();
			expect(errorsEn).toEqual({ locale: 'en', namespace: 'errors', data: 'en-errors' });

			const errorsRu = await moduleMap.errors.ru();
			expect(errorsRu).toEqual({ locale: 'ru', namespace: 'errors', data: 'ru-errors' });
		});
	});

	describe('loader behavior', () => {
		it('should call loadModule with correct parameters on each call', async () => {
			const namespaces = { common: 'common' } as const;
			const locales = { en: 'en' } as const;
			const loadModule = vi.fn(async () => ({ data: 'test' }));

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			await moduleMap.common.en();
			await moduleMap.common.en();
			await moduleMap.common.en();

			expect(loadModule).toHaveBeenCalledTimes(3);
			expect(loadModule).toHaveBeenCalledWith('en', 'common');
		});

		it('should handle asynchronous loaders', async () => {
			const namespaces = { common: 'common' } as const;
			const locales = { en: 'en' } as const;
			const loadModule = async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return { data: 'async data' };
			};

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			const result = await moduleMap.common.en();
			expect(result).toEqual({ data: 'async data' });
		});

		it('should propagate errors from loadModule', async () => {
			const namespaces = { common: 'common' } as const;
			const locales = { en: 'en' } as const;
			const error = new Error('Failed to load module');
			const loadModule = async () => {
				throw error;
			};

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			await expect(moduleMap.common.en()).rejects.toThrow('Failed to load module');
		});
	});

	describe('immutability', () => {
		it('should create a new function for each loader', () => {
			const namespaces = { common: 'common' } as const;
			const locales = { en: 'en', ru: 'ru' } as const;
			const loadModule = async () => ({});

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			expect(moduleMap.common.en).not.toBe(moduleMap.common.ru);
		});
	});

	describe('complex scenarios', () => {
		it('should work with many namespaces and locales', async () => {
			const namespaces = {
				common: 'common',
				errors: 'errors',
				products: 'products',
				cart: 'cart',
			} as const;
			const locales = { en: 'en', ru: 'ru', de: 'de', fr: 'fr' } as const;
			const loadModule = async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => {
				return { locale, namespace };
			};

			const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);

			// Check all combinations
			for (const namespace of Object.keys(namespaces)) {
				for (const locale of Object.keys(locales)) {
					const loader = moduleMap[namespace as keyof typeof namespaces][locale as keyof typeof locales];
					expect(loader).toBeDefined();
					expect(typeof loader).toBe('function');

					const module = await loader();
					expect(module).toEqual({ locale, namespace });
				}
			}
		});
	});
});
