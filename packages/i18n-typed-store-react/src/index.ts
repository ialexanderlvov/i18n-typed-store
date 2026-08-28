export * from './lib/I18nTypedStoreProvider';
export * from './lib/Safe';
export * from './lib/useI18nTranslation';
export * from './lib/useI18nTranslationLazy';
export * from './lib/useI18nTranslationState';
export * from './lib/useI18nTypedStoreContext';
export * from './lib/useLocale';
export * from './types/context';

// Next.js' webpack-based React Server Components compiler rejects wildcard
// re-exports in a "use client" boundary. Keep the convenient core re-exports,
// but enumerate them so the root entry can be imported as a client boundary
// from both webpack- and Turbopack-based Next.js applications.
export {
	EventEmitter,
	LocaleLoadError,
	TranslationMissingError,
	createIntlFormatters,
	createPluralSelector,
	createTranslationModuleMap,
	createTranslationStore,
	findBestLocaleMatch,
	generateLocaleCandidates,
	getTranslation,
	getTranslationOrThrow,
	interpolate,
	parseLocale,
	smartDeepMerge,
} from 'i18n-typed-store';

export type {
	CreatePluralSelectorOptions,
	CreateTranslationStoreOptions,
	EventMap,
	GetTranslationValue,
	InterpolationKeys,
	InterpolationParams,
	InterpolationValue,
	IntlFormatters,
	Listener,
	LocaleChangeListener,
	LocaleChangeMetadata,
	LocaleChangeResult,
	LocaleLoadOptions,
	ParsedLocale,
	PluralCategory,
	PluralVariants,
	TranslationKeys,
	TranslationModuleMap,
	TranslationStateEvent,
	TranslationStateListener,
	TranslationStore,
} from 'i18n-typed-store';
