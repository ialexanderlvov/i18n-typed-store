import { act, render, screen, waitFor } from '@testing-library/react';
import { createTranslationStore, LocaleLoadError } from 'i18n-typed-store';
import { describe, expect, it, vi } from 'vitest';
import { I18nTypedStoreProvider, useI18nTranslation, useI18nTranslationLazy } from '../src/index';

describe('React hooks with atomic locale transitions', () => {
	it('keeps committed translations visible when an atomic refresh only partially succeeds', async () => {
		const namespaces = { common: 'common', errors: 'errors' } as const;
		const locales = { en: 'en' } as const;
		type Messages = {
			common: { value: string };
			errors: { value: string };
		};
		let revision = 'old';
		let shouldFailErrors = false;
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (_locale, namespace) => {
				if (namespace === 'errors' && shouldFailErrors) throw new Error('errors refresh failed');
				return { value: `${String(namespace)}:${revision}` };
			},
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();

		await store.changeLocaleAsync('en', { fromCache: false });

		const Consumer = () => {
			const translation = useI18nTranslation<typeof namespaces, typeof locales, Messages, typeof namespaces.common>('common');
			const lazyTranslation = useI18nTranslationLazy<typeof namespaces, typeof locales, Messages, typeof namespaces.common>('common');

			return <div data-testid="translations">{`${translation?.value}|${lazyTranslation.value}`}</div>;
		};

		render(
			<I18nTypedStoreProvider store={store}>
				<Consumer />
			</I18nTypedStoreProvider>,
		);
		expect(screen.getByTestId('translations').textContent).toBe('common:old|common:old');

		revision = 'new';
		shouldFailErrors = true;
		let transitionError: unknown;
		await act(async () => {
			try {
				await store.changeLocaleAsync('en', { fromCache: false });
			} catch (error) {
				transitionError = error;
			}
		});

		expect(transitionError).toBeInstanceOf(LocaleLoadError);
		expect(store.translations.common.translations.en.namespace).toEqual({ value: 'common:new' });
		expect(store.translations.common.currentTranslation).toEqual({ value: 'common:old' });
		expect(screen.getByTestId('translations').textContent).toBe('common:old|common:old');
	});

	it('does not force a second namespace refresh after an atomic commit', async () => {
		const namespaces = { common: 'common', errors: 'errors' } as const;
		const locales = { en: 'en', ru: 'ru' } as const;
		type Messages = {
			common: { value: string };
			errors: { value: string };
		};
		const loadModule = vi.fn(async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => ({
			value: `${String(namespace)}:${String(locale)}`,
		}));
		const store = createTranslationStore({
			namespaces,
			locales,
			loadModule,
			extractTranslation: (module) => module,
			defaultLocale: 'en',
		}).type<Messages>();

		await store.changeLocaleAsync('en', { fromCache: false });

		const Consumer = () => {
			const common = useI18nTranslation<typeof namespaces, typeof locales, Messages, 'common'>('common', false);
			const errors = useI18nTranslationLazy<typeof namespaces, typeof locales, Messages, 'errors'>('errors', false);
			return <div data-testid="atomic-values">{`${common?.value}|${errors.value}`}</div>;
		};

		render(
			<I18nTypedStoreProvider store={store} suspenseMode="once">
				<Consumer />
			</I18nTypedStoreProvider>,
		);

		// Both hooks deliberately force one refresh when they subscribe. Wait for
		// that independent work before measuring the locale transaction itself.
		await waitFor(() => {
			expect(store.translations.common.translations.en.isLoading).toBe(false);
			expect(store.translations.errors.translations.en.isLoading).toBe(false);
			expect(screen.getByTestId('atomic-values')).toHaveTextContent('common:en|errors:en');
		});
		loadModule.mockClear();

		await act(async () => {
			await store.changeLocaleAsync('ru', { fromCache: false });
		});

		expect(loadModule).toHaveBeenCalledTimes(2);
		expect(loadModule.mock.calls).toEqual(
			expect.arrayContaining([
				['ru', 'common'],
				['ru', 'errors'],
			]),
		);
		expect(store.translations.common.translations.ru.isLoading).toBe(false);
		expect(store.translations.errors.translations.ru.isLoading).toBe(false);
		expect(screen.getByTestId('atomic-values')).toHaveTextContent('common:ru|errors:ru');

		// A microtask after the resolved transition must not reveal a post-commit
		// background refresh started by either hook.
		await act(async () => {
			await Promise.resolve();
		});
		expect(loadModule).toHaveBeenCalledTimes(2);
		expect(store.translations.common.translations.ru.isLoading).toBe(false);
		expect(store.translations.errors.translations.ru.isLoading).toBe(false);
	});

	it.each(['non-lazy', 'lazy'] as const)(
		'forces a post-commit refresh for the %s hook when an atomic change only reused cache',
		async (hookKind) => {
			const namespaces = { common: 'common' } as const;
			const locales = { en: 'en', ru: 'ru' } as const;
			type Messages = { common: { value: string } };
			const revisions = { en: 0, ru: 0 };
			const loadModule = vi.fn(async (locale: keyof typeof locales) => ({
				value: `${String(locale)}:v${String(++revisions[locale])}`,
			}));
			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			}).type<Messages>();

			await store.changeLocaleAsync('en', { fromCache: false });
			await store.preloadLocale('ru');
			expect(store.translations.common.translations.ru.namespace).toEqual({ value: 'ru:v1' });

			const NonLazyConsumer = () => {
				const translation = useI18nTranslation<typeof namespaces, typeof locales, Messages, 'common'>('common', false);
				return <div data-testid="cached-atomic-value">{translation?.value}</div>;
			};
			const LazyConsumer = () => {
				const translation = useI18nTranslationLazy<typeof namespaces, typeof locales, Messages, 'common'>('common', false);
				return <div data-testid="cached-atomic-value">{translation.value}</div>;
			};
			const Consumer = hookKind === 'non-lazy' ? NonLazyConsumer : LazyConsumer;
			render(
				<I18nTypedStoreProvider store={store} suspenseMode="once">
					<Consumer />
				</I18nTypedStoreProvider>,
			);
			await waitFor(() => {
				expect(screen.getByTestId('cached-atomic-value')).toHaveTextContent('en:v2');
			});
			loadModule.mockClear();

			await act(async () => {
				await store.changeLocaleAsync('ru');
			});
			await waitFor(() => {
				expect(screen.getByTestId('cached-atomic-value')).toHaveTextContent('ru:v2');
			});

			expect(loadModule).toHaveBeenCalledOnce();
			expect(loadModule).toHaveBeenCalledWith('ru', 'common');
			expect(store.translations.common.translations.ru.isLoading).toBe(false);
		},
	);

	it.each([
		['non-lazy', 'before'],
		['non-lazy', 'after'],
		['lazy', 'before'],
		['lazy', 'after'],
	] as const)(
		'activates a preloaded excluded namespace for the %s hook mounted %s a scoped atomic commit',
		async (hookKind, mountTiming) => {
			const namespaces = { common: 'common', errors: 'errors' } as const;
			const locales = { en: 'en', ru: 'ru' } as const;
			type Messages = {
				common: { value: string };
				errors: { value: string };
			};
			const loadModule = vi.fn(async (locale: keyof typeof locales, namespace: keyof typeof namespaces) => ({
				value: `${String(namespace)}:${String(locale)}`,
			}));
			const store = createTranslationStore({
				namespaces,
				locales,
				loadModule,
				extractTranslation: (module) => module,
				defaultLocale: 'en',
			}).type<Messages>();

			await store.changeLocaleAsync('en', { fromCache: false });
			await store.preloadLocale('ru', { namespaces: ['errors'] });
			expect(store.translations.errors.translations.ru.namespace).toEqual({ value: 'errors:ru' });
			expect(store.translations.errors.currentLocale).toBe('en');

			const NonLazyConsumer = () => {
				const translation = useI18nTranslation<typeof namespaces, typeof locales, Messages, 'errors'>('errors');
				return <div data-testid="excluded-value">{translation?.value}</div>;
			};
			const LazyConsumer = () => {
				const translation = useI18nTranslationLazy<typeof namespaces, typeof locales, Messages, 'errors'>('errors');
				return <div data-testid="excluded-value">{translation.value}</div>;
			};
			const Consumer = hookKind === 'non-lazy' ? NonLazyConsumer : LazyConsumer;
			const renderConsumer = () =>
				render(
					<I18nTypedStoreProvider store={store} suspenseMode="once">
						<Consumer />
					</I18nTypedStoreProvider>,
				);

			const errorsLoadSpy = vi.spyOn(store.translations.errors, 'load');
			loadModule.mockClear();
			if (mountTiming === 'before') {
				renderConsumer();
				expect(screen.getByTestId('excluded-value')).toHaveTextContent('errors:en');
				await act(async () => {
					await store.changeLocaleAsync('ru', { namespaces: ['common'] });
				});
			} else {
				await store.changeLocaleAsync('ru', { namespaces: ['common'] });
				renderConsumer();
			}

			await waitFor(() => {
				expect(screen.getByTestId('excluded-value')).toHaveTextContent('errors:ru');
			});
			expect(loadModule).toHaveBeenCalledOnce();
			expect(loadModule).toHaveBeenCalledWith('ru', 'common');
			expect(errorsLoadSpy).toHaveBeenCalledWith('ru', true);
			expect(store.translations.errors.currentLocale).toBe('ru');
			expect(store.translations.errors.currentTranslation).toEqual({ value: 'errors:ru' });
		},
	);
});
