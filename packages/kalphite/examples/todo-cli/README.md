# Todo CLI - Kalphite Real-World Example

This is a complete todo CLI application built with **Kalphite** that demonstrates all the core features of our memory-first sync engine. It serves as both a working application and our primary testing ground for Kalphite development.

## 🎯 Purpose

- **Real-world testing**: Test Kalphite with actual application patterns
- **Performance validation**: Verify scalability with 1000+ entities
- **API demonstration**: Show memory-first, synchronous operations
- **Layer testing**: Foundation for testing Layer 2-4 implementations

## 🚀 Quick Start

```bash
# From the kalphite package directory
pnpm run test:cli      # Run the comprehensive test suite
pnpm run todo:demo     # Load demo data and explore

# Basic commands
pnpm run todo help     # Show all commands
pnpm run todo list     # List all todos
pnpm run todo add "Buy groceries"
pnpm run todo complete 1
```

## 📋 Features

### ✅ Layer 1 (In-Memory Store) - COMPLETE

- **Synchronous operations** - No async/await needed
- **Memory-first** - All data immediately available
- **Functional queries** - `where()`, `orderBy()`, `findById()`
- **Type-safe schema** - Zod validation with TypeScript
- **Real-time updates** - Subscription system for UI reactivity
- **High performance** - 1000+ todos in <100ms

### 🔮 Layer 2 (Memory Flush Engine) - PLANNED

- Automatic persistence to local storage
- Configurable flush intervals
- Transaction batching
- Recovery on startup

### 🔮 Layer 3 (Frontend Database) - PLANNED

- PGlite integration for complex queries
- SQL query capabilities
- Offline-first architecture
- Data migration support

### 🔮 Layer 4 (Network Sync) - IN PROGRESS

- Operation-based sync with WebSocket notifications
- Optimistic updates with conflict resolution
- Multi-device synchronization
- Collaborative editing
- Offline operation queuing
- State synchronization

## 🏗️ Architecture

### Schema Design

```typescript
// Entity types with discriminated unions
Todo | Project | Tag | User | Comment

// Todos have rich metadata
{
  title: string,
  status: "pending" | "in-progress" | "completed" | "cancelled",
  priority: "low" | "medium" | "high" | "urgent",
  dueDate?: number,
  tags: string[],
  projectId?: string
}
```

### Store Integration

```typescript
// Create typed store with Zod schema
const todoStore = KalphiteStore(EntitySchema);

// Access typed collections
todoStore.todo.upsert(id, todo); // Returns entity immediately
todoStore.todo.findById(id); // Synchronous lookup
todoStore.todo.where(predicate); // Functional filtering
```

### Real-World Patterns

```typescript
// No async/await needed - everything is synchronous!
const todo = createTodo(generateId(), "New task");
const result = todoStore.todo.upsert(todo.id, todo); // ✅ Immediate
const found = todoStore.todo.findById(todo.id); // ✅ Immediate
const filtered = todoStore.todo.where((t) => t.data.status === "pending"); // ✅ Immediate
```

## 📊 Performance Benchmarks

Our tests validate these performance characteristics:

- **Create 1000 todos**: <100ms (avg 0.1ms per todo)
- **Query 1000 todos**: <10ms (urgent priority filter)
- **Update 500 todos**: <50ms (status changes)
- **Memory efficiency**: Minimal overhead per entity

## 🧪 Testing Strategy

### Test Categories

1. **Basic Operations** - CRUD with immediate verification
2. **Functional Queries** - `where()`, `orderBy()`, chaining
3. **Project Organization** - Relational data patterns
4. **Performance Testing** - Scale validation
5. **Demo Integration** - Real usage patterns
6. **Memory-First Validation** - Synchronous operation verification
7. **Operation Sync** - WebSocket and HTTP sync testing

### Example Test

```typescript
test("should demonstrate memory-first approach", () => {
  const todo = createTodo(generateId(), "Test task");

  // All operations are synchronous - no promises!
  const result = todoStore.todo.upsert(todo.id, todo); // ✅ Immediate
  expect(result).toEqual(todo);

  const found = todoStore.todo.findById(todo.id); // ✅ Immediate
  expect(found).toEqual(todo);

  const deleted = todoStore.todo.delete(todo.id); // ✅ Immediate
  expect(deleted).toBe(true);
});
```

## 🔧 Commands Reference

### Core Operations

- `todo list` - Show all todos with status icons
- `todo add "title"` - Create new todo
- `todo complete <number>` - Mark todo as done
- `todo delete <number>` - Remove todo

### Filtering & Organization

- `todo status <status>` - Filter by status
- `todo tag <tagname>` - Filter by tag
- `todo projects` - Show all projects

### Testing & Demo

- `todo demo` - Load realistic demo data
- `todo perf` - Run performance benchmarks
- `todo stats` - Show detailed statistics
- `todo clear` - Reset all data

### Utility

- `todo help` - Show full command reference

## 🎨 Visual Features

The CLI uses rich formatting to demonstrate data relationships:

```
📝 Todo List (5 items)

1. ⏳ 🔥 URGENT: Fix critical bug [Web App] (due: 12/25/2024) ⚠️ OVERDUE
   📄 System crashes on user login
   🏷️  urgent, bug

2. 🔄 🔴 Code review [Web App]
   📄 Review authentication module
   🏷️  review, security

3. ✅ 🟡 Setup CI/CD [DevOps]
   🏷️  deployment
```

## 🧑‍💻 Development

### Adding New Commands

```typescript
// In cli.ts
const commands = {
  newCommand: (param1: string, param2: string) => {
    // Use todoStore.todo.* for data operations
    // All operations are synchronous!
  },
};
```

### Adding New Entity Types

```typescript
// In schema.ts
export const NewEntitySchema = z.object({
  id: z.string(),
  type: z.literal("newentity"),
  // ... other fields
});

// Add to union
export const EntitySchema = z.discriminatedUnion("type", [
  TodoSchema,
  NewEntitySchema, // ← Add here
  // ...
]);
```

### Performance Testing

```typescript
// Add to cli.ts perf command
const startTime = performance.now();
// ... operations
const duration = performance.now() - startTime;
console.log(`Operation took ${duration.toFixed(2)}ms`);
```

## 🚀 Future Roadmap

### Layer 2: Memory Flush Engine

```typescript
// Will add automatic persistence
todoStore.enablePersistence({
  flushInterval: 5000, // 5 second intervals
  storage: "localStorage", // Browser storage
  compression: true, // Compress data
});
```

### Layer 3: Frontend Database

```typescript
// Will add SQL capabilities
const results = await todoStore.query`
  SELECT * FROM todos 
  WHERE status = 'pending' 
  AND dueDate < ${Date.now()}
  ORDER BY priority DESC
`;
```

### Layer 4: Network Sync

```typescript
// Operation-based sync with WebSocket notifications
const syncEngine = new OperationSyncEngine({
  wsUrl: "wss://api.example.com/sync",
  httpUrl: "https://api.example.com/sync",
  roomId: "todo-room",
  userId: "user-123",
});

// Enable sync
todoStore.enableSync(syncEngine);

// Operations are now synced across devices
const todo = createTodo(generateId(), "New task");
todoStore.todo.upsert(todo.id, todo); // ✅ Synced immediately
```

## 🤝 Contributing

This CLI app is our primary development tool. When adding features to Kalphite:

1. **Test here first** - Add commands that exercise new functionality
2. **Write tests** - Use `TodoCLI-RealWorld.test.ts` as the pattern
3. **Validate performance** - Ensure new features maintain speed targets
4. **Update docs** - Keep this README current

The todo CLI proves that Kalphite delivers on its core promise: **memory-first, synchronous, high-performance data operations** that make building applications simpler and faster.

---

_Built with ❤️ using Kalphite - The Memory-First Sync Engine_
