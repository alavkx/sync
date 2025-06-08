# 📚 Kalphite Documentation Structure

## New Structure

```
📁 docs/
├── 📄 README.md                    # 🧭 Navigation hub
├── 📄 kalphite-architecture.md     # 🏗️ Complete technical design
└── 📁 kalphite/
    ├── 📄 setup.md                 # 🛠️ Development patterns
    ├── 📄 testing.md               # 🧪 Test-driven methodology
    ├── 📄 status.md                # 📊 Progress dashboard
    └── 📄 decisions.md             # 🧠 Architectural choices

📦 packages/kalphite/
├── 📄 README.md                    # 🚀 Quick start with API
├── 📄 TDD-IMPLEMENTATION-GUIDE.md  # 🔧 Development process
├── 📄 NEW-API-SUMMARY.md          # 🎨 API transformation
├── 📄 test-strategy.md             # 📋 Test plan
└── 🧪 src/__tests__/              # ✅ 31 tests
```

## Each File's Purpose

### Quick Start

- **packages/kalphite/README.md**: Installation, API examples, React integration
- **docs/kalphite/setup.md**: Development patterns, troubleshooting, performance

### Understanding

- **docs/kalphite-architecture.md**: Complete technical design and philosophy
- **docs/kalphite/status.md**: Current progress, roadmap, metrics
- **docs/kalphite/decisions.md**: Key architectural choices and reasoning

### Development

- **docs/kalphite/testing.md**: Test-driven methodology, performance standards
- **packages/kalphite/TDD-IMPLEMENTATION-GUIDE.md**: Layer implementation process

## Navigation Paths

**I want to use Kalphite**

1. packages/kalphite/README.md → docs/kalphite/setup.md

**I want to understand Kalphite**

1. docs/README.md → docs/kalphite-architecture.md → docs/kalphite/decisions.md

**I want to contribute**

1. docs/kalphite/setup.md → docs/kalphite/testing.md → packages/kalphite/TDD-IMPLEMENTATION-GUIDE.md

## Principles

- **Concise**: Say more with less words
- **Actionable**: Focus on what's unique to Kalphite
- **Organized**: Clear separation by audience and purpose
- **Maintained**: Updated after each development session

Eliminated verbose explanations of obvious concepts. Focused on what makes Kalphite different.

# Glossary

## Core Concepts

**Entity**: A piece of data with `id`, `type`, and `updatedAt` fields. The basic unit of storage in Kalphite.

**Entity Type**: The discriminator field (e.g., "comment", "review") that determines which collection an entity belongs to.

**KalphiteStore**: The main store factory function that creates a reactive store instance.

**TypedCollection**: Array-like collection that extends Array with `upsert()` and `delete()` methods. Provides type-scoped operations.

**Proxy Factory**: JavaScript Proxy that enables dynamic property access (`store.comment`, `store.review`) on the store.

**Standard Schema**: Industry standard for schema validation libraries (Zod, Valibot, ArkType, etc.). Kalphite works with any compliant library.

## API Terms

**store.comment**: Dynamic property access to get all entities of type "comment" as a TypedCollection.

**store.comment.upsert(id, entity)**: Type-scoped operation to insert or update an entity in the comment collection.

**store.comment.delete(id)**: Type-scoped operation to remove an entity from the comment collection.

**store.loadEntities()**: Bulk operation to add multiple entities efficiently.

**store.subscribe()**: Register a callback for reactive updates when store data changes.

**useKalphiteStore()**: React hook that provides reactive access to the store with automatic re-renders.

## Architecture Terms

**Layer 1: In-Memory Store**: Core functionality - entity storage, collections, reactivity. Status: ✅ Complete.

**Layer 2: Memory Flush Engine**: Automatic persistence with debouncing. Status: 🚧 Planned.

**Layer 3: Frontend Database**: PGlite integration for browser-based SQL storage. Status: 📋 Planned.

**Layer 4: Network Sync**: Real-time collaboration and conflict resolution. Status: 📋 Planned.

**Memory-First**: Design philosophy where all data lives in memory for synchronous access, with persistence happening in the background.

**Optimistic Updates**: UI updates immediately when user performs an action, before sync completes.

## Implementation Terms

**TDD (Test-Driven Development)**: Kalphite's development methodology where tests define completion criteria.

**Acceptance Tests**: High-level tests that validate complete user workflows.

**Unit Tests**: Low-level tests that validate individual component behavior.

**Performance Benchmarks**: Tests that ensure operations meet speed requirements (e.g., <1ms for 10k entities).

**Completion-Defining Tests**: Tests that, when passing, indicate a feature is complete and production-ready.
