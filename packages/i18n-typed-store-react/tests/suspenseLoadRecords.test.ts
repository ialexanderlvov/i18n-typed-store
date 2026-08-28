import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { createTranslationStore } from 'i18n-typed-store';
import { I18nTypedStoreProvider } from '../src/lib/I18nTypedStoreProvider';
import { useI18nTranslationLazy } from '../src/lib/useI18nTranslationLazy';
import {
	getOrCreateSuspenseLoadOwner,
	getSuspenseLoadRecord,
	markSuspenseLoadRecordSuccessful,
	replaceSuspenseLoadRecord,
} from '../src/lib/suspenseLoadRecords';

describe('Suspense load records', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('should expire a successful record when its suspended render never commits', () => {
		vi.useFakeTimers();
		const store = {};
		const localeState = {};
		const owner = getOrCreateSuspenseLoadOwner(store);
		const record = replaceSuspenseLoadRecord(localeState, owner);

		markSuspenseLoadRecordSuccessful(localeState, record, { greeting: 'Hello' });
		expect(getSuspenseLoadRecord(localeState, owner)).toBe(record);

		vi.advanceTimersByTime(30_000);

		expect(getSuspenseLoadRecord(localeState, owner)).toBeUndefined();
	});

	it('should not retain a successful Suspense record or expiry timer during a server render', async () => {
		vi.stubGlobal('window', undefined);
		const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		const namespaces = { common: 'common' } as const;
		const locales = { en: 'en' } as const;
		type Messages = { common: { greeting: string } };
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: async () => ({ greeting: 'Hello' }),
			extractTranslation: (module: { greeting: string }) => module,
			defaultLocale: 'en',
		}).type<Messages>();
		const Consumer = () => {
			const translation = useI18nTranslationLazy('common');
			return createElement('span', null, translation.greeting);
		};
		const TypedProvider = I18nTypedStoreProvider<typeof namespaces, typeof locales, Messages>;
		const provider = createElement(TypedProvider, {
			store,
			children: createElement(Consumer),
		});

		renderToString(createElement(Suspense, { fallback: 'Loading', children: provider }));
		await Promise.resolve();
		await store.translations.common.translations.en.loadingPromise;
		await Promise.resolve();

		const owner = getOrCreateSuspenseLoadOwner(store);
		expect(getSuspenseLoadRecord(store.translations.common.translations.en, owner)).toBeUndefined();
		expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 30_000)).toBe(false);
	});
});
