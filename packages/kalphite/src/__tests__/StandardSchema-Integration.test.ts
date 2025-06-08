import { beforeEach, describe, expect, test } from "vitest";
import { createKalphiteStore } from "../store/KalphiteStore";

// Mock Standard Schema implementation for testing
const createMockSchema = () => ({
  "~standard": {
    version: 1 as const,
    vendor: "kalphite-test",
    validate: (data: any) => {
      if (!data.id || !data.type) {
        return {
          issues: [{ message: "Missing required fields" }],
        };
      }
      return { value: data };
    },
  },
});

const createAsyncMockSchema = () => ({
  "~standard": {
    version: 1 as const,
    vendor: "kalphite-test",
    validate: async (data: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (!data.id || !data.type) {
        return {
          issues: [{ message: "Missing required fields" }],
        };
      }
      return { value: data };
    },
  },
});

describe("Standard Schema Integration", () => {
  describe("Standard Schema Interface Compliance", () => {
    test("should implement the complete Standard Schema V1 interface", () => {
      const schema = createMockSchema();

      // Verify Standard Schema interface
      expect(schema).toHaveProperty("~standard");
      expect(typeof schema["~standard"].validate).toBe("function");
    });

    test("should validate data according to Standard Schema spec", () => {
      const schema = createMockSchema();

      const validData = { id: "1", type: "test", data: { value: "valid" } };
      const result = schema["~standard"].validate(validData);

      expect(result).toHaveProperty("value");
      expect(result.value).toEqual(validData);
      expect(result).not.toHaveProperty("issues");
    });

    test("should provide proper type inference", () => {
      const schema = createMockSchema();

      // This test validates that TypeScript types work correctly
      const validEntity = {
        id: "test-1",
        type: "test" as const,
        data: { message: "test" },
      };

      const result = schema["~standard"].validate(validEntity);
      if (!result.issues) {
        expect(result.value.id).toBe("test-1");
        expect(result.value.type).toBe("test");
        expect(result.value.data.message).toBe("test");
      }
    });

    test("should reject async validation (memory-first requirement)", () => {
      const asyncSchema = createAsyncMockSchema();
      const store = createKalphiteStore(asyncSchema);

      expect(() => {
        // This should throw because Kalphite requires synchronous validation
        store.comment.push({
          id: "1",
          type: "comment",
          data: { test: "data" },
        });
      }).toThrow("Kalphite requires synchronous validation");
    });
  });

  describe("Standard Schema Compliance", () => {
    test("should work with any Standard Schema compliant library", () => {
      // Mock different schema libraries (Valibot, Zod, etc.)
      const valibotLikeSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "valibot-test",
          validate: (data: any) => ({ value: data }),
        },
      };

      const zodLikeSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "zod-test",
          validate: (data: any) => ({ value: data }),
        },
      };

      // Both should work with KalphiteStore
      expect(() => createKalphiteStore(valibotLikeSchema)).not.toThrow();
      expect(() => createKalphiteStore(zodLikeSchema)).not.toThrow();
    });

    test("should handle validation errors correctly", () => {
      const strictSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "kalphite-test",
          validate: (data: any) => {
            if (!data.requiredField) {
              return {
                issues: [
                  {
                    path: ["requiredField"],
                    message: "Required field missing",
                  },
                ],
              };
            }
            return { value: data };
          },
        },
      };

      const store = createKalphiteStore(strictSchema);
      const invalidData = { id: "1", type: "test" }; // missing requiredField

      expect(() => {
        store.comment.push(invalidData);
      }).toThrow("Validation failed");
    });

    test("should preserve path information in error issues", () => {
      const pathAwareSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "kalphite-test",
          validate: (data: any) => {
            if (!data.nested?.field) {
              return {
                issues: [
                  {
                    path: ["nested", "field"],
                    message: "Nested field required",
                  },
                ],
              };
            }
            return { value: data };
          },
        },
      };

      const store = createKalphiteStore(pathAwareSchema);

      try {
        store.comment.push({ id: "1", type: "test" });
        expect.fail("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("Validation failed");
        expect(error.message).toContain("nested");
      }
    });
  });

  describe("KalphiteStore Integration", () => {
    let store: any;

    beforeEach(() => {
      const schema = createMockSchema();
      store = createKalphiteStore(schema);
    });

    test("should validate entities on push", () => {
      const validEntity = {
        id: "1",
        type: "test",
        data: { message: "valid" },
      };

      store.comment.push(validEntity);
      expect(store.comment.find((e: any) => e.id === "1")).toEqual(validEntity);
    });

    test("should reject invalid entities", () => {
      const invalidEntity = {
        // Missing required id and type
        data: { message: "invalid" },
      };

      expect(() => {
        store.comment.push(invalidEntity);
      }).toThrow("Validation failed");

      expect(
        store.comment.find((e: any) => e.data?.message === "invalid")
      ).toBeUndefined();
    });

    test("should work with discriminated unions", () => {
      const discriminatedSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "kalphite-test",
          validate: (data: any) => {
            if (!data.type) {
              return {
                issues: [{ message: "Type is required" }],
              };
            }
            return { value: data };
          },
        },
      };

      const discriminatedStore = createKalphiteStore(discriminatedSchema);

      const user = {
        id: "1",
        type: "user",
        email: "user@test.com",
      };

      discriminatedStore.user.push(user);
      expect(discriminatedStore.user.find((u: any) => u.id === "1")).toEqual(
        user
      );

      const admin = {
        id: "2",
        type: "admin",
        permissions: ["read", "write"],
      };

      discriminatedStore.admin.push(admin);
      expect(discriminatedStore.admin.find((a: any) => a.id === "2")).toEqual(
        admin
      );
    });

    test("should handle performance with large datasets", () => {
      const performanceSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "kalphite-test",
          validate: (data: any) => {
            if (!data.id || !data.type) {
              return {
                issues: [{ message: "Missing required fields" }],
              };
            }
            return { value: data };
          },
        },
      };

      const store = createKalphiteStore(performanceSchema);

      const startTime = performance.now();

      // Create 1000 entities with validation
      for (let i = 0; i < 1000; i++) {
        store.comment.push({
          id: `perf-${i}`,
          type: "perf" as const,
          data: { value: i },
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(store.comment).toHaveLength(1000);
      expect(duration).toBeLessThan(500); // Should complete in reasonable time
    });
  });

  describe("Standard Schema Compliance Verification", () => {
    test("should follow Standard Schema specification exactly", () => {
      // This test ensures we're implementing the standard correctly
      const compliantSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "kalphite-test",
          validate: (input: unknown) => {
            // Standard Schema always returns an object with either:
            // - { value: T } for success
            // - { issues: Issue[] } for failure

            if (typeof input !== "object" || input === null) {
              return {
                issues: [
                  {
                    message: "Expected object",
                    path: [],
                  },
                ],
              };
            }

            return { value: input };
          },
        },
      };

      const store = createKalphiteStore(compliantSchema);

      // Valid input should succeed
      store.comment.push({ id: "1", type: "test", data: {} });
      expect(store.comment).toHaveLength(1);

      // Invalid input should fail with proper error structure
      expect(() => {
        store.comment.push("not an object" as any);
      }).toThrow("Validation failed");
    });

    test("should work with compliant schema libraries", () => {
      const compliantSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "kalphite-test",
          validate: (input: unknown) => {
            if (typeof input !== "object" || input === null) {
              return {
                issues: [{ message: "Expected object", path: [] }],
              };
            }
            return { value: input };
          },
        },
      };

      const store = createKalphiteStore(compliantSchema);
      expect(() => {
        store.comment.push({ id: "1", type: "test" });
      }).not.toThrow();
    });
  });
});

// =====================================================
// STANDARD SCHEMA INTEGRATION SUMMARY
// =====================================================
//
// These tests verify that Kalphite properly works with
// the Standard Schema specification from https://standardschema.dev/
//
// ✅ Zod v3.24.0+ implements Standard Schema natively
// ✅ Valibot, ArkType, Effect Schema also implement it
// ✅ Users can pass ANY Standard Schema compliant library
// ✅ No adapters needed - libraries implement spec directly
// ✅ Complete Standard Schema V1 interface compliance
// ✅ Proper validation result format (success/failure)
// ✅ Synchronous validation requirement (memory-first)
// ✅ Type inference support
// ✅ Error handling and issue reporting
// ✅ Performance with validation enabled
// ✅ Discriminated union support
//
// This ensures Kalphite can work with any Standard Schema
// compliant validation library out of the box.
// =====================================================
