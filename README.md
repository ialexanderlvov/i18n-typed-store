# i18n-typed-store Monorepo

Monorepo for i18n-typed-store libraries - a type-safe translation store with full TypeScript support.

## 📦 Packages

- **[i18n-typed-store](./packages/i18n-typed-store/)** - Core library for working with translations
- **[i18n-typed-store-react](./packages/i18n-typed-store-react/)** - React integration with hooks and components

## 🚀 Quick Start

### Install Dependencies

```bash
pnpm install
```

### Build All Packages

```bash
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Run Tests with Coverage

```bash
pnpm test:coverage
```

### Linting

```bash
pnpm lint
```

### Format Code

```bash
pnpm format
```

### Check Formatting

```bash
pnpm format:check
```

## 🛠️ Development

### Project Structure

```
.
├── packages/
│   ├── i18n-typed-store/          # Core library
│   └── i18n-typed-store-react/    # React integration
├── nx.json                         # Nx configuration
├── pnpm-workspace.yaml             # pnpm workspace configuration
└── tsconfig.base.json              # Base TypeScript config
```

### Working with Changes

The project uses [Changesets](https://github.com/changesets/changesets) for version management.

#### Create a Changeset

```bash
pnpm changeset
```

#### Apply Version Changes

```bash
pnpm changeset:version
```

#### Publish Packages

```bash
pnpm publish:release
```

### Run Only Affected Packages

Nx automatically detects affected packages:

```bash
# Build only affected packages
pnpm affected:build

# Test only affected packages
pnpm affected:test

# Lint only affected packages
pnpm affected:lint
```

### Dependency Graph

View the dependency graph between packages:

```bash
pnpm graph
```

## 📝 Scripts

- `build` - Build all packages
- `test` - Run all tests
- `test:coverage` - Run tests with coverage
- `lint` - Lint all packages
- `format` - Format code
- `format:check` - Check formatting
- `changeset` - Create a changeset
- `changeset:version` - Apply versions
- `changeset:publish` - Publish packages
- `publish:version` - Full cycle: checks + versioning
- `publish:release` - Full cycle: checks + publishing

## 🔧 Technologies

- **TypeScript** - Type safety
- **Vitest** - Testing
- **ESLint** - Linting
- **Prettier** - Code formatting
- **Nx** - Monorepo management
- **pnpm** - Package manager
- **Changesets** - Version management
- **tsup** - Package building

## 📚 Documentation

Detailed documentation for each package can be found in their respective README files:

- [i18n-typed-store README](./packages/i18n-typed-store/README.md)
- [i18n-typed-store-react README](./packages/i18n-typed-store-react/README.md)

## 📄 License

MIT

## 👤 Author

Alexander Lvov
