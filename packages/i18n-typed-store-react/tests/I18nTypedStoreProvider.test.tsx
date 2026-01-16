/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nTypedStoreProvider, useI18nTypedStoreContext } from '../src/index';
import { createTranslationStore } from 'i18n-typed-store';

describe('I18nTypedStoreProvider', () => {
	const namespaces = { common: 'common' } as const;
	const locales = { en: 'en', ru: 'ru' } as const;

	const createTestStore = () => {
		const storeFactory = createTranslationStore({
			namespaces,
			locales,
			loadModule: async () => ({}),
			extractTranslation: () => ({}),
			defaultLocale: 'en',
		});

		return storeFactory.type<{ common: { greeting: string } }>();
	};

	it('should render children', () => {
		const store = createTestStore();

		render(
			<I18nTypedStoreProvider store={store}>
				<div>Test content</div>
			</I18nTypedStoreProvider>,
		);

		expect(screen.getByText('Test content')).toBeInTheDocument();
	});

	it('should provide store through context', () => {
		const store = createTestStore();

		const TestComponent = () => {
			const { store: contextStore } = useI18nTypedStoreContext();
			return <div>{contextStore === store ? 'Store matches' : 'Store mismatch'}</div>;
		};

		render(
			<I18nTypedStoreProvider store={store}>
				<TestComponent />
			</I18nTypedStoreProvider>,
		);

		expect(screen.getByText('Store matches')).toBeInTheDocument();
	});

	it('should use default suspenseMode', () => {
		const store = createTestStore();

		const TestComponent = () => {
			const { suspenseMode } = useI18nTypedStoreContext();
			return <div>{suspenseMode}</div>;
		};

		render(
			<I18nTypedStoreProvider store={store}>
				<TestComponent />
			</I18nTypedStoreProvider>,
		);

		expect(screen.getByText('first-load-locale')).toBeInTheDocument();
	});

	it('should use provided suspenseMode', () => {
		const store = createTestStore();

		const TestComponent = () => {
			const { suspenseMode } = useI18nTypedStoreContext();
			return <div>{suspenseMode}</div>;
		};

		render(
			<I18nTypedStoreProvider store={store} suspenseMode="change-locale">
				<TestComponent />
			</I18nTypedStoreProvider>,
		);

		expect(screen.getByText('change-locale')).toBeInTheDocument();
	});

	it('should support all suspenseMode variants', () => {
		const store = createTestStore();
		const modes: Array<'once' | 'first-load-locale' | 'change-locale'> = ['once', 'first-load-locale', 'change-locale'];

		modes.forEach((mode) => {
			const TestComponent = () => {
				const { suspenseMode } = useI18nTypedStoreContext();
				return <div>{suspenseMode}</div>;
			};

			const { unmount } = render(
				<I18nTypedStoreProvider store={store} suspenseMode={mode}>
					<TestComponent />
				</I18nTypedStoreProvider>,
			);

			expect(screen.getByText(mode)).toBeInTheDocument();
			unmount();
		});
	});

	it('should work with nested components', () => {
		const store = createTestStore();

		const InnerComponent = () => {
			const { store: contextStore } = useI18nTypedStoreContext();
			return <div>Inner: {contextStore.currentLocale}</div>;
		};

		const OuterComponent = () => {
			return (
				<div>
					<div>Outer</div>
					<InnerComponent />
				</div>
			);
		};

		render(
			<I18nTypedStoreProvider store={store}>
				<OuterComponent />
			</I18nTypedStoreProvider>,
		);

		expect(screen.getByText('Outer')).toBeInTheDocument();
		expect(screen.getByText('Inner: en')).toBeInTheDocument();
	});
});
