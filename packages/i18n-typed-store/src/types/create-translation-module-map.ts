/**
 * Map of translation module loaders.
 * Each namespace key maps to an object where each locale key maps to a loader function.
 *
 * @template N - Type of namespaces object (e.g., { common: 'common', errors: 'errors' })
 * @template L - Type of locales object (e.g., { en: 'en', ru: 'ru' })
 * @template Module - Type of the raw module loaded from the module loader
 */
export type TranslationModuleMap<N extends Record<string, string>, L extends Record<string, string>, Module = unknown> = Record<
	keyof N,
	Record<keyof L, () => Promise<Module>>
>;
