# React Integration: useSyncExternalStore + Memory Store

> **🎯 Goal**: Efficiently sync React state with our in-memory store using React 18's `useSyncExternalStore`

## Why useSyncExternalStore?

### ✅ **Perfect for External Stores**

`useSyncExternalStore` is designed exactly for our use case - subscribing to external data sources that exist outside React's component tree.

### ✅ **Handles React 18 Concurrent Features**

- Automatic batching
- Concurrent rendering
- Suspense integration
- Server-side rendering compatibility
- Hydration mismatch handling

### ✅ **Better Than Manual Observer Pattern**

```typescript
// ❌ Manual observer (fragile)
const [comments, setComments] = useState([]);
useEffect(() => {
  const unsubscribe = store.onChange(() => {
    setComments(store.getByType("comment")); // Can cause render loops!
  });
  return unsubscribe;
}, []);

// ✅ useSyncExternalStore (robust)
const comments = useSyncExternalStore(store.subscribe, () =>
  store.getByType("comment")
);
```

## Implementation Strategy

### Enhanced Memory Store with React Integration

```typescript
interface Entity {
  id: string;
  type: string;
  data: any;
  updatedAt: number;
}

class MemoryStore {
  private _entities = new Map<string, Entity>();
  private subscribers = new Set<() => void>();
  private flushEngine: MemoryFlushEngine;

  constructor(flushEngine: MemoryFlushEngine) {
    this.flushEngine = flushEngine;
  }

  // Proxy-wrapped entities for automatic change detection
  get entities() {
    return new Proxy(this._entities, {
      set: (target, prop, value) => {
        const result = Reflect.set(target, prop, value);

        if (typeof prop === "string" && value) {
          // Auto-flush to PGlite layer
          this.flushEngine.scheduleFlush(prop, value);

          // Notify React subscribers
          this.notifySubscribers();
        }

        return result;
      },

      deleteProperty: (target, prop) => {
        const existing = target.get(prop as string);
        const result = Reflect.deleteProperty(target, prop);

        if (typeof prop === "string" && existing) {
          // Auto-flush deletion
          this.flushEngine.scheduleFlush(prop, { ...existing, deleted: true });

          // Notify React subscribers
          this.notifySubscribers();
        }

        return result;
      },
    });
  }

  // Synchronous read operations (fast!)
  getById(id: string): Entity | null {
    return this._entities.get(id) || null;
  }

  getByType(type: string): Entity[] {
    return Array.from(this._entities.values()).filter((e) => e.type === type);
  }

  getAll(): Entity[] {
    return Array.from(this._entities.values());
  }

  // React integration: Subscribe function for useSyncExternalStore
  subscribe = (callback: () => void): (() => void) => {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  };

  // React integration: Notify all subscribers
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback());
  }

  // Load entities from PGlite into memory (called during initialization)
  loadFromPGlite(entities: Entity[]): void {
    entities.forEach((entity) => {
      this._entities.set(entity.id, entity);
    });

    // Notify React after bulk load
    this.notifySubscribers();
  }
}
```

## React Hooks for Memory Store

### Single Store Hook (Radically Simple!)

```typescript
// One hook to rule them all - returns the entire store
export function useMemoryStore(): MemoryStore {
  return useSyncExternalStore(
    store.subscribe,
    () => store, // Return entire store
    () => store // SSR fallback - same store
  );
}
```

That's it! Every component gets the full store and can access whatever it needs. Any change anywhere triggers re-render everywhere. Simple!

## Component Usage Examples

### Simple Comment List

```typescript
const CommentList = () => {
  // Get entire store - re-renders on ANY change
  const store = useMemoryStore();

  // Extract what we need from the store
  const comments = store.getByType("comment");

  const handleAddComment = (message: string) => {
    const id = crypto.randomUUID();

    // Immediate optimistic update
    store.entities.set(id, {
      id,
      type: "comment",
      data: { message, lineNumber: 42, authorId: "user-1" },
      updatedAt: Date.now(),
    });
  };

  return (
    <div>
      <h2>Comments ({comments.length})</h2>
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
      <button onClick={() => handleAddComment("New comment!")}>
        Add Comment
      </button>
    </div>
  );
};
```

### File View with Line Comments

```typescript
const FileView = ({ filePath }: { filePath: string }) => {
  // Get entire store - re-renders on ANY change
  const store = useMemoryStore();

  // Extract and filter what we need
  const fileComments = store
    .getByType("comment")
    .filter((c) => c.data.filePath === filePath);

  // Group comments by line number (computed every render - simple!)
  const commentsByLine: Record<number, Entity[]> = {};
  fileComments.forEach((comment) => {
    const line = comment.data.lineNumber;
    if (!commentsByLine[line]) commentsByLine[line] = [];
    commentsByLine[line].push(comment);
  });

  return (
    <div className="file-view">
      {/* Render file lines with inline comments */}
      {Array.from({ length: 100 }, (_, i) => i + 1).map((lineNumber) => (
        <div key={lineNumber} className="line">
          <span className="line-number">{lineNumber}</span>
          <span className="line-content">// Some code here</span>

          {/* Comments for this line */}
          {commentsByLine[lineNumber]?.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}

          <AddCommentButton filePath={filePath} lineNumber={lineNumber} />
        </div>
      ))}
    </div>
  );
};
```

### Dashboard

```typescript
const Dashboard = () => {
  // Get entire store - re-renders on ANY change
  const store = useMemoryStore();

  // Compute stats directly (every render - simple!)
  const comments = store.getByType("comment");
  const reviews = store.getByType("review");

  const totalComments = comments.length;
  const totalReviews = reviews.length;
  const pendingReviews = reviews.filter(
    (r) => r.data.status === "pending"
  ).length;
  const recentActivity = Math.max(
    ...comments.map((c) => c.updatedAt),
    ...reviews.map((r) => r.updatedAt)
  );

  return (
    <div className="dashboard">
      <StatCard title="Total Comments" value={totalComments} />
      <StatCard title="Total Reviews" value={totalReviews} />
      <StatCard title="Pending Reviews" value={pendingReviews} />
      <StatCard
        title="Last Activity"
        value={new Date(recentActivity).toLocaleTimeString()}
      />
    </div>
  );
};
```

## Advanced Patterns

None needed! Just use `useMemoryStore()` and access whatever you need.

Want recent changes? `store.getAll().filter(e => Date.now() - e.updatedAt < 5000)`
Want comments for a file? `store.getByType('comment').filter(c => c.data.filePath === filePath)`  
Want stats? Just compute them inline.

**Embrace the re-renders!** Modern React is fast.

## Performance Trade-offs

### ❌ **Every Component Re-renders**

All components using `useMemoryStore()` will re-render when ANY entity changes.

### ✅ **But It's Simple!**

- No complex selectors to debug
- No stale closure bugs
- No optimization premature
- Just direct, predictable updates

### ✅ **React 18 Helps**

- Automatic batching reduces render frequency
- Concurrent features prevent blocking
- Modern React handles many re-renders efficiently

## Migration from Current Approach

### Before (Complex Async)

```typescript
const [comments, setComments] = useState<Comment[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const loadComments = async () => {
    setLoading(true);
    const result = await syncEngine.query({ entityType: "comment" });
    setComments(result);
    setLoading(false);
  };
  loadComments();
}, []);
```

### After (Simple Sync)

```typescript
const store = useMemoryStore(); // Get entire store
const comments = store.getByType("comment"); // Always sync, never loading
```

## Summary

✅ **One hook** to rule them all: `useMemoryStore()`  
✅ **Automatic re-renders** when ANY data changes  
✅ **Radical simplicity** - no selectors, no optimization  
✅ **Concurrent safe** with React 18 features  
✅ **Predictable** - every change triggers re-render

**Ready to embrace the beautiful simplicity?** 🚀
