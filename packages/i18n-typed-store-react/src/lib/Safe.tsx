import type { FC, ReactNode } from 'react';

/**
 * Safe component that catches errors during string extraction from translation objects.
 * Useful for safely accessing nested translation keys that might throw errors.
 *
 * @param props - Component props
 * @param props.children - Function that returns a string (called during render)
 * @param props.errorComponent - Component to display if an error occurs (default: empty string)
 * @param props.errorHandler - Optional error handler callback
 * @returns Rendered string wrapped in a span or error component
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
		errorHandler?.(error);
		return errorComponent ?? '';
	}
};
