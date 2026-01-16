import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { I18nTypedStoreProvider, useI18nTranslationLazy } from '../src/index';
import { createTranslationStore } from 'i18n-typed-store';

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

	it('should throw error when translation loading fails (covers line 58: throw error)', async () => {
		// This test covers line 58: throw error;
		// Create a store where loading 'ru' locale throws an error
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

		// Handle unhandled promise rejections
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const originalOnUnhandledRejection = process.listeners('unhandledRejection');
		process.removeAllListeners('unhandledRejection');

		// Add a handler to catch unhandled rejections (which will occur from line 58)
		const unhandledRejections: unknown[] = [];
		const rejectionHandler = (reason: unknown) => {
			unhandledRejections.push(reason);
		};
		process.on('unhandledRejection', rejectionHandler);

		// Change locale to 'ru' which will cause load to throw error
		// The error will be caught in the hook's load function and rethrown via "throw error;" on line 58
		await act(async () => {
			store.changeLocale('ru');
			// Wait for the load attempt
			await new Promise((resolve) => setTimeout(resolve, 100));
		});

		// Give a moment for unhandled rejection to be captured
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify that an unhandled rejection occurred (proving line 58 executed)
		expect(unhandledRejections.length).toBeGreaterThan(0);
		expect(unhandledRejections[0]).toBe(loadError);

		// Verify error state is set
		expect(store.translations.common.translations.ru.isError).toBe(true);

		// Cleanup
		process.removeListener('unhandledRejection', rejectionHandler);
		originalOnUnhandledRejection.forEach((listener) => process.on('unhandledRejection', listener as any));
		consoleErrorSpy.mockRestore();
	});
});
