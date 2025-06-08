// =====================================================
// STANDARD SCHEMA DEMO - Universal Validation Libraries
// =====================================================
//
// This demo shows how Kalphite works with ANY Standard Schema
// compliant validation library out of the box.
//
// No adapters needed! Just pass the schema directly.

import { z } from "zod";
import { KalphiteStore } from "../src/store/KalphiteStore";
import type { StandardSchemaV1 } from "../src/types/StandardSchema";

// =====================================================
// ZOD EXAMPLE (v3.24.0+)
// =====================================================

console.log("🔸 Zod Example (Standard Schema compliant)");

const zodUserSchema = z.object({
  id: z.string(),
  type: z.literal("user"),
  name: z.string(),
  email: z.string().email(),
});

// Zod schemas implement Standard Schema natively - just pass directly!
const zodStore = KalphiteStore(zodUserSchema);

console.log("  Schema vendor:", zodUserSchema["~standard"].vendor); // "zod"
console.log("  Schema version:", zodUserSchema["~standard"].version); // 1

// Use the store
zodStore.upsert("user1", {
  id: "user1",
  type: "user",
  name: "John Doe",
  email: "john@example.com",
});

console.log("  User created:", zodStore.getById("user1")?.name);

// =====================================================
// VALIBOT EXAMPLE (if installed)
// =====================================================

// Uncomment this if you have valibot installed:
/*
import * as v from "valibot";

console.log("\n🔸 Valibot Example (Standard Schema compliant)");

const valibotUserSchema = v.object({
  id: v.string(),
  type: v.literal("user"),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

// Valibot schemas also implement Standard Schema natively!
const valibotStore = KalphiteStore(valibotUserSchema);

console.log("  Schema vendor:", valibotUserSchema["~standard"].vendor); // "valibot"
console.log("  Schema version:", valibotUserSchema["~standard"].version); // 1

valibotStore.upsert("user2", {
  id: "user2", 
  type: "user",
  name: "Jane Smith",
  email: "jane@example.com"
});

console.log("  User created:", valibotStore.getById("user2")?.name);
*/

// =====================================================
// ARKTYPE EXAMPLE (if installed)
// =====================================================

// Uncomment this if you have arktype installed:
/*
import { type } from "arktype";

console.log("\n🔸 ArkType Example (Standard Schema compliant)");

const arktypeUserSchema = type({
  id: "string",
  type: "'user'",
  name: "string",
  email: "string.email"
});

// ArkType schemas also implement Standard Schema natively!
const arktypeStore = KalphiteStore(arktypeUserSchema);

console.log("  Schema vendor:", arktypeUserSchema["~standard"].vendor); // "arktype"
console.log("  Schema version:", arktypeUserSchema["~standard"].version); // 1

arktypeStore.upsert("user3", {
  id: "user3",
  type: "user", 
  name: "Bob Wilson",
  email: "bob@example.com"
});

console.log("  User created:", arktypeStore.getById("user3")?.name);
*/

// =====================================================
// CUSTOM STANDARD SCHEMA IMPLEMENTATION
// =====================================================

console.log("\n🔸 Custom Standard Schema Implementation");

// You can even create your own Standard Schema compliant validator!
const customUserSchema: StandardSchemaV1<any, any> = {
  "~standard": {
    version: 1,
    vendor: "custom-validator",
    validate: (value: unknown) => {
      // Simple validation logic
      if (typeof value !== "object" || value === null) {
        return { issues: [{ message: "Expected object" }] };
      }

      const obj = value as any;
      if (typeof obj.id !== "string") {
        return { issues: [{ message: "id must be string", path: ["id"] }] };
      }
      if (obj.type !== "user") {
        return { issues: [{ message: "type must be 'user'", path: ["type"] }] };
      }
      if (typeof obj.name !== "string") {
        return { issues: [{ message: "name must be string", path: ["name"] }] };
      }

      return { value: obj };
    },
  },
};

// Works seamlessly with Kalphite!
const customStore = KalphiteStore(customUserSchema);

console.log("  Schema vendor:", customUserSchema["~standard"].vendor); // "custom-validator"
console.log("  Schema version:", customUserSchema["~standard"].version); // 1

customStore.upsert("user4", {
  id: "user4",
  type: "user",
  name: "Alice Cooper",
  email: "alice@example.com",
});

console.log("  User created:", customStore.getById("user4")?.name);

// =====================================================
// SUMMARY
// =====================================================

console.log("\n✅ Summary:");
console.log("  • Kalphite works with ANY Standard Schema compliant library");
console.log("  • No adapters or wrappers needed");
console.log("  • Zod, Valibot, ArkType, Effect Schema all work out of the box");
console.log(
  "  • You can even create custom validators that implement the spec"
);
console.log(
  "  • Universal interoperability - 'Integrate once, validate anywhere'"
);

// Test validation errors
console.log("\n🔸 Testing validation errors:");

try {
  zodStore.upsert("invalid", {
    id: "invalid",
    type: "user",
    name: 123, // Should be string
    email: "not-an-email",
  });
} catch (error) {
  console.log("  ✓ Validation caught invalid data:", (error as Error).message);
}

console.log("\n🎉 Standard Schema integration complete!");
