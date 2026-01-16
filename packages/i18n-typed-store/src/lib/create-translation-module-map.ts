import type { TranslationModuleMap } from '../types/create-translation-module-map.js';
import { validateNonEmptyObject, validateFunction } from './validate.js';

/**
 * Creates a map of translation module loaders for all combinations of namespaces and locales.
 * This map is used internally by the translation store to lazy-load translation modules.
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template Module - Type of the raw module loaded from the module loader
 *
 * @param namespaces - Object with namespace keys
 * @param locales - Object with locale keys
 * @param loadModule - Function to load a translation module for a specific locale and namespace
 * @returns Immutable map where each namespace key contains an object with loader functions for each locale
 * @throws {TypeError} If namespaces or locales are empty objects
 *
 * @example
 * ```ts
 * const namespaces = { common: 'common', errors: 'errors' } as const;
 * const locales = { en: 'en', ru: 'ru' } as const;
 * const loadModule = async (locale, namespace) => import(`./${namespace}/${locale}.json`);
 *
 * const moduleMap = createTranslationModuleMap(namespaces, locales, loadModule);
 * moduleMap.common.en() will load './common/en.json'
 * moduleMap.errors.ru() will load './errors/ru.json'
 * ```
 */
export const createTranslationModuleMap = <N extends Record<string, string>, L extends Record<string, string>, Module = unknown>(
	namespaces: N,
	locales: L,
	loadModule: (locale: keyof L, namespace: keyof N) => Promise<Module>,
): TranslationModuleMap<N, L, Module> => {
	validateNonEmptyObject(namespaces, 'namespaces');
	validateNonEmptyObject(locales, 'locales');
	validateFunction(loadModule, 'loadModule');

	const namespaceModules = {} as Record<keyof N, Record<keyof L, () => Promise<Module>>>;

	for (const namespaceKey of Object.keys(namespaces) as (keyof N)[]) {
		namespaceModules[namespaceKey] = {} as Record<keyof L, () => Promise<Module>>;

		for (const localeKey of Object.keys(locales) as (keyof L)[]) {
			namespaceModules[namespaceKey][localeKey] = () => loadModule(localeKey, namespaceKey);
		}
	}

	return namespaceModules as TranslationModuleMap<N, L, Module>;
};
