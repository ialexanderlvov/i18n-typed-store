import { describe, it, expect, vi } from 'vitest';
import { createTranslationStore } from '../src/lib/create-translation-store';
import { getTranslation } from '../src/lib/get-translation';
import { parseLocale } from '../src/lib/locale-utils';

/**
 * Regression tests for the 0.5.0 concurrency & consistency fixes:
 * - fallback prefetch and load(fallbackLocale) no longer share a promise with
 *   incompatible post-conditions (swallowed errors / stale currentTranslation)
 * - deleteOtherLocalesAfterLoad no longer wipes concurrently-loaded locales
 * - cache hits reset a stale isError flag
 * - changeLocale points currentTranslation at an already-cached locale
 * - getTranslation resolves BCP 47 tags like load()/changeLocale() do
 */

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
}

const createDeferred = <T>(): Deferred<T> => {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

describe('concurrency & consistency fixes (core)', () => {
	const locales = { en: 'en', ru: 'ru', de: 'de' } as const;
	const namespaces = { common: 'common' } as const;

	describe('fallback prefetch vs load(fallbackLocale) dedup', () => {
		it('propagates a fallback load failure to a deduped load(fallbackLocale) call', async () => {
			const enDeferred = createDeferred<{ greeting: string }>();
			const loadModule = vi.fn((locale: string) => {
				if (locale === 'en') return enDeferred.promise;
				return Promise.resolve({ greeting: 'Привет' });
			});

			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
			}).type<{ common: { greeting: string } }>();

			// load('ru') kicks off a fallback prefetch of 'en'
			const ruLoad = store.translations.common.load('ru');
			await vi.waitFor(() => {
				expect(store.translations.common.translations.en.loadingPromise).toBeDefined();
			});

			// This call dedups onto the in-flight fallback prefetch
			const enLoad = store.translations.common.load('en');

			enDeferred.reject(new Error('en failed'));

			// The deduped load must observe the failure — before the fix it
			// resolved successfully while the fetch had actually failed.
			await expect(enLoad).rejects.toThrow('en failed');
			expect(store.translations.common.translations.en.isError).toBe(true);

			// A broken fallback must not fail the main locale's load
			await expect(ruLoad).resolves.toBeUndefined();
			expect(store.translations.common.translations.ru.namespace).toEqual({ greeting: 'Привет' });
		});

		it('makes the fallback locale current when a deduped load(fallbackLocale) succeeds', async () => {
			const enDeferred = createDeferred<{ greeting: string; button: string }>();
			const loadModule = vi.fn((locale: string) => {
				if (locale === 'en') return enDeferred.promise;
				return Promise.resolve({ greeting: 'Привет' });
			});

			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
				useFallback: true,
				fallbackLocale: 'en',
			}).type<{ common: { greeting: string; button?: string } }>();

			const ruLoad = store.translations.common.load('ru');
			await vi.waitFor(() => {
				expect(store.translations.common.translations.en.loadingPromise).toBeDefined();
			});

			const enLoad = store.translations.common.load('en');
			enDeferred.resolve({ greeting: 'Hello', button: 'Save' });

			await Promise.all([ruLoad, enLoad]);

			// Prefetched fallback is cached raw and usable
			expect(store.translations.common.translations.en.namespace).toEqual({ greeting: 'Hello', button: 'Save' });
			// ru is merged with the fallback
			expect(store.translations.common.translations.ru.namespace).toEqual({ greeting: 'Привет', button: 'Save' });

			// Making 'en' current works from cache — before the fix a deduped
			// load(fallbackLocale) never updated currentTranslation at all.
			await store.translations.common.load('en');
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Hello', button: 'Save' });
			expect(store.translations.common.currentLocale).toBe('en');
		});
	});

	describe('deleteOtherLocalesAfterLoad under concurrent loads', () => {
		it('does not wipe a locale that another in-flight load has just fetched', async () => {
			const enDeferred = createDeferred<{ greeting: string }>();
			const loadModule = vi.fn((locale: string) => {
				if (locale === 'en') return enDeferred.promise; // slow
				if (locale === 'de') return Promise.resolve({ greeting: 'Hallo' }); // fast
				return Promise.resolve({ greeting: 'Привет' });
			});

			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'ru',
				deleteOtherLocalesAfterLoad: true,
			}).type<{ common: { greeting: string } }>();

			await store.translations.common.load('ru'); // currently viewed locale

			// Two concurrent loads for two other locales
			const enLoad = store.translations.common.load('en');
			const deLoad = store.translations.common.load('de');

			await deLoad;
			enDeferred.resolve({ greeting: 'Hello' });
			await enLoad;

			// Before the fix, whichever load finished last wiped the other's
			// freshly-loaded translation.
			expect(store.translations.common.translations.en.namespace).toEqual({ greeting: 'Hello' });
			expect(store.translations.common.translations.de.namespace).toEqual({ greeting: 'Hallo' });
		});

		it('still deletes stale locales on a subsequent sequential load', async () => {
			const loadModule = vi.fn((locale: string) => {
				const data = { en: { greeting: 'Hello' }, ru: { greeting: 'Привет' }, de: { greeting: 'Hallo' } };
				return Promise.resolve(data[locale as keyof typeof data]);
			});

			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
				deleteOtherLocalesAfterLoad: true,
			}).type<{ common: { greeting: string } }>();

			await store.translations.common.load('de');
			store.changeLocale('ru');
			await store.translations.common.load('ru', false);

			expect(store.translations.common.translations.de.namespace).toBeUndefined();
			expect(store.translations.common.translations.ru.namespace).toEqual({ greeting: 'Привет' });
		});
	});

	describe('isError lifecycle', () => {
		it('resets a stale isError flag when serving from cache', async () => {
			let shouldFail = false;
			const loadModule = vi.fn(() => {
				if (shouldFail) return Promise.reject(new Error('boom'));
				return Promise.resolve({ greeting: 'Hello' });
			});

			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			}).type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');

			// A forced reload fails — isError goes up, cached data stays
			shouldFail = true;
			await expect(store.translations.common.load('en', false)).rejects.toThrow('boom');
			expect(store.translations.common.translations.en.isError).toBe(true);
			expect(store.translations.common.translations.en.namespace).toEqual({ greeting: 'Hello' });

			// Serving valid cached data must clear the stale error flag
			await store.translations.common.load('en');
			expect(store.translations.common.translations.en.isError).toBe(false);
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Hello' });
		});
	});

	describe('changeLocale cache refresh', () => {
		it('points currentTranslation at an already-cached locale synchronously', async () => {
			const loadModule = vi.fn((locale: string) => {
				const data = { en: { greeting: 'Hello' }, ru: { greeting: 'Привет' }, de: { greeting: 'Hallo' } };
				return Promise.resolve(data[locale as keyof typeof data]);
			});

			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			}).type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');
			await store.translations.common.load('ru');
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Hello' });

			// A non-selected load only warms the cache. No load() is needed when
			// selecting cached 'ru': changeLocale flips currentTranslation.
			store.changeLocale('ru');
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Привет' });

			// Selecting cached 'en' flips it back synchronously.
			// currentTranslation so getTranslation() serves the right locale.
			store.changeLocale('en');
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Hello' });
			expect(store.translations.common.currentLocale).toBe('en');
			expect(getTranslation(store, 'common.greeting')).toBe('Hello');
		});

		it('keeps the previous translation when the new locale is not cached yet', async () => {
			const loadModule = vi.fn(() => Promise.resolve({ greeting: 'Hello' }));

			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			}).type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');
			store.changeLocale('de'); // not loaded — no flash of missing keys
			expect(store.translations.common.currentTranslation).toEqual({ greeting: 'Hello' });
			expect(store.translations.common.currentLocale).toBe('en');
		});
	});

	describe('getTranslation BCP 47 resolution', () => {
		it('resolves a BCP 47 tag to the best matching locale like load() does', async () => {
			const loadModule = vi.fn((locale: string) => {
				const data = { en: { greeting: 'Hello' }, ru: { greeting: 'Привет' }, de: { greeting: 'Hallo' } };
				return Promise.resolve(data[locale as keyof typeof data]);
			});

			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			}).type<{ common: { greeting: string } }>();

			await store.translations.common.load('en');
			await store.translations.common.load('ru');

			// Before the fix these returned the key string
			expect(getTranslation(store, 'common.greeting', 'en-US')).toBe('Hello');
			expect(getTranslation(store, 'common.greeting', 'ru-RU')).toBe('Привет');
			// Unmatched tag falls back to the current locale (still 'en' —
			// load() alone does not change store.currentLocale)
			expect(getTranslation(store, 'common.greeting', 'ja-JP')).toBe('Hello');
		});
	});

	describe('parseLocale region validation', () => {
		it('treats a 3-letter subtag as a variant, not a region', () => {
			expect(parseLocale('en-abc')).toEqual({
				language: 'en',
				variant: 'abc',
				original: 'en-abc',
			});
		});

		it('treats a 3-digit subtag as a UN M.49 region', () => {
			expect(parseLocale('es-419')).toEqual({
				language: 'es',
				region: '419',
				original: 'es-419',
			});
		});
	});
});
