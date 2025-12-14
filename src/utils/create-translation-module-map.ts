/**
 * Creates a map of translation module loaders for all combinations of translations and locales.
 *
 * @param translations - Object with translation keys
 * @param locales - Object with locale keys
 * @param loadModule - Function to load a translation module for a specific locale and translation
 * @returns Map where each translation key contains an object with loader functions for each locale
 */
export const createTranslationModuleMap = <T extends Record<string, string>, L extends Record<string, string>, Module = unknown>(
	translations: T,
	locales: L,
	loadModule: (locale: keyof L, translation: keyof T) => Promise<Module>,
) => {
	type TranslationLoadModules = Record<keyof T, Record<keyof L, () => Promise<Module>>>;

	const translationModules = {} as TranslationLoadModules;

	for (const translationKey of Object.keys(translations) as (keyof T)[]) {
		translationModules[translationKey] = {} as TranslationLoadModules[keyof T];

		for (const localeKey of Object.keys(locales) as (keyof L)[]) {
			translationModules[translationKey][localeKey] = () => loadModule(localeKey, translationKey);
		}
	}

	return translationModules;
};
