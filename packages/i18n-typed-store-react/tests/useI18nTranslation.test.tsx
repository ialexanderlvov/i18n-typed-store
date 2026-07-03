import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, act, waitFor, screen } from '@testing-library/react';
import { StrictMode, startTransition } from 'react';
import { I18nTypedStoreProvider, useI18nTranslation, useI18nLocale } from '../src/index';
import { createTranslationStore } from 'i18n-typed-store';

describe('useI18nTranslation', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	const createTestStore = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => {
				if (locale === 'en') {
					if (namespace === 'common') return { greeting: 'Hello', button: 'Save' };
					if (namespace === 'errors') return { notFound: 'Not Found' };
				}
				if (locale === 'ru') {
					if (namespace === 'common') return { greeting: 'Привет' };
					if (namespace === 'errors') return { notFound: 'Не найдено' };
				}
				return {};
			},
			extractTranslation: (module: any) => module,
			defaultLocale: 'en',
		});

		return storeFactory.type<{ common: { greeting: string; button?: string }; errors: { notFound: string } }>();
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return undefined if translation is not yet loaded', async () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		// Initially may be undefined if translation is not loaded
		// Wait a bit for all effects to complete
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		// After loading, can be either undefined or already loaded translation
		expect(result.current === undefined || result.current?.greeting === 'Hello').toBe(true);
	});

	it('should load translation for current locale', async () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		await waitFor(() => {
			expect(result.current).toBeDefined();
		});

		expect(result.current?.greeting).toBe('Hello');
	});

	it('should update when locale changes', async () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		await waitFor(() => {
			expect(result.current).toBeDefined();
		});

		expect(result.current?.greeting).toBe('Hello');

		act(() => {
			store.changeLocale('ru');
		});

		await waitFor(() => {
			expect(result.current?.greeting).toBe('Привет');
		});
	});

	it('should use cache by default', async () => {
		const loadModule = vi.fn(async () => ({ common: { greeting: 'Hello' } }));
		const extractTranslation = vi.fn((module: any) => module.common);

		const storeFactory = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule,
			extractTranslation,
			defaultLocale: 'en',
			loadFromCache: true,
		});

		const store = storeFactory.type<{ common: { greeting: string } }>();

		const { result, rerender } = renderHook(() => useI18nTranslation('common', true), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		await waitFor(() => {
			expect(result.current).toBeDefined();
		});

		const callCount = loadModule.mock.calls.length;

		rerender();

		await waitFor(() => {
			expect(loadModule.mock.calls.length).toBe(callCount); // Should not be called again
		});
	});

	it('should work with different namespaces', async () => {
		const store = createTestStore();

		const { result: commonResult } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		const { result: errorsResult } = renderHook(() => useI18nTranslation('errors'), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		await waitFor(() => {
			expect(commonResult.current).toBeDefined();
			expect(errorsResult.current).toBeDefined();
		});

		expect(commonResult.current?.greeting).toBe('Hello');
		expect(errorsResult.current?.notFound).toBe('Not Found');
	});

	it('should cleanup listener on unmount', () => {
		const store = createTestStore();
		const removeListenerSpy = vi.spyOn(store, 'removeChangeLocaleListener');

		const { unmount } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		unmount();

		expect(removeListenerSpy).toHaveBeenCalled();
	});

	it('should update when suspenseMode changes', async () => {
		const store = createTestStore();

		let suspenseMode: 'once' | 'first-load-locale' | 'change-locale' = 'first-load-locale';

		const { result, rerender } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode={suspenseMode}>
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await waitFor(() => {
			expect(result.current).toBeDefined();
		});

		suspenseMode = 'change-locale';
		rerender();

		await waitFor(() => {
			expect(result.current).toBeDefined();
		});
	});

	it('should keep returning undefined and record the error state when loading fails', async () => {
		// Rewritten for the useSyncExternalStore implementation: the hook now
		// handles the load rejection internally (the failure is reflected in the
		// store's `isError` flag) instead of leaking it as an unhandled promise
		// rejection like the old useEffect-based implementation did.
		const loadError = new Error('Failed to load translation');
		const loadModule = vi.fn(async () => {
			throw loadError;
		});

		const storeFactory = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule,
			extractTranslation: (module: any) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<{ common: { greeting: string } }>();

		const previousRejectionListeners = process.listeners('unhandledRejection');
		process.removeAllListeners('unhandledRejection');
		const unhandledRejections: unknown[] = [];
		const rejectionHandler = (reason: unknown) => {
			unhandledRejections.push(reason);
		};
		process.on('unhandledRejection', rejectionHandler);

		const { result } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		// Wait for the subscription to attempt (and fail) the load.
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100));
		});

		// The failing load was attempted, its error state recorded, and the hook
		// keeps returning undefined so consumers can render a fallback.
		expect(loadModule).toHaveBeenCalled();
		expect(store.translations.common.translations.en.isError).toBe(true);
		expect(result.current).toBeUndefined();

		// The rejection was handled inside the hook — no unhandled rejection leaks.
		expect(unhandledRejections).toEqual([]);

		process.removeListener('unhandledRejection', rejectionHandler);
		previousRejectionListeners.forEach((listener) => process.on('unhandledRejection', listener as any));
	});

	it('should not leak locale listeners under StrictMode double mounting', async () => {
		const store = createTestStore();

		// Count net subscriptions through the store's public listener API.
		let added = 0;
		let removed = 0;
		const originalAdd = store.addChangeLocaleListener;
		const originalRemove = store.removeChangeLocaleListener;
		store.addChangeLocaleListener = (listener) => {
			added += 1;
			originalAdd(listener);
		};
		store.removeChangeLocaleListener = (listener) => {
			removed += 1;
			originalRemove(listener);
		};

		const { result, unmount } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => (
				<StrictMode>
					<I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>
				</StrictMode>
			),
		});

		// The hook still works through StrictMode's mount/unmount/remount cycle.
		await waitFor(() => {
			expect(result.current?.greeting).toBe('Hello');
		});

		unmount();

		// Every subscription created by the double mount was cleaned up.
		expect(added).toBeGreaterThan(0);
		expect(removed).toBe(added);
	});

	it('should keep useI18nTranslation and useI18nLocale consistent when locale changes inside startTransition', async () => {
		const store = createTestStore();

		// Preload both locales so every render has data for its locale.
		await act(async () => {
			await store.translations.common.load('en');
			await store.translations.common.load('ru');
		});

		const observed: Array<{ locale: string; greeting: string | undefined }> = [];

		const Probe = () => {
			const { locale } = useI18nLocale();
			const translations = useI18nTranslation('common');
			observed.push({ locale: String(locale), greeting: translations?.greeting });
			return <div data-testid="probe">{`${String(locale)}:${translations?.greeting ?? ''}`}</div>;
		};

		render(
			<I18nTypedStoreProvider store={store}>
				<Probe />
			</I18nTypedStoreProvider>,
		);

		expect(screen.getByTestId('probe').textContent).toBe('en:Hello');

		await act(async () => {
			startTransition(() => {
				store.changeLocale('ru');
			});
		});

		await waitFor(() => {
			expect(screen.getByTestId('probe').textContent).toBe('ru:Привет');
		});

		// No torn frame was ever rendered: within a single render the locale from
		// useI18nLocale and the translation from useI18nTranslation always agree.
		for (const { locale, greeting } of observed) {
			expect(greeting).toBe(locale === 'ru' ? 'Привет' : 'Hello');
		}
	});
});
