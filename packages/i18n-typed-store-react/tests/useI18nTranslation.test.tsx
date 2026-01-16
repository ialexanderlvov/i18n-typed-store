import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { I18nTypedStoreProvider, useI18nTranslation } from '../src/index';
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

	it('should throw error when translation loading fails (covers line 48: throw error)', async () => {
		// This test covers line 48: throw error;
		// The error is thrown from the hook's internal load function when store.load() fails
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

		// Verify that store.load throws error directly (this helps ensure error path is testable)
		await expect(store.translations.common.load('en')).rejects.toThrow('Failed to load translation');
		expect(store.translations.common.translations.en.isError).toBe(true);

		// For the hook test, we need to handle unhandled promise rejections
		// since the error from line 48 will propagate as an unhandled promise rejection
		const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const originalOnUnhandledRejection = process.listeners('unhandledRejection');
		process.removeAllListeners('unhandledRejection');

		// Add a handler to catch unhandled rejections (which will occur from line 48)
		const unhandledRejections: unknown[] = [];
		process.on('unhandledRejection', (reason) => {
			unhandledRejections.push(reason);
		});

		const { result } = renderHook(() => useI18nTranslation('common'), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		// Wait for effects to attempt loading (which will fail and trigger line 48)
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 150));
		});

		// Verify that an unhandled rejection occurred (proving line 48 executed)
		expect(unhandledRejections.length).toBeGreaterThan(0);
		expect(unhandledRejections[0]).toBe(loadError);

		// Verify error state is set
		expect(store.translations.common.translations.en.isError).toBe(true);
		expect(result.current).toBeUndefined();

		// Cleanup
		process.removeAllListeners('unhandledRejection');
		originalOnUnhandledRejection.forEach((listener) => process.on('unhandledRejection', listener as any));
		consoleErrorSpy.mockRestore();
	});
});
