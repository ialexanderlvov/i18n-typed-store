import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { StrictMode, Suspense } from 'react';
import { Safe } from '../src/index';

describe('Safe', () => {
	it('should render string from children function without errors', () => {
		render(<Safe>{() => 'Test content'}</Safe>);

		expect(screen.getByText('Test content')).toBeInTheDocument();
	});

	it('should display errorComponent when error occurs in children', () => {
		const errorComponent = <span>Error occurred</span>;
		const children = vi.fn(() => {
			throw new Error('Test error');
		});

		render(<Safe errorComponent={errorComponent}>{children}</Safe>);

		expect(screen.getByText('Error occurred')).toBeInTheDocument();
	});

	it('should call errorHandler when error occurs', () => {
		const errorHandler = vi.fn();
		const error = new Error('Test error');
		const children = vi.fn(() => {
			throw error;
		});

		render(<Safe errorHandler={errorHandler}>{children}</Safe>);

		expect(errorHandler).toHaveBeenCalledWith(error);
	});

	it('should report a committed error only once under StrictMode', () => {
		const errorHandler = vi.fn();
		const error = new Error('StrictMode error');
		const children = () => {
			throw error;
		};

		render(
			<StrictMode>
				<Safe errorHandler={errorHandler}>{children}</Safe>
			</StrictMode>,
		);

		expect(errorHandler).toHaveBeenCalledOnce();
		expect(errorHandler).toHaveBeenCalledWith(error);
	});

	it('should render empty string if errorComponent is not provided', () => {
		const children = () => {
			throw new Error('Test error');
		};

		const { container } = render(<Safe>{children}</Safe>);

		// Should render empty fragment (no visible content)
		expect(container.firstChild).toBeNull();
	});

	it('should correctly handle string values from translations', () => {
		const mockTranslations = {
			common: {
				pages: {
					main: {
						title: 'Main Page Title',
					},
				},
			},
		};

		render(<Safe>{() => mockTranslations.common.pages.main.title}</Safe>);

		expect(screen.getByText('Main Page Title')).toBeInTheDocument();
	});

	it('should handle errors when accessing nested translation keys', () => {
		const errorComponent = <span>Translation not found</span>;

		render(
			<Safe errorComponent={errorComponent}>
				{() => {
					// Simulate error when accessing translation property
					// This could happen if the translation object structure is incorrect
					throw new TypeError("Cannot read property 'title' of undefined");
				}}
			</Safe>,
		);

		expect(screen.getByText('Translation not found')).toBeInTheDocument();
	});

	it('should call children function only once per render', () => {
		const children = vi.fn(() => 'Content');

		const { rerender } = render(<Safe>{children}</Safe>);

		expect(children).toHaveBeenCalledTimes(1);

		rerender(<Safe>{children}</Safe>);

		expect(children).toHaveBeenCalledTimes(2);
	});

	it('should re-throw a thrown thenable so Suspense keeps working inside children', async () => {
		// A thrown Promise is React Suspense signalling, not an error — Safe must
		// pass it through to the surrounding <Suspense> boundary instead of
		// swallowing it and rendering the error component.
		let resolvePromise!: (value: string) => void;
		const promise = new Promise<string>((resolve) => {
			resolvePromise = resolve;
		});
		let resolved: string | undefined;
		void promise.then((value) => {
			resolved = value;
		});

		const errorHandler = vi.fn();

		const readValue = () => {
			if (resolved === undefined) {
				throw promise;
			}
			return resolved;
		};

		render(
			<Suspense fallback={<div>Suspense fallback</div>}>
				<Safe errorComponent={<span>error</span>} errorHandler={errorHandler}>
					{() => readValue()}
				</Safe>
			</Suspense>,
		);

		// The thenable reached the Suspense boundary: the fallback is shown and
		// neither the error component nor the error handler was involved.
		expect(screen.getByText('Suspense fallback')).toBeInTheDocument();
		expect(screen.queryByText('error')).toBeNull();
		expect(errorHandler).not.toHaveBeenCalled();

		await act(async () => {
			resolvePromise('Ready');
			await promise;
		});

		expect(screen.getByText('Ready')).toBeInTheDocument();
	});
});
