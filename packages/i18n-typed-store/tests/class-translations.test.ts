import { describe, it, expect, expectTypeOf } from 'vitest';
import { createTranslationStore } from '../src/lib/create-translation-store';
import { getTranslation } from '../src/lib/get-translation';
import type { TranslationKeys, GetTranslationValue } from '../src/types/translation-keys';

/**
 * Regression tests: class- and interface-typed translations must keep
 * producing dot-path keys. A `Record<string, unknown>` traversability check
 * broke them (classes/interfaces have no implicit index signature), which
 * made `getTranslationByKey('common.greeting')`-style calls stop compiling.
 */

class CommonTranslationsEn {
	greeting = 'Hello';
	buttons = { save: 'Save', cancel: 'Cancel' };
	// Field initializer — an own property of the instance
	itemsArrow = (count: number) => `${count} items (arrow)`;
	// Prototype method — NOT an own property of the instance
	items(count: number) {
		return `${count} items`;
	}
}

interface ErrorsTranslations {
	notFound: string;
	nested: { deep: string };
}

type M = { common: CommonTranslationsEn; errors: ErrorsTranslations };

describe('class/interface-typed translation keys', () => {
	it('type-level: classes and interfaces produce nested dot-path keys', () => {
		expectTypeOf<'common.greeting'>().toExtend<TranslationKeys<M>>();
		expectTypeOf<'common.buttons.save'>().toExtend<TranslationKeys<M>>();
		expectTypeOf<'common.items'>().toExtend<TranslationKeys<M>>();
		expectTypeOf<'common.itemsArrow'>().toExtend<TranslationKeys<M>>();
		expectTypeOf<'errors.notFound'>().toExtend<TranslationKeys<M>>();
		expectTypeOf<'errors.nested.deep'>().toExtend<TranslationKeys<M>>();

		expectTypeOf<GetTranslationValue<M, 'common.greeting'>>().toEqualTypeOf<string>();
		expectTypeOf<GetTranslationValue<M, 'common.items'>>().toEqualTypeOf<(count: number) => string>();
		expectTypeOf<GetTranslationValue<M, 'errors.nested.deep'>>().toEqualTypeOf<string>();

		// Array/function members must still be excluded from traversal
		expectTypeOf<'common.items.length'>().not.toExtend<TranslationKeys<M>>();
		expectTypeOf<'common.greeting.length'>().not.toExtend<TranslationKeys<M>>();
	});

	const buildStore = async () => {
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales: { en: 'en' } as const,
			loadModule: async () => new CommonTranslationsEn(),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<{ common: CommonTranslationsEn }>();
		await store.translations.common.load('en');
		return store;
	};

	it('runtime: resolves instance fields and nested objects on class instances', async () => {
		const store = await buildStore();
		expect(getTranslation(store, 'common.greeting')).toBe('Hello');
		expect(getTranslation(store, 'common.buttons.save')).toBe('Save');
		const arrow = getTranslation(store, 'common.itemsArrow');
		expect(typeof arrow).toBe('function');
	});

	it('runtime: resolves methods declared on the class prototype', async () => {
		const store = await buildStore();
		const items = getTranslation(store, 'common.items');
		expect(typeof items).toBe('function');
		expect((items as (count: number) => string)(3)).toBe('3 items');
	});

	it('runtime: still refuses prototype machinery and Object.prototype members', async () => {
		const store = await buildStore();
		// Dangerous keys never resolve
		expect(getTranslation(store, 'common.__proto__' as never)).toBe('common.__proto__');
		expect(getTranslation(store, 'common.constructor' as never)).toBe('common.constructor');
		expect(getTranslation(store, 'common.prototype' as never)).toBe('common.prototype');
		// Object.prototype builtins do not leak through inheritance
		expect(getTranslation(store, 'common.toString' as never)).toBe('common.toString');
		expect(getTranslation(store, 'common.valueOf' as never)).toBe('common.valueOf');
		expect(getTranslation(store, 'common.hasOwnProperty' as never)).toBe('common.hasOwnProperty');
	});
});
