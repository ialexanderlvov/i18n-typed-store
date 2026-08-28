import { act, renderHook } from '@testing-library/react';
import { createTranslationStore } from 'i18n-typed-store';
import type { PropsWithChildren } from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { I18nTypedStoreProvider, type I18nTranslationState, useI18nTranslationState } from '../src/index';

describe('useI18nTranslationState', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;
	type TranslationTypes = {
		common: { message: string };
		errors: { notFound: string };
	};

	const createStore = (
		loadModule: (locale: keyof typeof locales, namespace: keyof typeof namespaces) => Promise<unknown> = async (locale, namespace) => {
			if (namespace === 'common') return { message: locale === 'en' ? 'Hello' : 'Привет' };
			return { notFound: locale === 'en' ? 'Not found' : 'Не найдено' };
		},
	) =>
		createTranslationStore({
			namespaces,
			locales,
			loadModule,
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<TranslationTypes>();

	const createWrapper = (store: ReturnType<typeof createStore>) =>
		function Wrapper({ children }: PropsWithChildren) {
			return <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>;
		};

	const useTypedTranslationState = <K extends keyof typeof namespaces>(namespace: K, locale?: keyof typeof locales) =>
		useI18nTranslationState<typeof namespaces, typeof locales, TranslationTypes, K>(namespace, locale);

	it('exposes the current locale state and updates after an external load', async () => {
		const store = createStore();
		const { result } = renderHook(() => useTypedTranslationState('common'), {
			wrapper: createWrapper(store),
		});

		expect(result.current).toEqual({
			locale: 'en',
			translation: undefined,
			isLoading: false,
			isError: false,
			error: undefined,
			currentTranslation: undefined,
			currentLocale: undefined,
		});

		await act(async () => {
			await store.translations.common.load('en');
		});

		expect(result.current).toEqual({
			locale: 'en',
			translation: { message: 'Hello' },
			isLoading: false,
			isError: false,
			error: undefined,
			currentTranslation: { message: 'Hello' },
			currentLocale: 'en',
		});
	});

	it('tracks loading, the exact error value, and a successful retry', async () => {
		const exactError = { code: 'translation-network-error' };
		let attempt = 0;
		const store = createStore(async () => {
			attempt += 1;
			if (attempt === 1) throw exactError;
			return { message: 'Recovered' };
		});
		const { result } = renderHook(() => useTypedTranslationState('common'), {
			wrapper: createWrapper(store),
		});

		let firstLoad!: Promise<void>;
		act(() => {
			firstLoad = store.translations.common.load('en', false);
		});
		expect(result.current.isLoading).toBe(true);
		expect(result.current.isError).toBe(false);
		expect(result.current.error).toBeUndefined();

		let caughtError: unknown;
		await act(async () => {
			try {
				await firstLoad;
			} catch (error) {
				caughtError = error;
			}
		});
		expect(caughtError).toBe(exactError);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.isError).toBe(true);
		expect(result.current.error).toBe(exactError);
		expect(result.current.translation).toBeUndefined();

		let retry!: Promise<void>;
		act(() => {
			retry = store.translations.common.load('en', false);
		});
		expect(result.current.isLoading).toBe(true);
		expect(result.current.isError).toBe(false);
		expect(result.current.error).toBeUndefined();

		await act(async () => {
			await retry;
		});
		expect(result.current).toMatchObject({
			translation: { message: 'Recovered' },
			isLoading: false,
			isError: false,
			error: undefined,
			currentLocale: 'en',
		});
	});

	it('keeps the snapshot stable when a loader rejects with NaN', async () => {
		const store = createStore(async () => Promise.reject(NaN));
		await store.translations.common.load('en').catch(() => undefined);
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		try {
			const { result, rerender } = renderHook(() => useTypedTranslationState('common'), {
				wrapper: createWrapper(store),
			});
			const initialSnapshot = result.current;

			expect(initialSnapshot.isError).toBe(true);
			expect(initialSnapshot.error).toBeNaN();
			rerender();
			expect(result.current).toBe(initialSnapshot);

			const consoleOutput = consoleErrorSpy.mock.calls.map((args) => args.map(String).join(' ')).join('\n');
			expect(consoleOutput).not.toContain('The result of getSnapshot should be cached');
			expect(consoleOutput).not.toContain('Maximum update depth exceeded');
		} finally {
			consoleErrorSpy.mockRestore();
		}
	});

	it('switches synchronously to a translation already cached for the selected locale', async () => {
		const store = createStore();
		await store.translations.common.load('en');
		await store.translations.common.load('ru');
		const { result } = renderHook(() => useTypedTranslationState('common'), {
			wrapper: createWrapper(store),
		});

		expect(result.current.locale).toBe('en');
		expect(result.current.translation).toEqual({ message: 'Hello' });
		expect(result.current.currentTranslation).toEqual({ message: 'Hello' });

		act(() => {
			store.changeLocale('ru');
		});

		expect(result.current.locale).toBe('ru');
		expect(result.current.translation).toEqual({ message: 'Привет' });
		expect(result.current.currentTranslation).toEqual({ message: 'Привет' });
		expect(result.current.currentLocale).toBe('ru');
	});

	it('observes an explicit locale while preserving the selected-locale fallback', async () => {
		const store = createStore();
		await store.translations.common.load('en');
		const { result } = renderHook(() => useTypedTranslationState('common', 'ru'), {
			wrapper: createWrapper(store),
		});

		expect(result.current.locale).toBe('ru');
		expect(result.current.translation).toBeUndefined();
		expect(result.current.currentTranslation).toEqual({ message: 'Hello' });
		expect(result.current.currentLocale).toBe('en');

		await act(async () => {
			await store.translations.common.load('ru');
		});

		expect(result.current.locale).toBe('ru');
		expect(result.current.translation).toEqual({ message: 'Привет' });
		expect(result.current.currentTranslation).toEqual({ message: 'Hello' });
		expect(result.current.currentLocale).toBe('en');
	});

	it('does not start loads, keeps unchanged snapshots stable, and cleans up subscriptions', async () => {
		const store = createStore();
		await store.translations.common.load('en');
		const loadSpy = vi.spyOn(store.translations.common, 'load');
		const removeLocaleListenerSpy = vi.spyOn(store, 'removeChangeLocaleListener');
		const unsubscribeTranslationState = vi.fn();
		const subscribeTranslationState = store.subscribeTranslationState;
		vi.spyOn(store, 'subscribeTranslationState').mockImplementation((listener) => {
			const unsubscribe = subscribeTranslationState(listener);
			return () => {
				unsubscribeTranslationState();
				unsubscribe();
			};
		});
		const { result, rerender, unmount } = renderHook(() => useTypedTranslationState('common'), {
			wrapper: createWrapper(store),
		});
		const initialSnapshot = result.current;

		rerender();
		expect(result.current).toBe(initialSnapshot);
		expect(loadSpy).not.toHaveBeenCalled();

		await act(async () => {
			await store.translations.common.load('en');
		});
		expect(result.current).toBe(initialSnapshot);
		expect(loadSpy).toHaveBeenCalledTimes(1);

		unmount();
		expect(removeLocaleListenerSpy).toHaveBeenCalledTimes(1);
		expect(unsubscribeTranslationState).toHaveBeenCalledTimes(1);
	});

	it('infers the namespace translation and locale unions through a typed wrapper', () => {
		const store = createStore();
		const { result } = renderHook(() => useTypedTranslationState('common'), {
			wrapper: createWrapper(store),
		});

		expectTypeOf(result.current).toMatchTypeOf<I18nTranslationState<TranslationTypes['common'], keyof typeof locales>>();
		expectTypeOf(result.current.translation).toEqualTypeOf<TranslationTypes['common'] | undefined>();
		expectTypeOf(result.current.locale).toEqualTypeOf<keyof typeof locales>();
		expectTypeOf(result.current.currentLocale).toEqualTypeOf<keyof typeof locales | undefined>();
		if (!result.current.isError) {
			expectTypeOf(result.current.error).toEqualTypeOf<undefined>();
		}
	});
});
