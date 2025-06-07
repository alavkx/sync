# Sync Engine API Update: Upsert/Delete/Query Design

> **🎯 New API**: Simplified from `create/update/delete/get/getByType` to `upsert/delete/query`

## 1. API Design Rationale

### Problems with Traditional CRUD in Sync Engines

**Traditional API (Before)**:

```typescript
interface SyncEngine {
  create(entityType: string, data: any): Promise<string>;
  update(entityId: string, data: any): Promise<void>;
  delete(entityId: string): Promise<void>;
  get(entityId: string): SyncEntity | null;
  getByType(entityType: string): SyncEntity[];
  query(predicate: Function): SyncEntity[];
}
```

**Issues**:

1. **Entity existence complexity**: Client must track whether entity exists locally vs remotely
2. **Create vs Update conflicts**: Different conflict resolution for creates vs updates
3. **Multiple read APIs**: Confusing when to use `get` vs `getByType` vs `query`
4. **Sync complexity**: Separate handling for create and update operations
5. **ID generation**: Who generates IDs - client or server?

### New Simplified API (After)

```typescript
interface SyncEngine {
  // Write operations
  upsert(entityId: string, entityType: string, data: any): Promise<void>;
  delete(entityId: string): Promise<void>;

  // Read operations
  query(querySpec: QuerySpec): Promise<SyncEntity[]>;

  // Sync operations (unchanged)
  push(): Promise<void>;
  pull(): Promise<void>;
}
```

## 2. Key Benefits

### ✅ **Simplified Write Operations**

**Before** (Complex):

```typescript
// Client must decide create vs update
const existingComment = await syncEngine.get(commentId);
if (existingComment) {
  await syncEngine.update(commentId, newData);
} else {
  await syncEngine.create("comment", newData);
}
```

**After** (Simple):

```typescript
// Always upsert - engine handles existence
await syncEngine.upsert(commentId, "comment", data);
```

### ✅ **Unified Conflict Resolution**

**Before**:

- Create conflicts: "Entity already exists"
- Update conflicts: "Entity doesn't exist"
- Different resolution strategies needed

**After**:

- Single conflict type: "Concurrent upsert"
- Unified resolution strategy (Last-Writer-Wins, merge, etc.)

### ✅ **Flexible Query Interface**

**Before** (Multiple APIs):

```typescript
// Get single entity
const comment = syncEngine.get("comment-123");

// Get by type
const comments = syncEngine.getByType("comment");

// Complex query
const filtered = syncEngine.query(
  (entity) => entity.data.authorId === "user-1"
);
```

**After** (Unified):

```typescript
// Get single entity
const [comment] = await syncEngine.query({ entityId: "comment-123" });

// Get by type
const comments = await syncEngine.query({ entityType: "comment" });

// Complex query with ordering and limit
const recentComments = await syncEngine.query({
  entityType: "comment",
  where: (entity) => entity.data.authorId === "user-1",
  orderBy: "updatedAt",
  limit: 10,
});
```

### ✅ **Better Sync Semantics**

**Change Log Simplification**:

```typescript
// Before: 3 operation types
type Operation = "create" | "update" | "delete";

// After: 2 operation types
type Operation = "upsert" | "delete";
```

**Database Schema**:

```sql
-- Simpler operation constraint
operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete'))
```

## 3. Implementation Examples

### Code Review Service Update

**Before**:

```typescript
// CodeReviewService had to handle create vs update
export class CodeReviewService {
  async addComment(input: CreateComment): Promise<CommentID> {
    const commentId = crypto.randomUUID();
    return this.syncEngine.create(ENTITY_TYPES.COMMENT, {
      id: commentId,
      ...input,
      authorId: this.currentUserId,
    }) as CommentID;
  }

  async updateComment(
    commentId: CommentID,
    updates: Partial<Comment>
  ): Promise<void> {
    await this.syncEngine.update(commentId, updates);
  }
}
```

**After**:

```typescript
// Unified upsert operation
export class CodeReviewService {
  async saveComment(commentId: CommentID, input: CreateComment): Promise<void> {
    await this.syncEngine.upsert(commentId, ENTITY_TYPES.COMMENT, {
      ...input,
      authorId: this.currentUserId,
    });
  }
}
```

### React Component Usage

**Before**:

```typescript
const { create, update, getByType } = useSyncEngine(clientId);

// Complex comment adding
const handleAddComment = async (message: string) => {
  const commentId = await create("comment", { message, lineNumber, filePath });
  // Hope the ID came back correctly...
};

// Separate comment editing
const handleEditComment = async (commentId: string, newMessage: string) => {
  await update(commentId, { message: newMessage });
};

// Get comments
const comments = getByType("comment");
```

**After**:

```typescript
const { upsert, query } = useSyncEngine(clientId);

// Unified comment operation
const handleSaveComment = async (commentId: string, message: string) => {
  await upsert(commentId, "comment", { message, lineNumber, filePath });
};

// Unified query
const comments = await query({ entityType: "comment" });
```

## 4. Migration Strategy

### Phase 1: Update Types

- [x] Update `ChangeSchema` to use `upsert | delete`
- [x] Update `SyncEngine` interface
- [x] Add `QuerySpec` interface

### Phase 2: Update Storage Schema

- [x] Update database constraints for new operations
- [x] Update replication log schema

### Phase 3: Update Implementation

- [ ] Update `SimpleSyncEngine` to use new API
- [ ] Update `PersistentSyncEngine` to use new API
- [ ] Update `CodeReviewService` to use new API

### Phase 4: Update UI Components

- [ ] Update `useCodeReview` hook
- [ ] Update `CodeReviewDemo` component
- [ ] Update comment handling logic

## 5. Backward Compatibility

For existing code using the old API, we can provide adapter methods:

```typescript
export class BackwardCompatibleSyncEngine implements SyncEngine {
  // New API (primary)
  async upsert(entityId: string, entityType: string, data: any): Promise<void> {
    // Implementation...
  }

  async query(querySpec: QuerySpec): Promise<SyncEntity[]> {
    // Implementation...
  }

  // Legacy API (adapters)
  async create(entityType: string, data: any): Promise<string> {
    const entityId = crypto.randomUUID();
    await this.upsert(entityId, entityType, data);
    return entityId;
  }

  async update(entityId: string, data: any): Promise<void> {
    const [existing] = await this.query({ entityId });
    if (!existing) throw new Error("Entity not found");
    await this.upsert(entityId, existing.type, { ...existing.data, ...data });
  }

  get(entityId: string): SyncEntity | null {
    // Convert async query to sync (cache required)
    return this.cachedEntities.get(entityId) || null;
  }
}
```

## 6. Testing Updates

### Unit Tests

- [ ] Test upsert creates new entities
- [ ] Test upsert updates existing entities
- [ ] Test query with various QuerySpec options
- [ ] Test delete operation

### Integration Tests

- [ ] Test upsert conflict resolution
- [ ] Test query performance with large datasets
- [ ] Test sync operations with new change types

## 7. Benefits Summary

✅ **Simpler API**: 3 methods instead of 6  
✅ **Unified Conflicts**: Single conflict resolution strategy  
✅ **Better Sync**: Cleaner change log with 2 operations  
✅ **Flexible Queries**: Composable query interface  
✅ **Future-Proof**: Easier to extend and optimize

The new API eliminates the complexity of tracking entity existence and provides a more natural interface for sync operations. This design is inspired by modern databases and sync systems like Replicache.

**Ready to implement the new API in the existing sync engine?** 🚀
