import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { I18nTypedStoreProvider, useI18nLocale } from '../src/index';
import { renderToString } from 'react-dom/server';
import { createTranslationStore } from 'i18n-typed-store';

describe('useI18nLocale', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru', de: 'de' } as const;

	const createTestStore = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async () => ({}),
			extractTranslation: () => ({}),
			defaultLocale: 'en',
		});

		return storeFactory.type<{ common: { greeting: string } }>();
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return current locale from store', () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nLocale(), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		expect(result.current.locale).toBe('en');
	});

	it('should provide setLocale function', () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nLocale(), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		expect(typeof result.current.setLocale).toBe('function');
	});

	it('should update locale when setLocale is called', async () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nLocale(), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		expect(result.current.locale).toBe('en');

		act(() => {
			result.current.setLocale('ru');
		});

		await waitFor(() => {
			expect(result.current.locale).toBe('ru');
		});

		expect(store.currentLocale).toBe('ru');
	});

	it('should update when locale changes through store.changeLocale', async () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nLocale(), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		expect(result.current.locale).toBe('en');

		act(() => {
			store.changeLocale('de');
		});

		await waitFor(() => {
			expect(result.current.locale).toBe('de');
		});
	});

	it('should support multiple locale changes', async () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nLocale(), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		act(() => {
			result.current.setLocale('ru');
		});

		await waitFor(() => {
			expect(result.current.locale).toBe('ru');
		});

		act(() => {
			result.current.setLocale('de');
		});

		await waitFor(() => {
			expect(result.current.locale).toBe('de');
		});

		act(() => {
			result.current.setLocale('en');
		});

		await waitFor(() => {
			expect(result.current.locale).toBe('en');
		});
	});

	it('should cleanup listener on unmount', () => {
		const store = createTestStore();
		const removeListenerSpy = vi.spyOn(store, 'removeChangeLocaleListener');

		const { unmount } = renderHook(() => useI18nLocale(), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		unmount();

		expect(removeListenerSpy).toHaveBeenCalled();
	});

	it('should use server snapshot for SSR (covers line 43: getServerSnapshot)', () => {
		// This test covers line 43: getServerSnapshot function
		// getServerSnapshot is called during server-side rendering
		const store = createTestStore();

		// Create a component that uses the hook
		const TestComponent = () => {
			const { locale } = useI18nLocale();
			return <div data-testid="locale">{String(locale)}</div>;
		};

		// Render on server using renderToString - this will call getServerSnapshot
		const html = renderToString(
			<I18nTypedStoreProvider store={store}>
				<TestComponent />
			</I18nTypedStoreProvider>,
		);

		// Verify that server snapshot was used (returns store.currentLocale)
		expect(html).toContain('en');
		expect(store.currentLocale).toBe('en');
	});

	describe('BCP 47 locale support', () => {
		it('should accept BCP 47 locale and find best match', async () => {
			const bcp47Locales = {
				en: 'en',
				ru: 'ru',
				'ru-RU': 'ru-RU',
				'en-US': 'en-US',
			} as const;

			const storeFactory = createTranslationStore({
				namespaces,
				locales: bcp47Locales,
				loadModule: async () => ({}),
				extractTranslation: () => ({}),
				defaultLocale: 'en',
			});

			const store = storeFactory.type<{ common: { greeting: string } }>();

			const { result } = renderHook(() => useI18nLocale(), {
				wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
			});

			// Test exact match
			act(() => {
				result.current.setLocale('ru-RU');
			});

			await waitFor(() => {
				expect(result.current.locale).toBe('ru-RU');
			});

			// Test fallback to language when region is not available
			act(() => {
				result.current.setLocale('ru-BY');
			});

			await waitFor(() => {
				expect(result.current.locale).toBe('ru');
			});

			// Test fallback to language when exact locale is not available
			act(() => {
				result.current.setLocale('en-GB');
			});

			await waitFor(() => {
				expect(result.current.locale).toBe('en');
			});

			// Test fallback to defaultLocale when no match found
			act(() => {
				result.current.setLocale('fr-FR');
			});

			await waitFor(() => {
				expect(result.current.locale).toBe('en');
			});
		});
	});
});
