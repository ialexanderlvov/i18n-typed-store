import { describe, it, expect, vi } from 'vitest';
import { createTranslationStore } from '../src/utils/create-translation-store';

describe('createTranslationStore', () => {
	it('should create a store with type method', () => {
		const translations = { common: 'common' } as const;
		const locales = { en: 'en' } as const;
		const loadModule = vi.fn(async () => ({}));
		const extractTranslation = vi.fn((module) => module);

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);

		expect(storeFactory).toHaveProperty('type');
		expect(typeof storeFactory.type).toBe('function');
	});

	it('should create store with correct structure', () => {
		const translations = {
			common: 'common',
			errors: 'errors',
		} as const;

		const locales = {
			en: 'en',
			ru: 'ru',
		} as const;

		const loadModule = vi.fn(async () => ({ data: 'test' }));
		const extractTranslation = vi.fn((module) => module);

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
		const store = storeFactory.type<{
			common: { data: string };
			errors: { data: string };
		}>();

		expect(store).toHaveProperty('common');
		expect(store).toHaveProperty('errors');
		expect(store.common).toHaveProperty('translation');
		expect(store.common).toHaveProperty('load');
		expect(store.errors).toHaveProperty('translation');
		expect(store.errors).toHaveProperty('load');
		expect(typeof store.common.load).toBe('function');
		expect(typeof store.errors.load).toBe('function');
	});

	it('should load translation for specific locale', async () => {
		const translations = { common: 'common' } as const;
		const locales = { en: 'en', ru: 'ru' } as const;

		const mockModule = { locale: 'en', data: 'Hello' };
		const loadModule = vi.fn(async (locale: string) => {
			return { locale, data: locale === 'en' ? 'Hello' : 'Привет' };
		});
		const extractTranslation = vi.fn((module) => module.data);

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
		const store = storeFactory.type<{
			common: {};
		}>();

		await store.common.load('en');

		expect(loadModule).toHaveBeenCalledWith('en', 'common');
		expect(extractTranslation).toHaveBeenCalled();
		expect(store.common.translation).toBe('Hello');
	});

	it('should update translation after load', async () => {
		const translations = { common: 'common' } as const;
		const locales = { en: 'en', ru: 'ru' } as const;

		const loadModule = vi.fn(async (locale: string) => {
			return { locale, text: locale === 'en' ? 'Hello' : 'Привет' };
		});
		const extractTranslation = vi.fn((module) => module.text);

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
		const store = storeFactory.type<{
			common: {};
		}>();

		expect(store.common.translation).toEqual(undefined);

		await store.common.load('en');
		expect(store.common.translation).toBe('Hello');

		await store.common.load('ru');
		expect(store.common.translation).toBe('Привет');
	});

	it('should handle multiple translations independently', async () => {
		const translations = {
			common: 'common',
			errors: 'errors',
		} as const;

		const locales = { en: 'en' } as const;

		const loadModule = vi.fn(async (locale: string, translation: string) => {
			return {
				locale,
				translation,
				data: `${translation}-${locale}`,
			};
		});
		const extractTranslation = vi.fn((module) => module.data);

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
		const store = storeFactory.type<{
			common: {};
			errors: {};
		}>();

		await store.common.load('en');
		await store.errors.load('en');

		expect(store.common.translation).toBe('common-en');
		expect(store.errors.translation).toBe('errors-en');
		expect(loadModule).toHaveBeenCalledTimes(2);
	});

	it('should handle load errors', async () => {
		const translations = { common: 'common' } as const;
		const locales = { en: 'en' } as const;

		const loadModule = vi.fn(async () => {
			throw new Error('Failed to load');
		});
		const extractTranslation = vi.fn((module) => module);

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
		const store = storeFactory.type<{
			common: string;
		}>();

		await expect(store.common.load('en')).rejects.toThrow('Failed to load');
	});

	it('should use extractTranslation to transform module', async () => {
		const translations = { common: 'common' } as const;
		const locales = { en: 'en' } as const;

		const mockModule = {
			default: {
				greeting: 'Hello',
				goodbye: 'Goodbye',
			},
		};

		const loadModule = vi.fn(async () => mockModule);
		const extractTranslation = vi.fn((module) => module.default);

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
		const store = storeFactory.type<{
			common: { greeting: string; goodbye: string };
		}>();

		await store.common.load('en');

		expect(extractTranslation).toHaveBeenCalledWith(mockModule, 'en', 'common');
		expect(store.common.translation).toEqual({
			greeting: 'Hello',
			goodbye: 'Goodbye',
		});
	});

	it('should handle complex translation objects', async () => {
		const translations = { ui: 'ui' } as const;
		const locales = { en: 'en' } as const;

		const loadModule = vi.fn(async () => ({
			buttons: { save: 'Save', cancel: 'Cancel' },
			messages: { success: 'Success!', error: 'Error!' },
		}));
		const extractTranslation = vi.fn((module) => module);

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
		const store = storeFactory.type<{
			ui: {
				buttons: { save: string; cancel: string };
				messages: { success: string; error: string };
			};
		}>();

		await store.ui.load('en');

		expect(store.ui.translation).toEqual({
			buttons: { save: 'Save', cancel: 'Cancel' },
			messages: { success: 'Success!', error: 'Error!' },
		});
	});
});
