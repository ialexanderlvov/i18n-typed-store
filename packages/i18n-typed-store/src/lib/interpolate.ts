import type { InterpolationKeys, InterpolationParams, InterpolationValue } from '../types/interpolate.js';

/**
 * Matches `{{ name }}` placeholders. The name may contain word characters,
 * `$`, `.` and `-`; surrounding whitespace inside the braces is ignored.
 */
const PLACEHOLDER_PATTERN = /\{\{\s*([\w$.-]+)\s*\}\}/g;

/**
 * Substitutes `{{placeholder}}` values in a translation string.
 *
 * Fully type-safe for literal templates: the required parameter object is
 * derived from the template string type, so a missing or misspelled parameter
 * is a compile-time error. Templates without placeholders take no parameters.
 *
 * Placeholders with no matching parameter are left in the output verbatim —
 * a visible `{{name}}` in the UI is easier to notice and debug than a
 * silently dropped value.
 *
 * @param template - Translation string containing `{{name}}` placeholders
 * @param params - Values for each placeholder (required if the template has any)
 * @returns The template with all known placeholders substituted
 *
 * @example
 * ```ts
 * interpolate('Hello {{name}}!', { name: 'Alex' });
 * // => 'Hello Alex!'
 *
 * interpolate('{{count}} of {{ total }} done', { count: 3, total: 10 });
 * // => '3 of 10 done'
 *
 * interpolate('No placeholders here');
 * // => 'No placeholders here'
 *
 * // @ts-expect-error — 'name' is required by the template
 * interpolate('Hello {{name}}!', {});
 * ```
 */
export function interpolate<S extends string>(
	template: S,
	...args: string extends S
		? [params?: Record<string, InterpolationValue>]
		: [InterpolationKeys<S>] extends [never]
			? []
			: [params: InterpolationParams<S>]
): string {
	const params = args[0] as Record<string, InterpolationValue> | undefined;

	if (typeof template !== 'string' || !params) {
		return template;
	}

	return template.replace(PLACEHOLDER_PATTERN, (placeholder, name: string) => {
		// Own-property check: `params.constructor` / `params.toString` must not
		// leak prototype members into rendered output when the placeholder name
		// is attacker-influenced.
		if (Object.prototype.hasOwnProperty.call(params, name)) {
			const value = params[name];
			if (value !== undefined && value !== null) {
				return String(value);
			}
		}
		return placeholder;
	});
}
