import { describe, it, expect } from 'vitest';
import { createTranslationModuleMap, createTranslationStore, createPluralSelector } from '../src/index';

describe('Library exports', () => {
	it('should export createTranslationModuleMap', () => {
		expect(typeof createTranslationModuleMap).toBe('function');
	});

	it('should export createTranslationStore', () => {
		expect(typeof createTranslationStore).toBe('function');
	});

	it('should export createPluralSelector', () => {
		expect(typeof createPluralSelector).toBe('function');
	});

	it('should work with exported functions', async () => {
		const translations = { common: 'common' } as const;
		const locales = { en: 'en' } as const;
		const loadModule = async () => ({ data: 'test' });
		const extractTranslation = (module: any) => module.data;

		const moduleMap = createTranslationModuleMap(translations, locales, loadModule);
		expect(moduleMap).toHaveProperty('common');
		expect(moduleMap.common).toHaveProperty('en');

		const storeFactory = createTranslationStore(translations, locales, loadModule, extractTranslation);
		const store = storeFactory.type<{ common: {} }>();
		expect(store).toHaveProperty('common');
		expect(typeof store.common.load).toBe('function');

		const selectPlural = createPluralSelector('en');
		expect(typeof selectPlural).toBe('function');
		expect(selectPlural(1, { one: 'item', other: 'items' })).toBe('item');
	});
});
