import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request state stored in AsyncLocalStorage.
 *
 * Holds a mutable `locale` slot so a request can change its own locale
 * (e.g. after authentication resolves a user's preferred language) without
 * affecting other concurrent requests.
 */
export interface I18nRequestState {
	locale: string | undefined;
}

/**
 * AsyncLocalStorage instance scoped to a single request.
 *
 * Why this exists: the singleton `I18nService` previously stored
 * `currentLocale` as instance state, which meant two concurrent requests with
 * different `Accept-Language` headers could overwrite each other's locale —
 * a real race condition under load. With ALS the locale is propagated through
 * the async call chain (controllers, services, exception filters, guards if
 * the middleware ran first) without leaking between requests.
 */
export const i18nRequestStorage = new AsyncLocalStorage<I18nRequestState>();

/**
 * Returns the locale associated with the current request, if any.
 * Returns `undefined` outside of a request context.
 */
export function getRequestLocale(): string | undefined {
	return i18nRequestStorage.getStore()?.locale;
}

/**
 * Updates the locale for the current request. No-op if called outside a
 * request context (so worker code that calls into `I18nService` doesn't
 * accidentally try to mutate a missing store).
 */
export function setRequestLocale(locale: string | undefined): void {
	const store = i18nRequestStorage.getStore();
	if (store) {
		store.locale = locale;
	}
}

/**
 * Runs the provided callback inside a fresh request-scoped store.
 * Used by the middleware/interceptor to bind a locale to the request lifetime.
 */
export function runWithRequestLocale<T>(locale: string | undefined, fn: () => T): T {
	return i18nRequestStorage.run({ locale }, fn);
}
