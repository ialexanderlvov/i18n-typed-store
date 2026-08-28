import { useEffect, useRef, type FC, type ReactNode } from 'react';

interface SafeErrorFallbackProps {
	error: unknown;
	errorComponent?: ReactNode;
	errorHandler?: (error: unknown) => void;
}

/** Renders Safe's fallback and reports the error only after React commits it. */
export const SafeErrorFallback: FC<SafeErrorFallbackProps> = ({ error, errorComponent, errorHandler }) => {
	const lastReport = useRef<{ error: unknown; handler: (error: unknown) => void } | undefined>(undefined);

	useEffect(() => {
		if (!errorHandler) return;
		const previous = lastReport.current;
		if (previous?.handler === errorHandler && Object.is(previous.error, error)) return;
		lastReport.current = { error, handler: errorHandler };
		errorHandler(error);
	}, [error, errorHandler]);

	return errorComponent ?? '';
};
