import { createTranslationModuleMap } from './create-translation-module-map';

/**
 * Creates a translation store with typed translations for different locales.
 *
 * @param translations - Object with translation keys
 * @param locales - Object with locale keys
 * @param loadModule - Function to load a translation module
 * @param extractTranslation - Function to extract translation data from the loaded module.
 *   Receives three parameters: (module, locale, translation) allowing for locale-specific
 *   or translation-specific extraction logic.
 * @returns Object with a type() method for creating a typed translation store
 */
export const createTranslationStore = <T extends Record<string, string>, L extends Record<string, string>, Module = unknown>(
	translations: T,
	locales: L,
	loadModule: (locale: keyof L, translation: keyof T) => Promise<Module>,
	extractTranslation: (module: Module, locale: keyof L, translation: keyof T) => unknown,
) => {
	return {
		/**
		 * Creates a typed translation store.
		 *
		 * @template M - Type of translation object where each key corresponds to a key from translations
		 * @returns Store with methods to load translations for each locale
		 */
		type: <M extends { [K in keyof T]: any }>() => {
			const translationModuleMap = createTranslationModuleMap(translations, locales, loadModule);

			type TranslationStore = {
				[K in keyof T]: {
					translation?: M[K];
					load: (locale: keyof L) => Promise<void>;
				};
			};

			const store = {} as TranslationStore;

			for (const translationKey of Object.keys(translations) as (keyof T)[]) {
				store[translationKey] = {
					translation: undefined,
					load: async (locale: keyof L) => {
						const moduleLoader = translationModuleMap[translationKey][locale];
						const loadedModule = await moduleLoader();
						store[translationKey].translation = extractTranslation(
							loadedModule,
							locale,
							translationKey,
						) as M[typeof translationKey];
					},
				};
			}

			return store;
		},
	};
};
