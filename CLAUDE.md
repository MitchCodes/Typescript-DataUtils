# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a TypeScript monorepo containing data utility packages for Azure services, caching, and pub/sub messaging. The project uses a multi-package structure under `/packages/`:

- **core** - Foundation package with shared models, interfaces, and utilities
- **azure-table-storage** - Azure Table Storage and Blob Storage helpers
- **azure-storage-queue** - Azure Storage Queue management
- **azure-service-bus-pubsub** - Azure Service Bus pub/sub messaging
- **memory-cache** - In-memory caching implementations
- **redis-cache** - Redis caching utilities

### Key Dependencies
- Each package depends on `tsdatautils-core` as the foundation
- Uses Winston for logging with custom transports and modifiers
- Implements throttling with `p-throttle` and `concurrent-queue`
- Built with TypeScript 4.2+ targeting ES6/CommonJS

### Core Architecture Patterns
- **Interface-driven design**: All major components implement interfaces (e.g., `IDocumentStorageManager`, `IBasicCache`, `IPubSubManager`)
- **Event-driven processing**: `QueuedCommandRunner` uses EventEmitter for job lifecycle management
- **Retry mechanisms**: `ClassFunctionRetrier` provides automatic retry capabilities for any class
- **Function distribution**: `ClassFunctionDistributor` supports round-robin and random algorithm distribution
- **Throttling**: `ClassFunctionThrottler` provides rate limiting for class methods

## Development Commands

### Building and Testing

Each package has consistent npm scripts. From any package directory:

```bash
# Clean build artifacts
npm run clean

# Build TypeScript to JavaScript
npm run build

# Production build
npm run build-prod

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint-autofix

# Run tests with coverage
npm test

# Run tests without linting
npm run test-only

# Watch mode for tests
npm run test:watch

# Run specific test suites (varies by package)
npm run test-azure      # Azure-specific tests
npm run test-basic      # Basic functionality tests
```

### Package Publishing

```bash
# Clean, build, and publish to npm
npm run publish-npm
```

### Testing Framework

- Uses Jest with `ts-jest` transformer
- Test files: `**/*.{spec,test}.{ts,js}`
- Excludes `main.spec.ts` files from test discovery
- Coverage reports generated in `/coverage` directory
- Multiple Jest configurations per package for different test types (basic, azure, redis, etc.)

## Working with the Codebase

### Package Structure
- `src/main.ts` - Main export file for each package
- `src/models/` - TypeScript interfaces and type definitions
- `src/logic/` - Core business logic and utility classes
- `src/data/` - Data access and storage implementations
- `src/converters/` - Data transformation utilities
- `__tests__/` - Test files organized by functionality

### Key Classes and Utilities
- `QueuedCommandRunner` - Manages concurrent job processing with event emissions
- `ClassFunctionRetrier` - Wraps objects with automatic retry logic
- `WinstonLogger` - Configurable logging with date stamp and interpolation modifiers
- `JsonSerializer` - JSON serialization with custom property handlers
- Storage managers implement consistent interfaces for Azure Table Storage, Blob Storage, and Queue operations

### TypeScript Configuration
- Target: ES6 with CommonJS modules
- Strict mode enabled but with relaxed null checks and implicit any
- Source maps enabled for debugging
- Includes both `src/` and `__tests__/` in compilation