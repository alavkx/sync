# Kalphite Documentation

> Memory-first sync engine with intuitive API

## Quick Start

- **[📖 Main Documentation](./kalphite/README.md)** - Complete overview and API guide
- **[Setup Guide](./kalphite/setup.md)** - Development setup and troubleshooting

## Understanding Kalphite

- **[Architecture](./kalphite/architecture.md)** - Complete technical design
- **[Status](./kalphite/status.md)** - Current progress and roadmap
- **[Decisions](./kalphite/decisions.md)** - Key architectural choices

## Development

- **[Testing](./kalphite/testing.md)** - Test-driven methodology

---

## Current Status

**Ready**: Local development ✅  
**Coming**: Persistence (Layer 2) 🚧  
**Future**: Real-time sync 📋

## API Highlight

```typescript
const store = KalphiteStore(schema);

// Intuitive access
const comments = store.comment;
const reviews = store.review;

// Type-safe operations
store.comment.upsert("id", entity);
store.review.delete("id");

// Natural queries
const urgent = store.comment.filter((c) => c.data.priority === "high");
```

No async/await. No loading states. Just synchronous simplicity.
