import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createTranslationStore, getTranslation, getTranslationOrThrow, LocaleLoadError } from '../src';
import type { LocaleChangeMetadata, LocaleChangeResult, LocaleLoadOptions, TranslationStateListener } from '../src';

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
}

const createDeferred = <T>(): Deferred<T> => {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

describe('locale loading and atomic transitions', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru', de: 'de' } as const;
	type Messages = {
		common: { value: string };
		errors: { value: string };
	};

	it('keeps a non-selected direct load in the cache without changing the active translation', async () => {
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: async (locale) => ({ value: String(locale) }),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<{ common: { value: string } }>();

		await store.translations.common.load('en');
		await store.translations.common.load('ru');

		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'ru' });
		expect(store.currentLocale).toBe('en');
		expect(store.translations.common.currentLocale).toBe('en');
		expect(store.translations.common.currentTranslation).toEqual({ value: 'en' });
	});

	it('does not activate a stale load that finishes after the selected locale changes', async () => {
		const ruLoad = createDeferred<{ value: string }>();
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: (locale) => (locale === 'ru' ? ruLoad.promise : Promise.resolve({ value: String(locale) })),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<{ common: { value: string } }>();

		await store.translations.common.load('en');
		store.changeLocale('ru');
		const pending = store.translations.common.load('ru');
		store.changeLocale('en');
		ruLoad.resolve({ value: 'ru' });
		await pending;

		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'ru' });
		expect(store.currentLocale).toBe('en');
		expect(store.translations.common.currentLocale).toBe('en');
		expect(store.translations.common.currentTranslation).toEqual({ value: 'en' });
	});

	it('activates the selected locale even when a later non-selected load is still in flight', async () => {
		const enLoad = createDeferred<{ value: string }>();
		const ruLoad = createDeferred<{ value: string }>();
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: (locale) => {
				if (locale === 'en') return enLoad.promise;
				if (locale === 'ru') return ruLoad.promise;
				return Promise.resolve({ value: String(locale) });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<{ common: { value: string } }>();

		const selectedLoad = store.translations.common.load('en');
		const nonSelectedLoad = store.translations.common.load('ru');

		ruLoad.resolve({ value: 'ru' });
		await nonSelectedLoad;
		expect(store.translations.common.currentLocale).toBeUndefined();

		enLoad.resolve({ value: 'en' });
		await selectedLoad;

		expect(store.translations.common.translations.en.namespace).toEqual({ value: 'en' });
		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'ru' });
		expect(store.translations.common.currentLocale).toBe('en');
		expect(store.translations.common.currentTranslation).toEqual({ value: 'en' });
	});

	it('runs cache cleanup after a second caller deduplicates onto the same fetch', async () => {
		const ruLoad = createDeferred<{ value: string }>();
		const loadModule = vi.fn((locale: keyof typeof locales) => {
			if (locale === 'ru') return ruLoad.promise;
			return Promise.resolve({ value: String(locale) });
		});
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule,
			extractTranslation: (module) => module,
			defaultLocale: 'en',
			deleteOtherLocalesAfterLoad: true,
		}).type<{ common: { value: string } }>();

		await store.translations.common.load('en');
		await store.translations.common.load('de');
		expect(store.translations.common.translations.en.namespace).toBeDefined();
		expect(store.translations.common.translations.de.namespace).toBeDefined();

		const producer = store.translations.common.load('ru', false);
		await vi.waitFor(() => {
			expect(store.translations.common.translations.ru.loadingPromise).toBeDefined();
		});
		const deduplicated = store.translations.common.load('ru', false);
		ruLoad.resolve({ value: 'ru' });
		await Promise.all([producer, deduplicated]);

		expect(loadModule.mock.calls.filter(([locale]) => locale === 'ru')).toHaveLength(1);
		expect(store.translations.common.translations.en.namespace).toBeDefined();
		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'ru' });
		expect(store.translations.common.translations.de.namespace).toBeUndefined();
	});

	it('invalidates the exact locale state when cache cleanup evicts its translation', async () => {
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: async (locale) => ({ value: String(locale) }),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
			deleteOtherLocalesAfterLoad: true,
		}).type<{ common: { value: string } }>();

		await store.translations.common.load('en');
		await store.translations.common.load('ru');
		const ruInvalidations: Array<{ namespace: 'common'; locale: 'ru' }> = [];
		store.subscribeTranslationState((event) => {
			if (event.namespace === 'common' && event.locale === 'ru') {
				ruInvalidations.push({ namespace: event.namespace, locale: event.locale });
			}
		});

		await store.translations.common.load('de');
		await store.translations.common.load('de');

		expect(store.translations.common.translations.ru.namespace).toBeUndefined();
		expect(ruInvalidations).toEqual([{ namespace: 'common', locale: 'ru' }]);
	});

	it('completes every cache eviction before notifying cleanup subscribers', async () => {
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: async (locale) => ({ value: String(locale) }),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
			deleteOtherLocalesAfterLoad: true,
		}).type<{ common: { value: string } }>();
		await store.translations.common.load('en');

		// Seed two stale cache entries so one cleanup pass has multiple
		// mutations. The first notification must observe the second mutation too.
		store.translations.common.translations.ru.namespace = { value: 'ru' };
		store.translations.common.translations.de.namespace = { value: 'de' };
		let deValueAtRuInvalidation: { value: string } | undefined;
		store.subscribeTranslationState(({ locale }) => {
			if (locale === 'ru') {
				deValueAtRuInvalidation = store.translations.common.translations.de.namespace;
			}
		});

		await store.translations.common.load('en');

		expect(store.translations.common.translations.ru.namespace).toBeUndefined();
		expect(store.translations.common.translations.de.namespace).toBeUndefined();
		expect(deValueAtRuInvalidation).toBeUndefined();
	});

	it('preserves the exact load error and clears it after a successful retry', async () => {
		const loadError = { code: 'CHUNK_LOAD_FAILED' };
		let shouldFail = true;
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: async () => {
				if (shouldFail) throw loadError;
				return { value: 'en' };
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<{ common: { value: string } }>();

		await expect(store.translations.common.load('en')).rejects.toBe(loadError);
		const state = store.translations.common.translations.en;
		expect(state.isError).toBe(true);
		expect(state.error).toBe(loadError);

		shouldFail = false;
		await store.translations.common.load('en', false);
		expect(state.isError).toBe(false);
		expect(state.error).toBeUndefined();
	});

	it('emits observable and internally consistent translation state invalidations', async () => {
		const deferred = createDeferred<{ value: string }>();
		const loadError = new Error('retry failed');
		let attempt = 0;
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: () => {
				attempt += 1;
				if (attempt === 1) return deferred.promise;
				return Promise.reject(loadError);
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<{ common: { value: string } }>();
		const events: Array<{
			isLoading: boolean;
			isError: boolean;
			error: unknown;
			hasPromise: boolean;
		}> = [];
		const listener = (event: { namespace: 'common'; locale: 'en' | 'ru' | 'de' }) => {
			if (event.locale !== 'en') return;
			const state = store.translations.common.translations.en;
			events.push({
				isLoading: state.isLoading,
				isError: state.isError,
				error: state.error,
				hasPromise: state.loadingPromise !== undefined,
			});
		};
		const unsubscribe = store.subscribeTranslationState(listener);

		const initialLoad = store.translations.common.load('en');
		deferred.resolve({ value: 'en' });
		await initialLoad;
		await expect(store.translations.common.load('en', false)).rejects.toBe(loadError);
		unsubscribe();
		await store.translations.common.load('en');

		expect(events).toEqual([
			{ isLoading: true, isError: false, error: undefined, hasPromise: true },
			{ isLoading: false, isError: false, error: undefined, hasPromise: false },
			{ isLoading: true, isError: false, error: undefined, hasPromise: true },
			{ isLoading: false, isError: true, error: loadError, hasPromise: false },
		]);
	});

	it('uses translation state events as invalidations for fetches and cache activation', async () => {
		const ruLoad = createDeferred<{ value: string }>();
		const deLoad = createDeferred<{ value: string }>();
		const store = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule: (locale) => {
				if (locale === 'ru') return ruLoad.promise;
				if (locale === 'de') return deLoad.promise;
				return Promise.resolve({ value: 'en' });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<{ common: { value: string } }>();
		const eventsByLocale: Record<'en' | 'ru' | 'de', number> = {
			en: 0,
			ru: 0,
			de: 0,
		};
		store.subscribeTranslationState(({ locale }) => {
			eventsByLocale[locale] += 1;
		});

		await store.translations.common.load('en');
		await store.translations.common.load('en');

		const ruProducer = store.translations.common.load('ru', false);
		const ruJoiner = store.translations.common.load('ru', false);
		ruLoad.resolve({ value: 'ru' });
		await Promise.all([ruProducer, ruJoiner]);

		const deProducer = store.translations.common.load('de', false);
		const deJoiner = store.translations.common.load('de', false);
		const deError = new Error('de failed');
		deLoad.reject(deError);
		await expect(Promise.all([deProducer, deJoiner])).rejects.toBe(deError);

		expect(eventsByLocale).toEqual({ en: 3, ru: 2, de: 2 });
	});

	it('preloads every namespace without changing the active locale and honors fromCache', async () => {
		const loadModule = vi.fn(async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => ({
			value: `${String(namespace)}:${String(locale)}`,
		}));
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule,
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();

		await store.preloadLocale('ru');
		await store.preloadLocale('ru');

		expect(loadModule).toHaveBeenCalledTimes(2);
		expect(store.currentLocale).toBe('en');
		expect(store.translations.common.currentTranslation).toBeUndefined();
		expect(store.translations.errors.currentTranslation).toBeUndefined();
		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'common:ru' });
		expect(store.translations.errors.translations.ru.namespace).toEqual({ value: 'errors:ru' });

		await store.preloadLocale('ru', { fromCache: false });
		expect(loadModule).toHaveBeenCalledTimes(4);
		expect(store.currentLocale).toBe('en');
		expect(store.translations.common.currentTranslation).toBeUndefined();
		expect(store.translations.errors.currentTranslation).toBeUndefined();
	});

	it('preloads only the requested typed namespace subset and validates runtime keys', async () => {
		const loadModule = vi.fn(async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => ({
			value: `${String(namespace)}:${String(locale)}`,
		}));
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule,
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();

		await store.preloadLocale('ru', { namespaces: ['common', 'common'] });

		expect(loadModule).toHaveBeenCalledOnce();
		expect(loadModule).toHaveBeenCalledWith('ru', 'common');
		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'common:ru' });
		expect(store.translations.errors.translations.ru.namespace).toBeUndefined();

		// @ts-expect-error -- unknown namespace keys are rejected by LocaleLoadOptions<typeof namespaces>
		const invalidOptions: LocaleLoadOptions<typeof namespaces> = { namespaces: ['missing'] };
		await expect(store.preloadLocale('ru', invalidOptions)).rejects.toThrow("namespace 'missing' must be a key in namespaces");
		await expect(
			store.preloadLocale('ru', { namespaces: 'common' } as unknown as { namespaces: readonly ('common' | 'errors')[] }),
		).rejects.toThrow('options.namespaces must be an array');
	});

	it('loads and atomically publishes only the selected namespace subset', async () => {
		let errorsRuAttempts = 0;
		const loadModule = vi.fn(async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => {
			if (locale === 'en') return { value: `${String(namespace)}:en:old` };
			if (locale === 'ru' && namespace === 'common') return { value: 'common:ru:new' };
			if (locale === 'ru') {
				errorsRuAttempts += 1;
				if (errorsRuAttempts === 1) throw new Error('errors:ru failed');
				return { value: 'errors:ru:new' };
			}
			return { value: `${String(namespace)}:${String(locale)}` };
		});
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule,
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');

		await expect(store.changeLocaleAsync('ru', { fromCache: false })).rejects.toBeInstanceOf(LocaleLoadError);
		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'common:ru:new' });
		expect(store.translations.common.currentTranslation).toEqual({ value: 'common:en:old' });

		const listener = vi.fn();
		store.addChangeLocaleListener(listener);
		await expect(store.changeLocaleAsync('ru', { fromCache: false, namespaces: ['errors'] })).resolves.toEqual({
			status: 'committed',
			locale: 'ru',
		});

		expect(loadModule.mock.calls.filter(([locale, namespace]) => locale === 'ru' && namespace === 'common')).toHaveLength(1);
		expect(store.currentLocale).toBe('ru');
		expect(store.translations.common.currentLocale).toBe('en');
		expect(store.translations.common.currentTranslation).toEqual({ value: 'common:en:old' });
		expect(store.translations.errors.currentLocale).toBe('ru');
		expect(store.translations.errors.currentTranslation).toEqual({ value: 'errors:ru:new' });
		expect(listener).toHaveBeenCalledWith('ru', {
			source: 'atomic',
			loadedNamespaces: ['errors'],
			fromCache: false,
		});
	});

	it('reports the effective cache policy in atomic locale metadata', async () => {
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => ({ value: `${String(namespace)}:${String(locale)}` }),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
			loadFromCache: false,
		}).type<Messages>();
		const metadata: LocaleChangeMetadata<typeof namespaces>[] = [];
		store.addChangeLocaleListener((_locale, changeMetadata) => {
			metadata.push(changeMetadata);
		});

		await store.changeLocaleAsync('en', { namespaces: ['common'] });
		await store.changeLocaleAsync('ru', { namespaces: ['errors'], fromCache: true });

		expect(metadata).toEqual([
			{ source: 'atomic', loadedNamespaces: ['common'], fromCache: false },
			{ source: 'atomic', loadedNamespaces: ['errors'], fromCache: true },
		]);
	});

	it('protects a partially completed preload from concurrent cache cleanup', async () => {
		const errorsRu = createDeferred<{ value: string }>();
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: (locale, namespace) => {
				if (locale === 'ru' && namespace === 'errors') return errorsRu.promise;
				return Promise.resolve({ value: `${String(namespace)}:${String(locale)}` });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
			deleteOtherLocalesAfterLoad: true,
		}).type<Messages>();
		await store.changeLocaleAsync('en');

		const preload = store.preloadLocale('ru');
		await vi.waitFor(() => {
			expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'common:ru' });
		});
		await store.translations.common.load('en');
		errorsRu.resolve({ value: 'errors:ru' });
		await expect(preload).resolves.toBeUndefined();

		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'common:ru' });
		expect(store.translations.errors.translations.ru.namespace).toEqual({ value: 'errors:ru' });
	});

	it('commits all namespaces together after an atomic locale change succeeds', async () => {
		const commonRu = createDeferred<{ value: string }>();
		const errorsRu = createDeferred<{ value: string }>();
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: (locale, namespace) => {
				if (locale === 'ru') return namespace === 'common' ? commonRu.promise : errorsRu.promise;
				return Promise.resolve({ value: `${String(namespace)}:${String(locale)}` });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');
		const snapshots: Array<{
			locale: keyof typeof locales;
			storeLocale: keyof typeof locales;
			commonLocale: keyof typeof locales | undefined;
			errorsLocale: keyof typeof locales | undefined;
			commonValue: string | undefined;
			errorsValue: string | undefined;
		}> = [];
		const listener = vi.fn((locale: keyof typeof locales) => {
			snapshots.push({
				locale,
				storeLocale: store.currentLocale,
				commonLocale: store.translations.common.currentLocale,
				errorsLocale: store.translations.errors.currentLocale,
				commonValue: store.translations.common.currentTranslation?.value,
				errorsValue: store.translations.errors.currentTranslation?.value,
			});
		});
		store.addChangeLocaleListener(listener);

		const transition = store.changeLocaleAsync('ru');
		commonRu.resolve({ value: 'common:ru' });
		await vi.waitFor(() => {
			expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'common:ru' });
		});

		expect(store.currentLocale).toBe('en');
		expect(store.translations.common.currentLocale).toBe('en');
		expect(store.translations.errors.currentLocale).toBe('en');
		expect(listener).not.toHaveBeenCalled();

		errorsRu.resolve({ value: 'errors:ru' });
		await expect(transition).resolves.toEqual({ status: 'committed', locale: 'ru' });

		expect(store.currentLocale).toBe('ru');
		expect(store.translations.common.currentLocale).toBe('ru');
		expect(store.translations.errors.currentLocale).toBe('ru');
		expect(listener).toHaveBeenCalledOnce();
		expect(listener).toHaveBeenCalledWith('ru', {
			source: 'atomic',
			loadedNamespaces: ['common', 'errors'],
			fromCache: true,
		});
		expect(snapshots).toEqual([
			{
				locale: 'ru',
				storeLocale: 'ru',
				commonLocale: 'ru',
				errorsLocale: 'ru',
				commonValue: 'common:ru',
				errorsValue: 'errors:ru',
			},
		]);
	});

	it('keeps a reentrant synchronous locale commit coherent and aborts stale outer notifications', async () => {
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => ({ value: `${String(namespace)}:${String(locale)}` }),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.preloadLocale('de');

		let reentered = false;
		const staleStateNotifications: Array<{ namespace: keyof typeof namespaces; locale: keyof typeof locales }> = [];
		const localeNotifications: (keyof typeof locales)[] = [];
		store.subscribeTranslationState(({ namespace, locale }) => {
			if (!reentered && namespace === 'common' && locale === 'ru' && store.currentLocale === 'ru') {
				reentered = true;
				store.changeLocale('de');
			}
		});
		store.subscribeTranslationState((event) => {
			if (event.locale === 'ru' && store.currentLocale === 'de') {
				staleStateNotifications.push(event);
			}
		});
		store.addChangeLocaleListener((locale) => {
			localeNotifications.push(locale);
		});

		await expect(store.changeLocaleAsync('ru')).resolves.toEqual({ status: 'committed', locale: 'ru' });

		expect(reentered).toBe(true);
		expect(store.currentLocale).toBe('de');
		expect(store.translations.common.currentLocale).toBe('de');
		expect(store.translations.errors.currentLocale).toBe('de');
		expect(staleStateNotifications).toEqual([]);
		expect(localeNotifications).toEqual(['de']);
	});

	it('protects a partially loaded atomic target from concurrent cache cleanup', async () => {
		const errorsRu = createDeferred<{ value: string }>();
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: (locale, namespace) => {
				if (locale === 'ru' && namespace === 'errors') return errorsRu.promise;
				return Promise.resolve({ value: `${String(namespace)}:${String(locale)}` });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
			deleteOtherLocalesAfterLoad: true,
		}).type<Messages>();
		await store.changeLocaleAsync('en');

		const transition = store.changeLocaleAsync('ru');
		await vi.waitFor(() => {
			expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'common:ru' });
		});
		await store.translations.common.load('en');
		errorsRu.resolve({ value: 'errors:ru' });
		await expect(transition).resolves.toEqual({ status: 'committed', locale: 'ru' });

		expect(store.translations.common.currentTranslation).toEqual({ value: 'common:ru' });
		expect(store.translations.errors.currentTranslation).toEqual({ value: 'errors:ru' });
		expect(store.translations.common.currentLocale).toBe('ru');
		expect(store.translations.errors.currentLocale).toBe('ru');
	});

	it('aggregates every namespace failure and keeps the committed locale unchanged', async () => {
		const commonError = new Error('common namespace failed');
		const errorsError = { code: 'ERRORS_NAMESPACE_FAILED' };
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => {
				if (locale === 'ru') {
					if (namespace === 'common') throw commonError;
					throw errorsError;
				}
				return { value: `${String(namespace)}:${String(locale)}` };
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');
		const listener = vi.fn();
		store.addChangeLocaleListener(listener);

		const transitionError: unknown = await store.changeLocaleAsync('ru').catch((error: unknown) => error);
		expect(transitionError).toBeInstanceOf(LocaleLoadError);
		if (!(transitionError instanceof LocaleLoadError)) throw transitionError;
		expect(transitionError.locale).toBe('ru');
		expect([...transitionError.failures.entries()]).toEqual([
			['common', commonError],
			['errors', errorsError],
		]);
		expect(transitionError.errors).toEqual([commonError, errorsError]);

		expect(store.currentLocale).toBe('en');
		expect(store.translations.common.currentLocale).toBe('en');
		expect(store.translations.errors.currentLocale).toBe('en');
		expect(store.translations.common.translations.ru.error).toBe(commonError);
		expect(store.translations.errors.translations.ru.error).toBe(errorsError);
		expect(listener).not.toHaveBeenCalled();
	});

	it('keeps successful namespace results cached when another namespace prevents the commit', async () => {
		const errorsFailure = new Error('errors namespace failed');
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => {
				if (locale === 'ru' && namespace === 'errors') throw errorsFailure;
				return { value: `${String(namespace)}:${String(locale)}` };
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');
		const listener = vi.fn();
		store.addChangeLocaleListener(listener);

		const transitionError: unknown = await store.changeLocaleAsync('ru').catch((error: unknown) => error);
		expect(transitionError).toBeInstanceOf(LocaleLoadError);
		if (!(transitionError instanceof LocaleLoadError)) throw transitionError;
		expect([...transitionError.failures.entries()]).toEqual([['errors', errorsFailure]]);

		expect(store.currentLocale).toBe('en');
		expect(store.translations.common.currentLocale).toBe('en');
		expect(store.translations.errors.currentLocale).toBe('en');
		expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'common:ru' });
		expect(store.translations.errors.translations.ru.namespace).toBeUndefined();
		expect(store.translations.errors.translations.ru.error).toBe(errorsFailure);
		expect(listener).not.toHaveBeenCalled();
	});

	it('keeps a direct joiner from exposing a partially failed atomic refresh', async () => {
		const commonRefresh = createDeferred<{ value: string }>();
		const errorsRefresh = createDeferred<{ value: string }>();
		let refreshing = false;
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: (locale, namespace) => {
				if (!refreshing) return Promise.resolve({ value: `${String(namespace)}:${String(locale)}:old` });
				return namespace === 'common' ? commonRefresh.promise : errorsRefresh.promise;
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');
		refreshing = true;

		const transition = store.changeLocaleAsync('en', { fromCache: false });
		await vi.waitFor(() => {
			expect(store.translations.common.translations.en.loadingPromise).toBeDefined();
			expect(store.translations.errors.translations.en.loadingPromise).toBeDefined();
		});
		const directJoiner = store.translations.common.load('en', false);
		commonRefresh.resolve({ value: 'common:en:new' });
		errorsRefresh.reject(new Error('errors refresh failed'));

		await expect(directJoiner).resolves.toBeUndefined();
		await expect(transition).rejects.toBeInstanceOf(LocaleLoadError);

		expect(store.translations.common.translations.en.namespace).toEqual({ value: 'common:en:new' });
		expect(store.translations.common.currentTranslation).toEqual({ value: 'common:en:old' });
		expect(store.translations.errors.currentTranslation).toEqual({ value: 'errors:en:old' });
		expect(store.translations.common.currentLocale).toBe('en');
		expect(store.translations.errors.currentLocale).toBe('en');
		expect(getTranslation(store, 'common.value')).toBe('common:en:old');
		expect(getTranslation(store, 'common.value', 'en')).toBe('common:en:new');
		expect(getTranslationOrThrow(store, 'common.value')).toBe('common:en:old');
		expect(getTranslationOrThrow(store, 'common.value', 'en')).toBe('common:en:new');
	});

	it('activates a slower forced load after a successful cached atomic transition finishes', async () => {
		const commonRefresh = createDeferred<{ value: string }>();
		let refreshing = false;
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: (locale, namespace) => {
				if (refreshing && namespace === 'common') return commonRefresh.promise;
				return Promise.resolve({ value: `${String(namespace)}:${String(locale)}:old` });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');
		refreshing = true;

		const transition = store.changeLocaleAsync('en');
		const forcedRefresh = store.translations.common.load('en', false);

		await expect(transition).resolves.toEqual({ status: 'committed', locale: 'en' });
		commonRefresh.resolve({ value: 'common:en:new' });
		await expect(forcedRefresh).resolves.toBeUndefined();

		expect(store.translations.common.translations.en.namespace).toEqual({ value: 'common:en:new' });
		expect(store.translations.common.currentTranslation).toEqual({ value: 'common:en:new' });
	});

	it('lets the latest atomic locale request win when requests finish out of order', async () => {
		const ruLoads = {
			common: createDeferred<{ value: string }>(),
			errors: createDeferred<{ value: string }>(),
		};
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: (locale, namespace) => {
				if (locale === 'ru') return ruLoads[namespace].promise;
				return Promise.resolve({ value: `${String(namespace)}:${String(locale)}` });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');

		const staleTransition = store.changeLocaleAsync('ru');
		const latestTransition = store.changeLocaleAsync('de');
		await expect(latestTransition).resolves.toEqual({ status: 'committed', locale: 'de' });
		ruLoads.common.resolve({ value: 'common:ru' });
		ruLoads.errors.resolve({ value: 'errors:ru' });
		await expect(staleTransition).resolves.toEqual({ status: 'superseded', locale: 'ru', currentLocale: 'de' });

		expect(store.currentLocale).toBe('de');
		expect(store.translations.common.currentLocale).toBe('de');
		expect(store.translations.errors.currentLocale).toBe('de');
	});

	it('lets a synchronous locale change supersede an in-flight atomic transition', async () => {
		const ruLoads = {
			common: createDeferred<{ value: string }>(),
			errors: createDeferred<{ value: string }>(),
		};
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: (locale, namespace) => {
				if (locale === 'ru') return ruLoads[namespace].promise;
				return Promise.resolve({ value: `${String(namespace)}:${String(locale)}` });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');
		await store.preloadLocale('de');
		const listener = vi.fn();
		store.addChangeLocaleListener(listener);

		const staleTransition = store.changeLocaleAsync('ru');
		await vi.waitFor(() => {
			expect(store.translations.common.translations.ru.loadingPromise).toBeDefined();
			expect(store.translations.errors.translations.ru.loadingPromise).toBeDefined();
		});
		store.changeLocale('de');
		ruLoads.common.resolve({ value: 'common:ru' });
		ruLoads.errors.resolve({ value: 'errors:ru' });

		await expect(staleTransition).resolves.toEqual({ status: 'superseded', locale: 'ru', currentLocale: 'de' });
		expect(store.currentLocale).toBe('de');
		expect(store.translations.common.currentLocale).toBe('de');
		expect(store.translations.errors.currentLocale).toBe('de');
		expect(listener).toHaveBeenCalledOnce();
		expect(listener).toHaveBeenCalledWith('de', { source: 'sync', loadedNamespaces: [] });
	});

	it('activates in-flight results when a synchronous change selects the same locale', async () => {
		const ruLoads = {
			common: createDeferred<{ value: string }>(),
			errors: createDeferred<{ value: string }>(),
		};
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: (locale, namespace) => {
				if (locale === 'ru') return ruLoads[namespace].promise;
				return Promise.resolve({ value: `${String(namespace)}:${String(locale)}` });
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');
		const ruEvents: Record<'common' | 'errors', number> = { common: 0, errors: 0 };
		store.subscribeTranslationState(({ namespace, locale }) => {
			if (locale === 'ru') ruEvents[namespace] += 1;
		});

		const supersededTransition = store.changeLocaleAsync('ru');
		await vi.waitFor(() => {
			expect(store.translations.common.translations.ru.loadingPromise).toBeDefined();
			expect(store.translations.errors.translations.ru.loadingPromise).toBeDefined();
		});
		store.changeLocale('ru');
		ruLoads.common.resolve({ value: 'common:ru' });
		ruLoads.errors.resolve({ value: 'errors:ru' });

		await expect(supersededTransition).resolves.toEqual({ status: 'superseded', locale: 'ru', currentLocale: 'ru' });
		await vi.waitFor(() => {
			expect(store.translations.common.currentTranslation).toEqual({ value: 'common:ru' });
			expect(store.translations.errors.currentTranslation).toEqual({ value: 'errors:ru' });
		});
		expect(store.translations.common.currentLocale).toBe('ru');
		expect(store.translations.errors.currentLocale).toBe('ru');
		expect(ruEvents).toEqual({ common: 3, errors: 3 });
	});

	it('deduplicates an atomic transition onto an existing namespace fetch', async () => {
		const commonRu = createDeferred<{ value: string }>();
		const loadModule = vi.fn((locale: keyof typeof locales, namespace: keyof typeof namespaces) => {
			if (locale === 'ru' && namespace === 'common') return commonRu.promise;
			return Promise.resolve({ value: `${String(namespace)}:${String(locale)}` });
		});
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule,
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		await store.changeLocaleAsync('en');

		const directLoad = store.translations.common.load('ru', false);
		await vi.waitFor(() => {
			expect(store.translations.common.translations.ru.loadingPromise).toBeDefined();
		});
		const transition = store.changeLocaleAsync('ru');
		commonRu.resolve({ value: 'common:ru' });

		await directLoad;
		await expect(transition).resolves.toEqual({ status: 'committed', locale: 'ru' });
		expect(loadModule.mock.calls.filter(([locale, namespace]) => locale === 'ru' && namespace === 'common')).toHaveLength(1);
		expect(store.currentLocale).toBe('ru');
		expect(store.translations.common.currentLocale).toBe('ru');
		expect(store.translations.errors.currentLocale).toBe('ru');
	});

	it('resolves a BCP 47 tag once and commits the matching store locale', async () => {
		const bcpLocales = { en: 'en', ru: 'ru' } as const;
		const loadModule = vi.fn(async (locale: keyof typeof bcpLocales, namespace: keyof typeof namespaces) => ({
			value: `${String(namespace)}:${String(locale)}`,
		}));
		const store = createTranslationStore({
			namespaces,
			locales: bcpLocales,
			loadModule,
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();

		const transition = store.changeLocaleAsync('ru-RU');
		expectTypeOf(transition).toEqualTypeOf<Promise<LocaleChangeResult<typeof bcpLocales>>>();
		await expect(transition).resolves.toEqual({ status: 'committed', locale: 'ru' });

		expect(loadModule).toHaveBeenCalledTimes(2);
		expect(loadModule).toHaveBeenNthCalledWith(1, 'ru', 'common');
		expect(loadModule).toHaveBeenNthCalledWith(2, 'ru', 'errors');
		expect(store.currentLocale).toBe('ru');
	});

	it('commits the primary locale when fallback loading fails', async () => {
		const fallbackError = new Error('fallback failed');
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => {
				if (locale === 'en') throw fallbackError;
				return { value: `${String(namespace)}:${String(locale)}` };
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
			useFallback: true,
			fallbackLocale: 'en',
		}).type<Messages>();

		await expect(store.changeLocaleAsync('ru')).resolves.toEqual({ status: 'committed', locale: 'ru' });

		expect(store.currentLocale).toBe('ru');
		expect(store.translations.common.currentTranslation).toEqual({ value: 'common:ru' });
		expect(store.translations.errors.currentTranslation).toEqual({ value: 'errors:ru' });
		expect(store.translations.common.translations.en.isError).toBe(true);
		expect(store.translations.common.translations.en.error).toBe(fallbackError);
		expect(store.translations.errors.translations.en.isError).toBe(true);
		expect(store.translations.errors.translations.en.error).toBe(fallbackError);
	});

	it('treats falsy namespace roots as loaded cache values and valid translations', async () => {
		for (const value of [false, 0, ''] as const) {
			const loadModule = vi.fn(async () => value);
			const store = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales: { en: 'en' } as const,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			}).type<{ common: false | 0 | '' }>();

			await store.translations.common.load('en');
			await store.translations.common.load('en');

			expect(loadModule).toHaveBeenCalledOnce();
			expect(store.translations.common.translations.en.namespace).toBe(value);
			expect(getTranslation(store, 'common')).toBe(value);
		}
	});

	it('rejects a state listener that cannot handle every emitted namespace and locale', () => {
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => ({ value: `${String(namespace)}:${String(locale)}` }),
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		const tooNarrowListener: TranslationStateListener<'common', 'en'> = () => undefined;

		// @ts-expect-error -- the store can also emit errors/de/ru events
		store.subscribeTranslationState(tooNarrowListener);

		expect(true).toBe(true);
	});

	it('preserves ordered Set listener semantics and isolates locale-listener errors', () => {
		const queuedMicrotasks: VoidFunction[] = [];
		const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
			queuedMicrotasks.push(callback);
		});
		try {
			const store = createTranslationStore({
				namespaces: { common: 'common' } as const,
				locales,
				loadModule: async () => ({ value: 'unused' }),
				extractTranslation: (module) => module,
				defaultLocale: 'en',
				changeLocaleEventName: '__proto__',
			}).type<{ common: { value: string } }>();
			const calls: string[] = [];
			const listenerError = new Error('listener failed');
			const first = () => {
				calls.push('first');
				throw listenerError;
			};
			const second = () => {
				calls.push('second');
			};
			store.addChangeLocaleListener(first);
			store.addChangeLocaleListener(first);
			store.addChangeLocaleListener(second);

			store.changeLocale('ru');

			expect(calls).toEqual(['first', 'second']);
			expect(queuedMicrotasks).toHaveLength(1);
			expect(() => queuedMicrotasks[0]?.()).toThrow(listenerError);
		} finally {
			queueMicrotaskSpy.mockRestore();
		}
	});
});
