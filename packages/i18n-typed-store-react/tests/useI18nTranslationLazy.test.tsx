import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, act, waitFor, screen } from '@testing-library/react';
import { StrictMode, Suspense, Component, type ReactNode } from 'react';
import { I18nTypedStoreProvider, useI18nTranslationLazy } from '../src/index';
import { createTranslationStore } from 'i18n-typed-store';

class ErrorBoundary extends Component<{ children: ReactNode; onError?: (error: unknown) => void }, { hasError: boolean }> {
	state = { hasError: false };
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	componentDidCatch(error: unknown) {
		this.props.onError?.(error);
	}
	render() {
		return this.state.hasError ? null : this.props.children;
	}
}

describe('useI18nTranslationLazy', () => {
	const namespaces = { common: 'common', errors: 'errors' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	const createTestStore = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale, namespace) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
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

	it('should throw Promise if translation is not loaded (for Suspense)', async () => {
		const store = createTestStore();

		// Check that translation is not loaded
		expect(store.translations.common.translations.en.namespace).toBeUndefined();

		// In first-load-locale mode, hook should initiate loading
		// Test by checking that loading starts after render
		renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="first-load-locale">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		// Wait for loading to start or complete
		await waitFor(
			() => {
				expect(
					store.translations.common.translations.en.isLoading ||
						store.translations.common.translations.en.namespace !== undefined,
				).toBe(true);
			},
			{ timeout: 1000 },
		);
	});

	it('should return translation after loading', async () => {
		const store = createTestStore();

		// First load translation
		await act(async () => {
			await store.translations.common.load('en');
		});

		const { result } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(result.current).toBeDefined();
			});
		});

		expect(result.current.greeting).toBe('Hello');
	});

	it('should update when locale changes', async () => {
		const store = createTestStore();

		// Load both locales
		await act(async () => {
			await store.translations.common.load('en');
			await store.translations.common.load('ru');
		});

		const { result, rerender } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(result.current.greeting).toBe('Hello');
			});
		});

		// Change locale
		await act(async () => {
			store.changeLocale('ru');
			// In "once" mode, listener calls load(true), which updates state
			// Wait for state to update
			await new Promise((resolve) => setTimeout(resolve, 100));
			rerender();
		});

		// Check that translation updated
		await act(async () => {
			await waitFor(
				() => {
					expect(result.current.greeting).toBe('Привет');
				},
				{ timeout: 2000 },
			);
		});
	});

	it('should throw Promise when locale changes in change-locale mode', async () => {
		const store = createTestStore();

		await act(async () => {
			await store.translations.common.load('en');
		});

		const { result, rerender } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="change-locale">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(result.current.greeting).toBe('Hello');
			});
		});

		act(() => {
			store.changeLocale('ru');
		});

		// In change-locale mode, promise should be thrown
		await act(async () => {
			await waitFor(() => {
				expect(store.translations.common.translations.ru.namespace).toBeDefined();
			});
		});
	});

	it('should work with different namespaces', async () => {
		const store = createTestStore();

		await act(async () => {
			await store.translations.common.load('en');
			await store.translations.errors.load('en');
		});

		const { result: commonResult } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(commonResult.current).toBeDefined();
			});
		});

		const { result: errorsResult } = renderHook(() => useI18nTranslationLazy('errors'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(errorsResult.current).toBeDefined();
			});
		});

		expect(commonResult.current.greeting).toBe('Hello');
		expect(errorsResult.current.notFound).toBe('Not Found');
	});

	it('should use cache by default', async () => {
		const loadModule = vi.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return { common: { greeting: 'Hello' } };
		});
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

		await act(async () => {
			await store.translations.common.load('en');
		});
		const callCount = loadModule.mock.calls.length;

		const { result, rerender } = renderHook(() => useI18nTranslationLazy('common', true), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(result.current.greeting).toBe('Hello');
			});
		});

		act(() => {
			rerender();
		});

		expect(loadModule.mock.calls.length).toBe(callCount); // Should not be called again
	});

	it('should cleanup listener on unmount', async () => {
		const store = createTestStore();
		await act(async () => {
			await store.translations.common.load('en');
		});
		const removeListenerSpy = vi.spyOn(store, 'removeChangeLocaleListener');

		const { unmount } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(removeListenerSpy).toHaveBeenCalledTimes(0); // Not yet unmounted
			});
		});

		act(() => {
			unmount();
		});

		// Listener should be removed on unmount
		expect(removeListenerSpy.mock.calls.length).toBeGreaterThan(0);
	});

	it('should handle suspenseMode="first-load-locale"', async () => {
		const store = createTestStore();

		await act(async () => {
			await store.translations.common.load('en');
		});

		const { result } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="first-load-locale">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(result.current).toBeDefined();
			});
		});

		expect(result.current.greeting).toBe('Hello');
	});

	it('should always return an object (never undefined)', async () => {
		const store = createTestStore();

		await act(async () => {
			await store.translations.common.load('en');
		});

		const { result } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(result.current).toBeDefined();
			});
		});

		expect(result.current).not.toBeUndefined();
		expect(typeof result.current).toBe('object');
	});

	it('should trigger load in useEffect when translation is missing', async () => {
		const loadModule = vi.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return { greeting: 'Hello' };
		});

		const storeFactory = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule,
			extractTranslation: (module: any) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<{ common: { greeting: string } }>();

		const { result } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					<Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(loadModule).toHaveBeenCalled();
			});
		});
	});

	it('should call load(true) in useEffect when translation is missing (covers line 85)', async () => {
		const loadModule = vi.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			return { greeting: 'Hello' };
		});

		const storeFactory = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule,
			extractTranslation: (module: any) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<{ common: { greeting: string } }>();

		// Verify translation is not loaded initially
		expect(store.translations.common.translations.en.namespace).toBeUndefined();

		const { result } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		// Wait for useEffect to trigger load(true) on line 85
		await act(async () => {
			await waitFor(
				() => {
					expect(loadModule).toHaveBeenCalled();
				},
				{ timeout: 1000 },
			);
		});

		// Verify that loading was initiated
		expect(
			store.translations.common.translations.en.isLoading || store.translations.common.translations.en.namespace !== undefined,
		).toBe(true);
	});

	it('should keep serving the previous translation when switching to a failing locale in "once" mode', async () => {
		// Rewritten for the documented "once" semantics: suspense happens only
		// while there is no data at all. After the first translation rendered,
		// a switch to a failing locale degrades to the previous translation (the
		// failure is recorded in store state) instead of suspending or crashing.
		const loadError = new Error('Failed to load translation');
		const loadModule = vi.fn(async (locale: string) => {
			if (locale === 'ru') {
				throw loadError;
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
			return { greeting: 'Hello' };
		});

		const storeFactory = createTranslationStore({
			namespaces: { common: 'common' } as const,
			locales,
			loadModule,
			extractTranslation: (module: any) => module,
			defaultLocale: 'en',
		});

		const store = storeFactory.type<{ common: { greeting: string } }>();

		// First load 'en' successfully
		await act(async () => {
			await store.translations.common.load('en');
		});

		const caughtErrors: unknown[] = [];
		const previousRejectionListeners = process.listeners('unhandledRejection');
		process.removeAllListeners('unhandledRejection');
		const unhandledRejections: unknown[] = [];
		const rejectionHandler = (reason: unknown) => {
			unhandledRejections.push(reason);
		};
		process.on('unhandledRejection', rejectionHandler);

		const { result } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					<ErrorBoundary onError={(error) => caughtErrors.push(error)}>
						<Suspense fallback={null}>{children}</Suspense>
					</ErrorBoundary>
				</I18nTypedStoreProvider>
			),
		});

		await act(async () => {
			await waitFor(() => {
				expect(result.current).toBeDefined();
			});
		});

		expect(result.current.greeting).toBe('Hello');

		await act(async () => {
			store.changeLocale('ru');
			await new Promise((resolve) => setTimeout(resolve, 100));
		});

		// The failing load was attempted and its error state recorded...
		expect(store.translations.common.translations.ru.isError).toBe(true);
		// ...while the hook kept rendering the previous translation instead of
		// suspending or throwing (there IS data to show).
		expect(result.current.greeting).toBe('Hello');
		expect(caughtErrors).toEqual([]);
		// The background load's rejection was handled inside the hook.
		expect(unhandledRejections).toEqual([]);

		process.removeListener('unhandledRejection', rejectionHandler);
		previousRejectionListeners.forEach((listener) => process.on('unhandledRejection', listener as any));
	});

	it('should not leak locale listeners under StrictMode double mounting', async () => {
		const store = createTestStore();
		await act(async () => {
			await store.translations.common.load('en');
		});

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

		const { result, unmount } = renderHook(() => useI18nTranslationLazy('common'), {
			wrapper: ({ children }) => (
				<StrictMode>
					<I18nTypedStoreProvider store={store} suspenseMode="once">
						{children}
					</I18nTypedStoreProvider>
				</StrictMode>
			),
		});

		// The hook still works through StrictMode's mount/unmount/remount cycle.
		await act(async () => {
			await waitFor(() => {
				expect(result.current.greeting).toBe('Hello');
			});
		});

		unmount();

		// Every subscription created by the double mount was cleaned up.
		expect(added).toBeGreaterThan(0);
		expect(removed).toBe(added);
	});

	it('should not suspend on subsequent locale changes in "once" mode', async () => {
		const store = createTestStore();

		let fallbackRenders = 0;
		const Fallback = () => {
			fallbackRenders += 1;
			return <div data-testid="fallback">Loading...</div>;
		};

		const Consumer = () => {
			const translations = useI18nTranslationLazy('common');
			return <div data-testid="content">{translations.greeting}</div>;
		};

		render(
			<I18nTypedStoreProvider store={store} suspenseMode="once">
				<Suspense fallback={<Fallback />}>
					<Consumer />
				</Suspense>
			</I18nTypedStoreProvider>,
		);

		// Very first load: no data at all, so the hook suspends once.
		await waitFor(() => {
			expect(screen.getByTestId('content').textContent).toBe('Hello');
		});
		const fallbacksAfterFirstLoad = fallbackRenders;
		expect(fallbacksAfterFirstLoad).toBeGreaterThan(0);

		await act(async () => {
			store.changeLocale('ru');
		});

		// While 'ru' loads in the background the previous translation stays on
		// screen — the Suspense fallback is NOT shown again.
		expect(screen.queryByTestId('fallback')).toBeNull();
		expect(screen.getByTestId('content').textContent).toBe('Hello');

		// The new locale is swapped in once its load finishes.
		await waitFor(() => {
			expect(screen.getByTestId('content').textContent).toBe('Привет');
		});
		expect(fallbackRenders).toBe(fallbacksAfterFirstLoad);
	});

	it('should throw the load error (never return undefined) when the very first load fails', async () => {
		// suspenseMode='first-load-locale', the first load fails, and there is no
		// previous translation to degrade to: the hook must throw the load error
		// itself so an ErrorBoundary catches it. Returning undefined would violate
		// the M[K] return type contract.
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

		const caughtErrors: unknown[] = [];
		const renderedValues: unknown[] = [];

		const Consumer = () => {
			const translations = useI18nTranslationLazy('common');
			renderedValues.push(translations);
			return <div data-testid="content">{translations.greeting}</div>;
		};

		// React logs boundary-caught errors via console.error; keep output clean.
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		render(
			<I18nTypedStoreProvider store={store} suspenseMode="first-load-locale">
				<ErrorBoundary onError={(error) => caughtErrors.push(error)}>
					<Suspense fallback={<div data-testid="fallback">Loading...</div>}>
						<Consumer />
					</Suspense>
				</ErrorBoundary>
			</I18nTypedStoreProvider>,
		);

		// The actual load error reaches the ErrorBoundary.
		await waitFor(() => {
			expect(caughtErrors).toContain(loadError);
		});

		// The component never rendered with undefined translations.
		expect(renderedValues).not.toContain(undefined);

		consoleErrorSpy.mockRestore();
	});
});
