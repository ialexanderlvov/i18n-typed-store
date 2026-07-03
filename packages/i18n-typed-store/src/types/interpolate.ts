/**
 * Values accepted for interpolation placeholders.
 * Converted with `String(value)` at substitution time.
 */
export type InterpolationValue = string | number | boolean;

/**
 * Removes leading/trailing spaces from a string literal type,
 * so `{{ name }}` and `{{name}}` produce the same parameter key.
 */
type Trim<S extends string> = S extends ` ${infer R}` ? Trim<R> : S extends `${infer R} ` ? Trim<R> : S;

/**
 * Extracts placeholder names from a template literal type.
 *
 * @example
 * ```ts
 * type Keys = InterpolationKeys<'Hello {{name}}, you have {{ count }} items'>;
 * // => 'name' | 'count'
 * ```
 */
export type InterpolationKeys<S extends string> = S extends `${string}{{${infer Param}}}${infer Rest}`
	? Trim<Param> | InterpolationKeys<Rest>
	: never;

/**
 * Parameters object required by a template.
 * Resolves to an exact `{ name: ..., count: ... }` shape for literal templates,
 * or a loose record when the template type is not statically known.
 *
 * @example
 * ```ts
 * type Params = InterpolationParams<'Hello {{name}}!'>;
 * // => { name: InterpolationValue }
 * ```
 */
export type InterpolationParams<S extends string> = string extends S
	? Record<string, InterpolationValue>
	: { [K in InterpolationKeys<S>]: InterpolationValue };
