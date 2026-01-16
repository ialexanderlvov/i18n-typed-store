import { useContext } from 'react';
import { I18nTypedStoreContext } from './I18nTypedStoreProvider';
import { II18nTypedStoreContext } from '../types/context';

/**
 * Hook for accessing the I18n typed store context.
 * Must be used within an I18nTypedStoreProvider.
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template M - Type of translation modules mapping
 *
 * @returns I18n typed store context value
 * @throws Error if used outside of I18nTypedStoreProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { store, suspenseMode } = useI18nTypedStoreContext();
 *   // Use store, suspenseMode
 * }
 * ```
 */
export const useI18nTypedStoreContext = <
	N extends Record<string, string>,
	L extends Record<string, string>,
	M extends { [K in keyof N]: any },
>(): II18nTypedStoreContext<N, L, M> => {
	const context = useContext(I18nTypedStoreContext);
	if (!context) {
		throw new Error('useI18nTypedStoreContext must be used within I18nTypedStoreProvider');
	}
	return context as II18nTypedStoreContext<N, L, M>;
};
