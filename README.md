# Kalphite Monorepo

This repository contains two main components:

## 📦 Packages

### 1. **Kalphite Sync Engine** (`packages/kalphite/`)

A schema-agnostic, memory-first sync engine library for real-time applications.

- **Purpose**: Reusable sync engine library
- **Features**: Memory-first architecture, Standard Schema integration, React hooks
- **Usage**: `npm install @kalphite/sync-engine`

[📖 Library Documentation](./packages/kalphite/README.md)

### 2. **Code Review App** (`packages/code-review-app/`)

A demonstration application that uses the Kalphite sync engine to build a real-time code review tool.

- **Purpose**: Example application showcasing Kalphite
- **Features**: Real-time comments, reviews, collaborative editing
- **Tech Stack**: TanStack Start, React, Tailwind CSS, Zod

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start the code review app (includes library build)
pnpm dev

# Build everything
pnpm build
```

## 📚 Documentation

- **[Complete Architecture Guide](./docs/memory-first-sync-master.md)** - Detailed documentation of the memory-first sync strategy
- **[Library README](./packages/kalphite/README.md)** - Quick start guide for using Kalphite
- **[Project Requirements](./docs/prd.md)** - Original code review app requirements

## 🏗️ Project Structure

```
kalphite-monorepo/
├── packages/
│   ├── kalphite/                 # 📦 Sync engine library
│   │   ├── src/
│   │   │   ├── store/           # Core store implementation
│   │   │   ├── react/           # React integration
│   │   │   ├── types/           # TypeScript definitions
│   │   │   └── index.ts         # Main exports
│   │   └── package.json
│   └── code-review-app/         # 🎯 Demo application
│       ├── src/
│       │   ├── components/      # React components
│       │   ├── routes/          # TanStack Router routes
│       │   └── code-review/     # App-specific logic
│       └── package.json
├── docs/                        # 📖 Documentation
└── package.json                 # Root workspace config
```

## 🎯 Philosophy

This project demonstrates a **radical simplification** of sync engines:

- **Memory-First**: All data lives in memory for synchronous access
- **Schema-Agnostic**: Use any Standard Schema compliant library
- **Optimistic Updates**: UI updates instantly, sync happens in background
- **Developer Experience**: Simple API, impossible to get wrong

Perfect for learning sync engine concepts, prototyping, and building real applications where "fast enough" is good enough.

## 🔄 Development

```bash
# Work on the library
cd packages/kalphite
pnpm dev

# Work on the app
cd packages/code-review-app
pnpm dev

# Run tests
pnpm test

# Clean everything
pnpm clean
```

## 📄 License
