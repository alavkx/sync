# 🧠 Kalphite Decisions

Key architectural choices and why we made them.

## AD001: Proxy API ✅

**Problem**: `store.getByType("comment")` feels verbose and async-heavy

**Solution**: `store.comment` via Proxy + TypedCollection

**Why**:

- Intuitive: `store.comment` reads naturally
- Array-like: `store.comment.filter()` works
- Type-safe: Each collection has proper methods
- Zero overhead: Proxy adds no performance cost

**Trade-off**: More complex implementation vs. dramatically better DX

## AD002: Test-Driven Development ✅

**Why**: Tests define desired API before implementation. Our revolutionary API came from a failing test.

**Result**: 31 tests provide rock-solid foundation, all docs validated

## AD003: Four-Layer Architecture ✅

**Why**:

- Clean separation: Each layer has single responsibility
- Incremental value: Layer 1 works perfectly alone
- Clear roadmap: Obvious implementation order

**Layers**: Memory → Flush → Sync → Production

## AD004: TypedCollection ✅

**Problem**: Proxy needs to return array-like objects with entity operations

**Solution**: Class extending Array with `upsert()`, `delete()` methods

**Why**: Native array methods work + entity-specific operations

## AD005: API Simplicity ✅

**Decision**: Single API pattern: `store.comment` for everything

**Why**: Consistency, predictability, zero cognitive overhead

## AD006: Performance-First ✅

**Standard**: 10k entities, <1ms reads, <10ms bulk writes

**Why**: No performance surprises, competitive advantage, test-enforced

## Principles

1. **Developer Experience First**: APIs should feel natural
2. **Test-Driven Design**: Failing tests guide architecture
3. **Performance by Default**: Fast from the start
4. **Simple & Consistent**: One way to do things
5. **Incremental Value**: Each layer provides immediate benefit
