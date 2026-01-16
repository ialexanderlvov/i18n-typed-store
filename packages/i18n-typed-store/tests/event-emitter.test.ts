import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from '../src/lib/event-emitter';

describe('EventEmitter', () => {
	let emitter: EventEmitter;

	beforeEach(() => {
		emitter = new EventEmitter();
	});

	describe('on', () => {
		it('should register an event listener', () => {
			const listener = vi.fn();
			emitter.on('test', listener);
			emitter.emit('test', 'arg1', 'arg2');

			expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
			expect(listener).toHaveBeenCalledTimes(1);
		});

		it('should register multiple listeners for the same event', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			emitter.on('test', listener1);
			emitter.on('test', listener2);
			emitter.emit('test', 'arg');

			expect(listener1).toHaveBeenCalledWith('arg');
			expect(listener2).toHaveBeenCalledWith('arg');
		});

		it('should support method chaining', () => {
			const listener = vi.fn();
			const result = emitter.on('test', listener);

			expect(result).toBe(emitter);
		});
	});

	describe('once', () => {
		it('should call listener only once', () => {
			const listener = vi.fn();
			emitter.once('test', listener);

			emitter.emit('test', 'arg1');
			emitter.emit('test', 'arg2');

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith('arg1');
		});

		it('should automatically remove listener after first call', () => {
			const listener = vi.fn();
			emitter.once('test', listener);

			emitter.emit('test', 'arg1');
			expect(emitter.listenerCount('test')).toBe(0);
		});

		it('should support method chaining', () => {
			const listener = vi.fn();
			const result = emitter.once('test', listener);

			expect(result).toBe(emitter);
		});
	});

	describe('off', () => {
		it('should remove a specific listener', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			emitter.on('test', listener1);
			emitter.on('test', listener2);
			emitter.off('test', listener1);
			emitter.emit('test', 'arg');

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).toHaveBeenCalledWith('arg');
		});

		it('should remove all listeners for an event if no listener is specified', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			emitter.on('test', listener1);
			emitter.on('test', listener2);
			emitter.off('test');
			emitter.emit('test', 'arg');

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).not.toHaveBeenCalled();
		});

		it('should do nothing if event does not exist', () => {
			const listener = vi.fn();
			emitter.off('nonexistent', listener);

			expect(() => emitter.off('nonexistent', listener)).not.toThrow();
		});

		it('should support method chaining', () => {
			const listener = vi.fn();
			emitter.on('test', listener);
			const result = emitter.off('test', listener);

			expect(result).toBe(emitter);
		});
	});

	describe('emit', () => {
		it('should call all listeners with correct arguments', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			emitter.on('test', listener1);
			emitter.on('test', listener2);
			const result = emitter.emit('test', 'arg1', 'arg2', 'arg3');

			expect(listener1).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
			expect(listener2).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
			expect(result).toBe(true);
		});

		it('should return false if there are no listeners', () => {
			const result = emitter.emit('test', 'arg');

			expect(result).toBe(false);
		});

		it('should call listeners in registration order', () => {
			const order: number[] = [];
			const listener1 = () => order.push(1);
			const listener2 = () => order.push(2);
			const listener3 = () => order.push(3);

			emitter.on('test', listener1);
			emitter.on('test', listener2);
			emitter.on('test', listener3);
			emitter.emit('test');

			expect(order).toEqual([1, 2, 3]);
		});

		it('should support typed events', () => {
			type TestEvents = {
				'user-login': [userId: string, timestamp: number];
				'user-logout': [userId: string];
			};

			const typedEmitter = new EventEmitter<TestEvents>();
			const loginListener = vi.fn();
			const logoutListener = vi.fn();

			typedEmitter.on('user-login', loginListener);
			typedEmitter.on('user-logout', logoutListener);

			typedEmitter.emit('user-login', 'user123', 1234567890);
			typedEmitter.emit('user-logout', 'user123');

			expect(loginListener).toHaveBeenCalledWith('user123', 1234567890);
			expect(logoutListener).toHaveBeenCalledWith('user123');
		});
	});

	describe('listenerCount', () => {
		it('should return the number of listeners for an event', () => {
			expect(emitter.listenerCount('test')).toBe(0);

			emitter.on('test', vi.fn());
			expect(emitter.listenerCount('test')).toBe(1);

			emitter.on('test', vi.fn());
			expect(emitter.listenerCount('test')).toBe(2);

			emitter.off('test');
			expect(emitter.listenerCount('test')).toBe(0);
		});

		it('should return 0 for non-existent event', () => {
			expect(emitter.listenerCount('nonexistent')).toBe(0);
		});
	});

	describe('removeAllListeners', () => {
		it('should remove all listeners for all events', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();
			const listener3 = vi.fn();

			emitter.on('event1', listener1);
			emitter.on('event2', listener2);
			emitter.on('event2', listener3);

			emitter.removeAllListeners();
			emitter.emit('event1');
			emitter.emit('event2');

			expect(listener1).not.toHaveBeenCalled();
			expect(listener2).not.toHaveBeenCalled();
			expect(listener3).not.toHaveBeenCalled();
		});

		it('should support method chaining', () => {
			const result = emitter.removeAllListeners();

			expect(result).toBe(emitter);
		});
	});

	describe('eventNames', () => {
		it('should return an array of event names with registered listeners', () => {
			expect(emitter.eventNames()).toEqual([]);

			emitter.on('event1', vi.fn());
			emitter.on('event2', vi.fn());

			const names = emitter.eventNames();
			expect(names).toContain('event1');
			expect(names).toContain('event2');
			expect(names.length).toBe(2);
		});

		it('should remove event from list when all listeners are removed', () => {
			const listener = vi.fn();
			emitter.on('test', listener);

			expect(emitter.eventNames()).toContain('test');

			emitter.off('test', listener);
			expect(emitter.eventNames()).not.toContain('test');
		});
	});

	describe('integration tests', () => {
		it('should work correctly with complex scenarios', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();
			const listener3 = vi.fn();

			// Add listeners
			emitter.on('test', listener1);
			emitter.once('test', listener2);
			emitter.on('test', listener3);

			// First emit
			emitter.emit('test', 'first');
			expect(listener1).toHaveBeenCalledWith('first');
			expect(listener2).toHaveBeenCalledWith('first');
			expect(listener3).toHaveBeenCalledWith('first');

			// Second emit (listener2 should not be called)
			emitter.emit('test', 'second');
			expect(listener1).toHaveBeenCalledTimes(2);
			expect(listener2).toHaveBeenCalledTimes(1);
			expect(listener3).toHaveBeenCalledTimes(2);

			// Remove listener1
			emitter.off('test', listener1);
			emitter.emit('test', 'third');
			expect(listener1).toHaveBeenCalledTimes(2);
			expect(listener3).toHaveBeenCalledTimes(3);
		});
	});
});
