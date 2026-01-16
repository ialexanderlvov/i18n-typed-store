/**
 * Event listener function type.
 *
 * @template T - Type of event arguments array
 */
export type Listener<T extends any[] = any[]> = (...args: T) => void;

/**
 * Event map type that maps event names to their argument types.
 *
 * @example
 * ```ts
 * type MyEvents = {
 *   'user-login': [userId: string, timestamp: number];
 *   'user-logout': [userId: string];
 * };
 * ```
 */
export type EventMap = Record<PropertyKey, any[]>;
