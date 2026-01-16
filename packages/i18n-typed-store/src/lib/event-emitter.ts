import type { Listener, EventMap } from '../types/event-emitter.js';

/**
 * Event emitter class for managing event listeners.
 * Supports typed events with type-safe listeners.
 *
 * @template Events - Type of event map that maps event names to their argument types
 *
 * @example
 * ```ts
 * type MyEvents = {
 *   'user-login': [userId: string, timestamp: number];
 *   'user-logout': [userId: string];
 * };
 *
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('user-login', (userId, timestamp) => {
 *   console.log(`User ${userId} logged in at ${timestamp}`);
 * });
 * emitter.emit('user-login', 'user123', Date.now());
 * ```
 */
export class EventEmitter<Events extends EventMap = EventMap> {
	private listeners: {
		[K in keyof Events]?: Set<Listener<Events[K]>>;
	} = {};

	/**
	 * Registers an event listener for the specified event.
	 *
	 * @param event - Event name
	 * @param listener - Listener function
	 * @returns This instance for method chaining
	 */
	on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
		if (!this.listeners[event]) {
			this.listeners[event] = new Set();
		}
		this.listeners[event].add(listener);
		return this;
	}

	/**
	 * Registers a one-time event listener that will be automatically removed after the first call.
	 *
	 * @param event - Event name
	 * @param listener - Listener function
	 * @returns This instance for method chaining
	 */
	once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
		const wrapper: Listener<Events[K]> = (...args) => {
			this.off(event, wrapper);
			listener(...args);
		};
		return this.on(event, wrapper);
	}

	/**
	 * Removes an event listener. If no listener is provided, removes all listeners for the event.
	 *
	 * @param event - Event name
	 * @param listener - Optional listener function to remove
	 * @returns This instance for method chaining
	 */
	off<K extends keyof Events>(event: K, listener?: Listener<Events[K]>): this {
		const set = this.listeners[event];
		if (!set) {
			return this;
		}

		if (!listener) {
			set.clear();
		} else {
			set.delete(listener);
		}

		if (set.size === 0) {
			delete this.listeners[event];
		}
		return this;
	}

	/**
	 * Emits an event, calling all registered listeners with the provided arguments.
	 *
	 * @param event - Event name
	 * @param args - Event arguments
	 * @returns True if there were listeners, false otherwise
	 */
	emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
		const set = this.listeners[event];
		if (!set || set.size === 0) {
			return false;
		}

		[...set].forEach((listener) => listener(...args));
		return true;
	}

	/**
	 * Returns the number of listeners registered for the specified event.
	 *
	 * @param event - Event name
	 * @returns Number of listeners
	 */
	listenerCount<K extends keyof Events>(event: K): number {
		return this.listeners[event]?.size ?? 0;
	}

	/**
	 * Removes all event listeners from all events.
	 *
	 * @returns This instance for method chaining
	 */
	removeAllListeners(): this {
		this.listeners = {};
		return this;
	}

	/**
	 * Returns an array of all event names that have registered listeners.
	 *
	 * @returns Array of event names
	 */
	eventNames(): (keyof Events)[] {
		return Object.keys(this.listeners) as (keyof Events)[];
	}
}
