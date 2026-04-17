/**
 * Validates that a value is a non-empty object.
 *
 * @param value - The value to validate
 * @param paramName - Name of the parameter for error message
 * @throws {TypeError} If value is not a non-empty object
 */
export const validateNonEmptyObject = (value: unknown, paramName: string): void => {
	if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
		throw new TypeError(`${paramName} must be a non-empty object`);
	}
};

/**
 * Validates that a value is a function.
 *
 * @param value - The value to validate
 * @param paramName - Name of the parameter for error message
 * @throws {TypeError} If value is not a function
 */
export const validateFunction = (value: unknown, paramName: string): void => {
	if (typeof value !== 'function') {
		throw new TypeError(`${paramName} must be a function`);
	}
};

/**
 * Validates that a key exists in an object.
 *
 * @param key - The key to check
 * @param object - The object to check the key in
 * @param paramName - Name of the key parameter for error message
 * @param objectName - Name of the object parameter for error message
 * @throws {TypeError} If key is not present in the object
 */
export const validateKeyInObject = (key: any, object: Record<string, unknown>, paramName: string, objectName: string): void => {
	// `in` traverses the prototype chain, so e.g. `__proto__` would pass.
	// Restrict to own properties to prevent silent acceptance of dangerous keys.
	if (!Object.prototype.hasOwnProperty.call(object, key as PropertyKey)) {
		throw new TypeError(`${paramName} '${String(key)}' must be a key in ${objectName}`);
	}
};
