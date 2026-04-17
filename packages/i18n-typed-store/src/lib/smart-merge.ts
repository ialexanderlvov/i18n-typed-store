/**
 * Performs a smart deep merge of two objects.
 * If structures differ at a key, the fallback value is used from that point.
 * Otherwise, current values are preserved.
 *
 * This function is used internally for merging translations with fallback locale.
 *
 * @param current - Current translation object
 * @param fallback - Fallback translation object
 * @returns Merged object with fallback values where structures differ
 *
 * @example
 * ```ts
 * const current = { a: { b: 1, c: 2 }, d: 3 };
 * const fallback = { a: { b: 1, c: 3 }, d: 3 };
 * const result = smartDeepMerge(current, fallback);
 * // Result: { a: { b: 1, c: 3 }, d: 3 } - only c is replaced from fallback
 * ```
 */
export function smartDeepMerge(current: any, fallback: any): any {
	// If either is null or undefined, return the other
	if (current == null) return fallback;
	if (fallback == null) return current;

	// Check if types differ (object vs primitive, or different object types)
	const currentIsObject = typeof current === 'object' && !Array.isArray(current);
	const fallbackIsObject = typeof fallback === 'object' && !Array.isArray(fallback);
	const currentIsArray = Array.isArray(current);
	const fallbackIsArray = Array.isArray(fallback);

	// If structure types differ (object vs primitive, or array vs object), use fallback
	if (
		(currentIsObject && !fallbackIsObject && !fallbackIsArray) ||
		(!currentIsObject && !currentIsArray && fallbackIsObject) ||
		(currentIsArray && !fallbackIsArray) ||
		(!currentIsArray && fallbackIsArray)
	) {
		return fallback;
	}

	// If both are primitives or arrays, use current if it exists, otherwise fallback
	if (!currentIsObject && !fallbackIsObject) {
		return current != null ? current : fallback;
	}

	// Both are objects - merge recursively
	const result: any = { ...current };

	// Add missing keys from fallback
	for (const key in fallback) {
		// Skip dangerous keys: assigning to `__proto__` swaps the result's
		// prototype to attacker-controlled data, and `constructor`/`prototype`
		// give an attacker a foothold for similar tricks. A malicious
		// translation file (parsed via JSON.parse, which preserves these
		// keys as own-properties) shouldn't be able to leak inherited
		// values into consumers' code.
		if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
			continue;
		}
		if (!Object.prototype.hasOwnProperty.call(fallback, key)) {
			continue;
		}
		if (!(key in result)) {
			// Key doesn't exist in current, add from fallback
			result[key] = fallback[key];
		} else {
			// Key exists in both - check if structures differ
			const currentValue = result[key];
			const fallbackValue = fallback[key];

			// Check if structures differ at this level
			const currentValueIsObject = currentValue != null && typeof currentValue === 'object' && !Array.isArray(currentValue);
			const fallbackValueIsObject = fallbackValue != null && typeof fallbackValue === 'object' && !Array.isArray(fallbackValue);
			const currentValueIsArray = Array.isArray(currentValue);
			const fallbackValueIsArray = Array.isArray(fallbackValue);

			// If structures differ (object vs primitive, or array vs object), use fallback from this point
			if (
				(currentValueIsObject && !fallbackValueIsObject && !fallbackValueIsArray) ||
				(!currentValueIsObject && !currentValueIsArray && fallbackValueIsObject) ||
				(currentValueIsArray && !fallbackValueIsArray) ||
				(!currentValueIsArray && fallbackValueIsArray)
			) {
				result[key] = fallbackValue;
			} else if (currentValueIsObject && fallbackValueIsObject) {
				// Both are objects - merge recursively
				result[key] = smartDeepMerge(currentValue, fallbackValue);
			} else if (currentValue == null) {
				// Current value is null/undefined, use fallback
				result[key] = fallbackValue;
			}
			// If current value exists and is not null and structures match, keep it (already in result)
		}
	}

	return result;
}
