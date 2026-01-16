import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
