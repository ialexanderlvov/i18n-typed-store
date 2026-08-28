import { createContext, useEffect, useMemo, type ReactNode } from 'react';
import { II18nTypedStoreContext, type ShouldThrowLoadError } from '../types/context';
import { TranslationStore } from 'i18n-typed-store';
import {
	getOrCreateSuspenseLoadOwner,
	mountSuspenseLoadOwner,
	releaseSuspenseLoadOwner,
	suspenseLoadOwnerKey,
} from './suspenseLoadRecords';

/**
 * React context for I18n typed store.
 * Used internally by hooks to access the translation store.
 */
export const I18nTypedStoreContext = createContext<II18nTypedStoreContext<any, any, any> | null>(null);

/**
 * Provider component for I18n typed store.
 * Wraps your application to provide translation store context to child components.
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template M - Type of translation modules mapping
 *
 * @param props - Provider props
 * @param props.store - Translation store instance
 * @param props.children - React children
 * @param props.suspenseMode - Suspense mode: 'once' | 'first-load-locale' | 'change-locale'
 * @param props.shouldThrowLoadError - Optional policy for surfacing lazy-load failures through an Error Boundary
 * @returns Provider component
 *
 * @example
 * ```tsx
 * const store = storeFactory.type<MyTranslations>();
 *
 * function App() {
 *   return (
 *     <I18nTypedStoreProvider store={store}>
 *       <MyComponent />
 *     </I18nTypedStoreProvider>
 *   );
 * }
 * ```
 */
export const I18nTypedStoreProvider = <
	N extends Record<string, string>,
	L extends Record<string, string>,
	M extends { [K in keyof N]: any },
>({
	store,
	children,
	suspenseMode = 'first-load-locale',
	shouldThrowLoadError,
}: {
	store: TranslationStore<N, L, M>;
	children: ReactNode;
	suspenseMode?: II18nTypedStoreContext<N, L, M>['suspenseMode'];
	shouldThrowLoadError?: ShouldThrowLoadError<N, L>;
}) => {
	const suspenseLoadOwner = useMemo(() => getOrCreateSuspenseLoadOwner(store), [store]);

	useEffect(() => {
		mountSuspenseLoadOwner(store, suspenseLoadOwner);
		return () => {
			releaseSuspenseLoadOwner(suspenseLoadOwner);
		};
	}, [store, suspenseLoadOwner]);

	// Memoise the context value so it keeps a stable identity across renders.
	// A fresh `{ store, suspenseMode }` object on every render would otherwise
	// re-trigger every context consumer in the tree on each parent re-render.
	const value = useMemo(
		() =>
			({
				store,
				suspenseMode,
				shouldThrowLoadError,
				[suspenseLoadOwnerKey]: suspenseLoadOwner,
			}) as II18nTypedStoreContext<N, L, M>,
		[store, suspenseMode, shouldThrowLoadError, suspenseLoadOwner],
	);

	return <I18nTypedStoreContext.Provider value={value}>{children}</I18nTypedStoreContext.Provider>;
};
