import { beforeEach, describe, expect, test } from "vitest";
import { z } from "zod";
import {
  createZodStandardSchemaAdapter,
  ensureZodStandardSchema,
} from "../adapters/ZodStandardSchemaAdapter";
import { KalphiteStore } from "../store/KalphiteStore";
import type { StandardSchemaV1 } from "../types/StandardSchema";

describe("Standard Schema Integration", () => {
  describe("Standard Schema Interface Compliance", () => {
    test("should implement the complete Standard Schema V1 interface", () => {
      const userSchema = z.object({
        id: z.string(),
        type: z.literal("user"),
        name: z.string(),
        email: z.string().email(),
      });

      const standardSchema = ensureZodStandardSchema(userSchema);

      // Verify the Standard Schema structure
      expect(standardSchema).toHaveProperty("~standard");
      expect(standardSchema["~standard"]).toHaveProperty("version", 1);
      expect(standardSchema["~standard"]).toHaveProperty("vendor", "zod");
      expect(standardSchema["~standard"]).toHaveProperty("validate");
      expect(typeof standardSchema["~standard"].validate).toBe("function");

      // types property is optional according to Standard Schema spec
      if (standardSchema["~standard"].types) {
        expect(standardSchema["~standard"].types).toHaveProperty("input");
        expect(standardSchema["~standard"].types).toHaveProperty("output");
      }
    });

    test("should validate data according to Standard Schema spec", () => {
      const userSchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      });

      const standardSchema = ensureZodStandardSchema(userSchema);

      // Valid data should return success result
      const validData = {
        id: "123",
        name: "John Doe",
        email: "john@example.com",
      };

      const successResult = standardSchema["~standard"].validate(validData);
      expect(successResult).toHaveProperty("value", validData);
      // Success results should NOT have 'issues' property per Standard Schema spec
      expect(successResult).not.toHaveProperty("issues");

      // Invalid data should return failure result
      const invalidData = {
        id: 123, // Should be string
        name: "John Doe",
        email: "invalid-email", // Invalid email format
      };

      const failureResult = standardSchema["~standard"].validate(invalidData);

      // Should be synchronous
      expect(failureResult).not.toBeInstanceOf(Promise);

      if (!(failureResult instanceof Promise)) {
        expect(failureResult).toHaveProperty("issues");
        expect(failureResult.issues).toBeInstanceOf(Array);
        expect(failureResult.issues!.length).toBeGreaterThan(0);

        // Check that issues have the correct structure
        failureResult.issues!.forEach((issue) => {
          expect(issue).toHaveProperty("message");
          expect(typeof issue.message).toBe("string");
        });
      }
    });

    test("should provide proper type inference", () => {
      const userSchema = z.object({
        id: z.string(),
        name: z.string(),
        age: z.number().optional(),
      });

      const standardSchema = ensureZodStandardSchema(userSchema);

      // TypeScript should infer these types correctly
      type InputType = StandardSchemaV1.InferInput<typeof standardSchema>;
      type OutputType = StandardSchemaV1.InferOutput<typeof standardSchema>;

      const validInput: InputType = {
        id: "123",
        name: "John",
        age: 25,
      };

      const result = standardSchema["~standard"].validate(validInput);
      if (!result.issues) {
        const output: OutputType = result.value;
        expect(output).toEqual(validInput);
      }
    });

    test("should reject async validation (memory-first requirement)", () => {
      // Create a mock async schema
      const asyncSchema: StandardSchemaV1 = {
        "~standard": {
          version: 1,
          vendor: "mock",
          validate: () =>
            Promise.resolve({ value: "async", issues: undefined }),
        },
      };

      const store = KalphiteStore(asyncSchema);

      expect(() => {
        store.upsert("1", { test: "data" });
      }).toThrow("Kalphite requires synchronous validation");
    });
  });

  describe("Zod Standard Schema Adapter", () => {
    test("should create compliant Standard Schema from Zod schema", () => {
      const zodSchema = z.object({
        id: z.string(),
        value: z.number(),
      });

      const standardSchema = createZodStandardSchemaAdapter(zodSchema);

      expect(standardSchema["~standard"].vendor).toBe("zod");
      expect(standardSchema["~standard"].version).toBe(1);

      const result = standardSchema["~standard"].validate({
        id: "test",
        value: 42,
      });
      expect(result).toEqual({
        value: { id: "test", value: 42 },
        issues: undefined,
      });
    });

    test("should handle Zod validation errors correctly", () => {
      const zodSchema = z.object({
        id: z.string(),
        value: z.number().min(10),
      });

      const standardSchema = createZodStandardSchemaAdapter(zodSchema);

      const result = standardSchema["~standard"].validate({
        id: "test",
        value: 5,
      });

      expect(result.issues).toBeDefined();
      expect(result.issues!.length).toBeGreaterThan(0);
      expect(result.issues![0]).toHaveProperty("message");
      expect(result.issues![0].message).toContain("10");
    });

    test("should preserve Zod path information in error issues", () => {
      const zodSchema = z.object({
        user: z.object({
          profile: z.object({
            age: z.number().min(18),
          }),
        }),
      });

      const standardSchema = createZodStandardSchemaAdapter(zodSchema);

      const result = standardSchema["~standard"].validate({
        user: {
          profile: {
            age: 15, // Below minimum
          },
        },
      });

      expect(result.issues).toBeDefined();
      expect(result.issues![0]).toHaveProperty("path");
      expect(result.issues![0].path).toEqual(["user", "profile", "age"]);
    });
  });

  describe("KalphiteStore Integration", () => {
    let store: ReturnType<typeof KalphiteStore>;

    beforeEach(() => {
      const schema = z.object({
        id: z.string(),
        type: z.literal("test"),
        name: z.string(),
        value: z.number(),
      });

      const standardSchema = ensureZodStandardSchema(schema);
      store = KalphiteStore(standardSchema);
    });

    test("should validate entities on upsert", () => {
      const validEntity = {
        id: "1",
        type: "test" as const,
        name: "Test Entity",
        value: 42,
      };

      const result = store.upsert("1", validEntity);
      expect(result).toEqual(validEntity);
      expect(store.getById("1")).toEqual(validEntity);
    });

    test("should reject invalid entities", () => {
      const invalidEntity = {
        id: "1",
        type: "wrong" as const, // Wrong literal type
        name: "Test Entity",
        value: "not-a-number", // Wrong type
      };

      expect(() => {
        store.upsert("1", invalidEntity);
      }).toThrow("Validation failed");

      expect(store.getById("1")).toBeUndefined();
    });

    test("should work with discriminated unions", () => {
      const entitySchema = z.discriminatedUnion("type", [
        z.object({
          id: z.string(),
          type: z.literal("user"),
          name: z.string(),
          email: z.string().email(),
        }),
        z.object({
          id: z.string(),
          type: z.literal("post"),
          title: z.string(),
          content: z.string(),
        }),
      ]);

      const standardSchema = ensureZodStandardSchema(entitySchema);
      const discriminatedStore = KalphiteStore(standardSchema);

      // Test user entity
      const user = {
        id: "1",
        type: "user" as const,
        name: "John Doe",
        email: "john@example.com",
      };

      const userResult = discriminatedStore.upsert("1", user);
      expect(userResult).toEqual(user);

      // Test post entity
      const post = {
        id: "2",
        type: "post" as const,
        title: "Test Post",
        content: "This is a test post",
      };

      const postResult = discriminatedStore.upsert("2", post);
      expect(postResult).toEqual(post);

      // Test invalid entity
      expect(() => {
        discriminatedStore.upsert("3", {
          id: "3",
          type: "invalid" as any,
          name: "Invalid",
        });
      }).toThrow("Validation failed");
    });
  });

  describe("Performance with Standard Schema", () => {
    test("should maintain performance with schema validation", () => {
      const schema = z.object({
        id: z.string(),
        type: z.literal("perf"),
        value: z.number(),
      });

      const standardSchema = ensureZodStandardSchema(schema);
      const store = KalphiteStore(standardSchema);

      const startTime = performance.now();

      // Create 1000 entities with validation
      for (let i = 0; i < 1000; i++) {
        store.upsert(`perf-${i}`, {
          id: `perf-${i}`,
          type: "perf" as const,
          value: i,
        });
      }

      const duration = performance.now() - startTime;

      // Should complete in reasonable time (allowing some overhead for validation)
      expect(duration).toBeLessThan(200); // 200ms for 1000 entities with validation
      expect(store.getAll()).toHaveLength(1000);
    });
  });

  describe("Standard Schema Compliance Verification", () => {
    test("should follow Standard Schema specification exactly", () => {
      // Test based on examples from https://standardschema.dev/
      const stringSchema = z.string();
      const standardSchema = ensureZodStandardSchema(stringSchema);

      // Verify the structure matches the spec
      const standard = standardSchema["~standard"];

      expect(standard.version).toBe(1);
      expect(typeof standard.vendor).toBe("string");
      expect(typeof standard.validate).toBe("function");

      // Test validate function signature and return types
      const successResult = standard.validate("hello");
      expect(successResult).toHaveProperty("value", "hello");
      // Success results should NOT have 'issues' property per Standard Schema spec
      expect(successResult).not.toHaveProperty("issues");

      const failureResult = standard.validate(123);
      expect(failureResult).toHaveProperty("issues");
      expect(Array.isArray(failureResult.issues)).toBe(true);

      // Verify issues structure
      if (failureResult.issues) {
        failureResult.issues.forEach((issue) => {
          expect(typeof issue.message).toBe("string");
          // path is optional
          if (issue.path) {
            expect(Array.isArray(issue.path)).toBe(true);
          }
        });
      }
    });
  });
});

// =====================================================
// STANDARD SCHEMA INTEGRATION SUMMARY
// =====================================================
//
// These tests verify that Kalphite properly implements
// the Standard Schema specification from https://standardschema.dev/
//
// ✅ Complete Standard Schema V1 interface compliance
// ✅ Proper validation result format (success/failure)
// ✅ Synchronous validation requirement (memory-first)
// ✅ Type inference support
// ✅ Zod adapter compatibility
// ✅ Error handling and issue reporting
// ✅ Performance with validation enabled
// ✅ Discriminated union support
//
// This ensures Kalphite can work with any Standard Schema
// compliant validation library, not just Zod.
// =====================================================
