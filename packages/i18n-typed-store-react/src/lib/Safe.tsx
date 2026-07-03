import type { FC, ReactNode } from 'react';

/**
 * Returns true when the caught value is a thenable (Promise-like).
 * React Suspense signals by throwing thenables, which must not be treated
 * as errors.
 */
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
	value !== null &&
	(typeof value === 'object' || typeof value === 'function') &&
	typeof (value as { then?: unknown }).then === 'function';

/**
 * Safe component that catches errors during string extraction from translation objects.
 * Useful for safely accessing nested translation keys that might throw errors.
 * Thrown thenables (React Suspense signals) are re-thrown untouched, so children
 * that read suspending resources keep working with surrounding Suspense boundaries.
 *
 * @param props - Component props
 * @param props.children - Function that returns a string (called during render)
 * @param props.errorComponent - Component to display if an error occurs (default: empty string)
 * @param props.errorHandler - Optional error handler callback
 * @returns The string produced by children as-is (no wrapper element), or the error component if extraction threw
 *
 * @example
 * ```tsx
 * <Safe
 *   errorComponent={<span>N/A</span>}
 *   errorHandler={(error) => console.error(error)}
 * >
 *   {() => translations.common.pages.main.title}
 * </Safe>
 * ```
 */
export const Safe: FC<{ children: () => string; errorComponent?: ReactNode; errorHandler?: (error: unknown) => void }> = ({
	children,
	errorComponent,
	errorHandler,
}) => {
	try {
		const result = children();
		return result;
	} catch (error) {
		// A thrown thenable is not a failure — it is React Suspense signalling
		// from a suspending read inside `children`. Swallowing it would break
		// <Suspense> boundaries above this component, so pass it through.
		if (isThenable(error)) {
			throw error;
		}
		errorHandler?.(error);
		return errorComponent ?? '';
	}
};
