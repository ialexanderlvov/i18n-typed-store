/** Returns whether a value is a React-compatible Promise-like suspension signal. */
export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
	value !== null &&
	(typeof value === 'object' || typeof value === 'function') &&
	typeof (value as { then?: unknown }).then === 'function';
