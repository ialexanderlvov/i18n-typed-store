import { describe, it, expect, vi } from 'vitest';
import { createTranslationModuleMap } from '../src/utils/create-translation-module-map';

describe('createTranslationModuleMap', () => {
	it('should create a map with all translation and locale combinations', async () => {
		const translations = {
			common: 'common',
			errors: 'errors',
		} as const;

		const locales = {
			en: 'en',
			ru: 'ru',
		} as const;

		const loadModule = vi.fn(async (locale: string, translation: string) => {
			return { locale, translation, data: `${locale}-${translation}` };
		});

		const moduleMap = createTranslationModuleMap(translations, locales, loadModule);

		// Check structure
		expect(moduleMap).toHaveProperty('common');
		expect(moduleMap).toHaveProperty('errors');
		expect(moduleMap.common).toHaveProperty('en');
		expect(moduleMap.common).toHaveProperty('ru');
		expect(moduleMap.errors).toHaveProperty('en');
		expect(moduleMap.errors).toHaveProperty('ru');

		// Check that loaders are functions
		expect(typeof moduleMap.common.en).toBe('function');
		expect(typeof moduleMap.common.ru).toBe('function');
		expect(typeof moduleMap.errors.en).toBe('function');
		expect(typeof moduleMap.errors.ru).toBe('function');
	});

	it('should call loadModule with correct parameters when loader is invoked', async () => {
		const translations = {
			common: 'common',
		} as const;

		const locales = {
			en: 'en',
		} as const;

		const loadModule = vi.fn(async (locale: string, translation: string) => {
			return { locale, translation };
		});

		const moduleMap = createTranslationModuleMap(translations, locales, loadModule);

		const result = await moduleMap.common.en();

		expect(loadModule).toHaveBeenCalledTimes(1);
		expect(loadModule).toHaveBeenCalledWith('en', 'common');
		expect(result).toEqual({ locale: 'en', translation: 'common' });
	});

	it('should handle multiple translations and locales', async () => {
		const translations = {
			common: 'common',
			errors: 'errors',
			ui: 'ui',
		} as const;

		const locales = {
			en: 'en',
			ru: 'ru',
			fr: 'fr',
		} as const;

		const loadModule = vi.fn(async (locale: string, translation: string) => {
			return `${locale}-${translation}`;
		});

		const moduleMap = createTranslationModuleMap(translations, locales, loadModule);

		// Verify all combinations exist
		expect(Object.keys(moduleMap)).toHaveLength(3);
		expect(Object.keys(moduleMap.common)).toHaveLength(3);
		expect(Object.keys(moduleMap.errors)).toHaveLength(3);
		expect(Object.keys(moduleMap.ui)).toHaveLength(3);

		// Test one combination
		const result = await moduleMap.errors.ru();
		expect(result).toBe('ru-errors');
	});

	it('should work with empty translations object', () => {
		const translations = {} as const;
		const locales = { en: 'en' } as const;
		const loadModule = vi.fn(async () => ({}));

		const moduleMap = createTranslationModuleMap(translations, locales, loadModule);

		expect(Object.keys(moduleMap)).toHaveLength(0);
	});

	it('should work with empty locales object', () => {
		const translations = { common: 'common' } as const;
		const locales = {} as const;
		const loadModule = vi.fn(async () => ({}));

		const moduleMap = createTranslationModuleMap(translations, locales, loadModule);

		expect(moduleMap.common).toEqual({});
	});

	it('should handle async loadModule errors', async () => {
		const translations = { common: 'common' } as const;
		const locales = { en: 'en' } as const;
		const loadModule = vi.fn(async () => {
			throw new Error('Load failed');
		});

		const moduleMap = createTranslationModuleMap(translations, locales, loadModule);

		await expect(moduleMap.common.en()).rejects.toThrow('Load failed');
	});
});
