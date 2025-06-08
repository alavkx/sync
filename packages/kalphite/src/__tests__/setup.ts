// Test setup and configuration
import { afterEach, beforeEach } from "vitest";

// Global test setup
beforeEach(() => {
  // Reset any global state
  if (typeof globalThis !== "undefined") {
    // Clear any cached store instances
    delete (globalThis as any).__kalphite_store__;
  }
});

afterEach(() => {
  // Clean up after each test
  if (typeof globalThis !== "undefined") {
    delete (globalThis as any).__kalphite_store__;
  }
});

// Mock React hooks for testing
export const createMockUseState = <T>(initial: T) => {
  let state = initial;
  const setState = (newState: T | ((prev: T) => T)) => {
    state =
      typeof newState === "function" ? (newState as any)(state) : newState;
  };
  return () => [state, setState] as const;
};

// Test entity fixtures
export const createTestEntity = (id: string, type: string, data: any = {}) => ({
  id,
  type,
  data,
  updatedAt: Date.now(),
});

export const createCommentEntity = (
  id: string,
  message: string,
  lineNumber: number = 1
) => createTestEntity(id, "comment", { message, lineNumber });

export const createReviewEntity = (
  id: string,
  title: string,
  status: string = "draft"
) => createTestEntity(id, "review", { title, status });
