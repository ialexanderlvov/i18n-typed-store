import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { I18nTypedStoreProvider, useI18nTypedStoreContext } from '../src/index';
import { createTranslationStore } from 'i18n-typed-store';

describe('useI18nTypedStoreContext', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

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

	it('should return context when used inside Provider', () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nTypedStoreContext(), {
			wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
		});

		expect(result.current.store).toBe(store);
		expect(result.current.suspenseMode).toBe('first-load-locale');
	});

	it('should throw error when used outside Provider', () => {
		expect(() => {
			renderHook(() => useI18nTypedStoreContext());
		}).toThrow('useI18nTypedStoreContext must be used within I18nTypedStoreProvider');
	});

	it('should use provided suspenseMode', () => {
		const store = createTestStore();

		const { result } = renderHook(() => useI18nTypedStoreContext(), {
			wrapper: ({ children }) => (
				<I18nTypedStoreProvider store={store} suspenseMode="change-locale">
					{children}
				</I18nTypedStoreProvider>
			),
		});

		expect(result.current.suspenseMode).toBe('change-locale');
	});

	it('should return correct store for different types', () => {
		const store = createTestStore();

		const { result } = renderHook(
			() => useI18nTypedStoreContext<typeof namespaces, typeof locales, { common: { greeting: string } }>(),
			{
				wrapper: ({ children }) => <I18nTypedStoreProvider store={store}>{children}</I18nTypedStoreProvider>,
			},
		);

		expect(result.current.store.currentLocale).toBe('en');
		expect(result.current.store.locales).toBe(locales);
		expect(result.current.store.translationsMap).toBe(namespaces);
	});
});
