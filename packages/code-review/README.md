# Code Review App

> A demonstration application showcasing the Kalphite sync engine in action

This is a real-time code review tool built with the Kalphite sync engine. It demonstrates how to build collaborative applications with memory-first sync, schema validation, and optimistic updates.

## Features

- **Real-time Comments**: Add comments to specific lines of code
- **Review Status**: Track review approval status
- **Optimistic Updates**: UI updates instantly, sync happens in background
- **Type Safety**: Full TypeScript integration with Zod schema validation
- **Memory-First**: All data lives in memory for synchronous access

## Tech Stack

- **Sync Engine**: Kalphite (schema-agnostic, memory-first)
- **Frontend**: React 19, TanStack Start
- **Styling**: Tailwind CSS
- **Schema**: Zod with Standard Schema integration
- **Build**: Vite, TypeScript

## Project Structure

```
packages/code-review-app/
├── code-review/
│   ├── schema.ts           # Entity schema for Kalphite
│   ├── service.ts          # Business logic service
│   └── use-code-review.ts  # React hook
├── components/
│   ├── CodeReviewDemo.tsx  # Main demo component
│   └── Header.tsx          # App header
├── store/
│   └── index.ts           # Kalphite store initialization
├── routes/                # TanStack Router routes
├── client.tsx            # Client entry point
├── router.tsx            # Router configuration
└── package.json          # App dependencies
```

## Key Concepts Demonstrated

### Schema-First Design

The app defines entities using Zod schemas that integrate with Kalphite:

```typescript
// Entity schema for Kalphite
const EntitySchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("comment"),
    data: z.object({
      reviewId: z.string(),
      filePath: z.string(),
      lineNumber: z.number(),
      side: z.enum(["base", "head"]),
      authorId: z.string(),
      message: z.string(),
      // ... more fields
    }),
    updatedAt: z.number(),
  }),
  // ... more entity types
]);
```

### Memory-First Operations

All operations are synchronous and optimistic:

```typescript
// Add a comment - instant UI update
const comment = addComment({
  reviewId: "review-123",
  filePath: "src/App.tsx",
  lineNumber: 42,
  side: "head",
  message: "Looks good!",
});

// Data is immediately available
const comments = getCommentsForLine("src/App.tsx", 42, "head");
```

### Service Layer Pattern

Business logic is encapsulated in a service class:

```typescript
export class CodeReviewService {
  addComment(params) {
    /* ... */
  }
  updateReviewStatus(reviewId, status) {
    /* ... */
  }
  getCommentsForLine(filePath, lineNumber, side) {
    /* ... */
  }
}
```

### React Integration

Simple hook pattern with automatic re-renders:

```typescript
function MyComponent() {
  const { comments, addComment, store } = useCodeReview("user-123");

  // Component re-renders automatically when data changes
  return (
    <div>
      {comments.map((comment) => (
        <div key={comment.id}>{comment.message}</div>
      ))}
    </div>
  );
}
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Learning Outcomes

This app demonstrates:

1. **Schema Integration**: How to define and use schemas with Kalphite
2. **Service Pattern**: Organizing business logic around the sync engine
3. **React Patterns**: Simple hooks with automatic re-rendering
4. **Type Safety**: End-to-end TypeScript with schema validation
5. **Optimistic Updates**: Instant UI feedback with background sync

Perfect for understanding how to build real applications with the Kalphite sync engine! 🚀
