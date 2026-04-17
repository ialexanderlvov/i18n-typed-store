import { describe, it, expect } from 'vitest';
import { createTranslationStore } from 'i18n-typed-store';
import { I18nModuleOptions, I18nService, runWithRequestLocale, getRequestLocale, setRequestLocale } from '../src';

describe('per-request locale context', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	const createService = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async (locale) => {
				if (locale === 'en') return { greeting: 'Hello' };
				if (locale === 'ru') return { greeting: 'Привет' };
				return {};
			},
			extractTranslation: (m) => m,
			defaultLocale: 'en',
		});
		const store = storeFactory.type<{ common: { greeting: string } }>();
		return new I18nService(store, { store } as I18nModuleOptions);
	};

	it('returns undefined outside a scope', () => {
		expect(getRequestLocale()).toBeUndefined();
	});

	it('isolates locales between concurrent scopes', async () => {
		const service = createService();
		await service.loadTranslation('common', 'en');
		await service.loadTranslation('common', 'ru');

		const a = (async () => {
			return runWithRequestLocale('ru', async () => {
				await new Promise((r) => setTimeout(r, 0));
				return service.getTranslationByKey('common.greeting');
			});
		})();
		const b = (async () => {
			return runWithRequestLocale('en', async () => {
				await new Promise((r) => setTimeout(r, 0));
				return service.getTranslationByKey('common.greeting');
			});
		})();

		const [ra, rb] = await Promise.all([a, b]);
		expect(ra).toBe('Привет');
		expect(rb).toBe('Hello');
	});

	it('falls back to store.currentLocale when no request locale is set', () => {
		const service = createService();
		expect(service.getLocale()).toBe('en');
	});

	it('setRequestLocale updates the active scope', () => {
		runWithRequestLocale('en', () => {
			expect(getRequestLocale()).toBe('en');
			setRequestLocale('ru');
			expect(getRequestLocale()).toBe('ru');
		});
	});

	it('setRequestLocale is a no-op outside a scope', () => {
		setRequestLocale('ru');
		expect(getRequestLocale()).toBeUndefined();
	});

	it('explicit locale argument always wins over request locale', async () => {
		const service = createService();
		await service.loadTranslation('common', 'en');
		await service.loadTranslation('common', 'ru');

		runWithRequestLocale('ru', () => {
			expect(service.getTranslationByKey('common.greeting')).toBe('Привет');
			expect(service.getTranslationByKey('common.greeting', 'en')).toBe('Hello');
		});
	});
});
