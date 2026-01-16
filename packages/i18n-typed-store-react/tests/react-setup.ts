// This file must be loaded BEFORE any React imports
// Set the flag for React 18+/19 to support act()

// IMPORTANT: In React 19, the warning "The current testing environment is not configured to support act(...)"
// may still appear even if the flag is set. This is a known React 19 behavior.
// This warning is NOT critical and does NOT affect test execution - all tests pass successfully.
// More info: https://github.com/facebook/react/issues/...

// Use Object.defineProperty for reliable setup
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
	writable: true,
	enumerable: true,
	configurable: true,
	value: true,
});

// Also for window (jsdom uses window)
if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'IS_REACT_ACT_ENVIRONMENT', {
		writable: true,
		enumerable: true,
		configurable: true,
		value: true,
	});
}

// For Node.js environment
if (typeof global !== 'undefined') {
	Object.defineProperty(global, 'IS_REACT_ACT_ENVIRONMENT', {
		writable: true,
		enumerable: true,
		configurable: true,
		value: true,
	});
}
