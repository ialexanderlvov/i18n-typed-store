/**
 * Utility type to extract all possible translation keys from a translation modules mapping.
 * Converts nested object structure into dot-separated string paths.
 * Includes all paths: namespace keys, intermediate object paths, and leaf node paths.
 *
 * @template M - Type of translation modules mapping (e.g., { common: { greeting: string }, errors: { notFound: string } })
 *
 * @example
 * ```ts
 * type Translations = {
 *   common: { greeting: string; buttons: { save: string } };
 * };
 *
 * type Keys = TranslationKeys<Translations>;
 * // Result: "common" | "common.greeting" | "common.buttons" | "common.buttons.save"
 * ```
 */
export type TranslationKeys<M extends Record<string, any>> = {
	[K in keyof M]: `${string & K}` | (M[K] extends Record<string, any> ? `${string & K}.${NestedKeys<M[K]>}` : never);
}[keyof M];

/**
 * Helper type to extract nested keys from an object, creating dot-separated paths.
 * Includes all paths: intermediate object paths and leaf node paths.
 *
 * @template T - Object type to extract keys from
 */
type NestedKeys<T> =
	T extends Record<string, any>
		? {
				[K in keyof T]: `${string & K}` | (T[K] extends Record<string, any> ? `${string & K}.${NestedKeys<T[K]>}` : never);
			}[keyof T]
		: never;

/**
 * Utility type to extract the value type from a translation modules mapping by key path.
 *
 * @template M - Type of translation modules mapping
 * @template Key - Dot-separated key path (e.g., "common.greeting" or "common.buttons.save")
 *
 * @example
 * ```ts
 * type Translations = {
 *   common: { greeting: string; count: number; buttons: { save: string } };
 * };
 *
 * type Greeting = GetTranslationValue<Translations, "common.greeting">;
 * // Result: string
 *
 * type Count = GetTranslationValue<Translations, "common.count">;
 * // Result: number
 *
 * type Save = GetTranslationValue<Translations, "common.buttons.save">;
 * // Result: string
 * ```
 */
export type GetTranslationValue<M extends Record<string, any>, Key extends string> = Key extends `${infer Namespace}.${infer Rest}`
	? Namespace extends keyof M
		? M[Namespace] extends Record<string, any>
			? GetNestedValue<M[Namespace], Rest>
			: never
		: never
	: Key extends keyof M
		? M[Key]
		: never;

/**
 * Helper type to extract nested value from an object by key path.
 *
 * @template T - Object type
 * @template Key - Dot-separated key path
 */
type GetNestedValue<T extends Record<string, any>, Key extends string> = Key extends `${infer K}.${infer Rest}`
	? K extends keyof T
		? T[K] extends Record<string, any>
			? GetNestedValue<T[K], Rest>
			: never
		: never
	: Key extends keyof T
		? T[Key]
		: never;
