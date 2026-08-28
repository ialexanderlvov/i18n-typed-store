import { describe, it, expect } from 'vitest';
import { createTranslationStore } from '../src/lib/create-translation-store';

describe('BCP 47 locale support', () => {
	const namespaces = { common: 'common' } as const;

	describe('changeLocale with BCP 47 locales', () => {
		it('should accept BCP 47 locale and find best match', () => {
			const locales = {
				en: 'en',
				ru: 'ru',
				'ru-RU': 'ru-RU',
				'en-US': 'en-US',
			} as const;

			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Test exact match
			store.changeLocale('ru-RU');
			expect(store.currentLocale).toBe('ru-RU');

			// Test fallback to language when region is not available
			store.changeLocale('ru-BY');
			expect(store.currentLocale).toBe('ru');

			// Test fallback to language when exact locale is not available
			store.changeLocale('en-GB');
			expect(store.currentLocale).toBe('en');

			// Test fallback to defaultLocale when no match found
			store.changeLocale('fr-FR');
			expect(store.currentLocale).toBe('en');
		});

		it('should handle script-based locales', () => {
			const locales = {
				zh: 'zh',
				'zh-Hans': 'zh-Hans',
				'zh-Hans-CN': 'zh-Hans-CN',
			} as const;

			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'zh',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Test exact match with script and region
			store.changeLocale('zh-Hans-CN');
			expect(store.currentLocale).toBe('zh-Hans-CN');

			// Test fallback to script when region is not available
			store.changeLocale('zh-Hans-TW');
			expect(store.currentLocale).toBe('zh-Hans');

			// Test fallback to language when script is not available
			store.changeLocale('zh-Hant-TW');
			expect(store.currentLocale).toBe('zh');
		});

		it('should still accept valid locale keys', () => {
			const locales = {
				en: 'en',
				ru: 'ru',
			} as const;

			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			store.changeLocale('ru');
			expect(store.currentLocale).toBe('ru');
		});
	});

	describe('load with BCP 47 locales', () => {
		it('should accept BCP 47 locale and find best match', async () => {
			const locales = {
				en: 'en',
				ru: 'ru',
				'ru-RU': 'ru-RU',
				'en-US': 'en-US',
			} as const;

			const loadModule = async (locale: keyof typeof locales) => {
				if (locale === 'ru-RU') return { greeting: 'Привет из России' };
				if (locale === 'ru') return { greeting: 'Привет' };
				if (locale === 'en-US') return { greeting: 'Hello from USA' };
				return { greeting: 'Hello' };
			};

			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Test exact match
			store.changeLocale('ru-RU');
			await store.translations.common.load('ru-RU');
			expect(store.translations.common.currentLocale).toBe('ru-RU');
			expect(store.translations.common.currentTranslation?.greeting).toBe('Привет из России');

			// Test fallback to language when region is not available
			store.changeLocale('ru-BY');
			await store.translations.common.load('ru-BY');
			expect(store.translations.common.currentLocale).toBe('ru');
			expect(store.translations.common.currentTranslation?.greeting).toBe('Привет');

			// Test fallback to language when exact locale is not available
			store.changeLocale('en-GB');
			await store.translations.common.load('en-GB');
			expect(store.translations.common.currentLocale).toBe('en');
			expect(store.translations.common.currentTranslation?.greeting).toBe('Hello');
		});

		it('should handle script-based locales in load', async () => {
			const locales = {
				zh: 'zh',
				'zh-Hans': 'zh-Hans',
				'zh-Hans-CN': 'zh-Hans-CN',
			} as const;

			const loadModule = async (locale: keyof typeof locales) => {
				if (locale === 'zh-Hans-CN') return { greeting: '你好（简体，中国）' };
				if (locale === 'zh-Hans') return { greeting: '你好（简体）' };
				return { greeting: '你好' };
			};

			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'zh',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			// Test exact match with script and region
			store.changeLocale('zh-Hans-CN');
			await store.translations.common.load('zh-Hans-CN');
			expect(store.translations.common.currentLocale).toBe('zh-Hans-CN');
			expect(store.translations.common.currentTranslation?.greeting).toBe('你好（简体，中国）');

			// Test fallback to script when region is not available
			store.changeLocale('zh-Hans-TW');
			await store.translations.common.load('zh-Hans-TW');
			expect(store.translations.common.currentLocale).toBe('zh-Hans');
			expect(store.translations.common.currentTranslation?.greeting).toBe('你好（简体）');
		});

		it('should still accept valid locale keys in load', async () => {
			const locales = {
				en: 'en',
				ru: 'ru',
			} as const;

			const loadModule = async (locale: keyof typeof locales) => {
				if (locale === 'ru') return { greeting: 'Привет' };
				return { greeting: 'Hello' };
			};

			const storeFactory = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			store.changeLocale('ru');
			await store.translations.common.load('ru');
			expect(store.translations.common.currentLocale).toBe('ru');
			expect(store.translations.common.currentTranslation?.greeting).toBe('Привет');
		});
	});
});
