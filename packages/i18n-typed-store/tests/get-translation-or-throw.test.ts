import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { createTranslationStore } from '../src/lib/create-translation-store';
import { getTranslation, getTranslationOrThrow, TranslationMissingError } from '../src/lib/get-translation';

class CommonEn {
	greeting = 'Hello';
	message = { title: 'Hi', body: 'Text' };
	items(count: number) {
		return `${count} items`;
	}
}

const buildStore = (onMissingKey?: (key: string, locale: string) => void) =>
	createTranslationStore({
		namespaces: { common: 'common' } as const,
		locales: { en: 'en', ru: 'ru' } as const,
		loadModule: async () => new CommonEn(),
		extractTranslation: (module) => module,
		defaultLocale: 'en',
		onMissingKey,
	}).type<{ common: CommonEn }>();

describe('getTranslationOrThrow', () => {
	it('returns values with a clean type — object access without narrowing', async () => {
		const store = buildStore();
		await store.translations.common.load('en');

		const message = getTranslationOrThrow(store, 'common.message');
		// No `| Key` in the type: direct property access compiles
		expectTypeOf(message).toEqualTypeOf<{ title: string; body: string }>();
		expect(message.title).toBe('Hi');

		const ns = getTranslationOrThrow(store, 'common');
		expectTypeOf(ns).toEqualTypeOf<CommonEn>();
		expect(ns.greeting).toBe('Hello');

		// Prototype methods resolve too
		expect(getTranslationOrThrow(store, 'common.items')(2)).toBe('2 items');
	});

	it('supports BCP 47 locale tags like getTranslation', async () => {
		const store = buildStore();
		await store.translations.common.load('en');
		expect(getTranslationOrThrow(store, 'common.greeting', 'en-US')).toBe('Hello');
	});

	it('throws TranslationMissingError with key and locale on a miss', () => {
		const store = buildStore();

		let caught: unknown;
		try {
			getTranslationOrThrow(store, 'common.greeting');
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(TranslationMissingError);
		const missError = caught as TranslationMissingError;
		expect(missError.key).toBe('common.greeting');
		expect(missError.locale).toBe('en');
		expect(missError.name).toBe('TranslationMissingError');
		expect(missError.message).toContain('common.greeting');
	});

	it('invokes onMissingKey before throwing — monitoring stays consistent', async () => {
		const onMissingKey = vi.fn();
		const store = buildStore(onMissingKey);
		await store.translations.common.load('en');

		expect(() => getTranslationOrThrow(store, 'common.missing' as never)).toThrow(TranslationMissingError);
		expect(onMissingKey).toHaveBeenCalledWith('common.missing', 'en');
	});

	it('does not throw and does not report on a hit', async () => {
		const onMissingKey = vi.fn();
		const store = buildStore(onMissingKey);
		await store.translations.common.load('en');

		expect(getTranslationOrThrow(store, 'common.greeting')).toBe('Hello');
		expect(onMissingKey).not.toHaveBeenCalled();
	});

	it('stays consistent with getTranslation on the same lookups', async () => {
		const store = buildStore();
		await store.translations.common.load('en');

		// Hit: both return the same value
		expect(getTranslationOrThrow(store, 'common.greeting')).toBe(getTranslation(store, 'common.greeting'));
		// Miss: getTranslation returns the key, OrThrow throws
		expect(getTranslation(store, 'common.missing' as never)).toBe('common.missing');
		expect(() => getTranslationOrThrow(store, 'common.missing' as never)).toThrow(TranslationMissingError);
	});
});
