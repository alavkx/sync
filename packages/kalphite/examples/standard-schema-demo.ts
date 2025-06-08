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

// =====================================================
// ZOD EXAMPLE
// =====================================================

console.log("\n🔸 Zod Example (Standard Schema compliant)");

const zodUserSchema = z.object({
  id: z.string(),
  type: z.literal("user"),
  name: z.string(),
  email: z.string().email(),
});

// Zod schemas implement Standard Schema natively
const zodStore = KalphiteStore(zodUserSchema);

console.log("  Schema vendor:", zodUserSchema["~standard"].vendor);
console.log("  Schema version:", zodUserSchema["~standard"].version);

zodStore.upsert("user1", {
  id: "user1",
  type: "user",
  name: "John Doe",
  email: "john@example.com",
});

console.log("  User created:", zodStore.getById("user1")?.name);

// =====================================================
// CUSTOM STANDARD SCHEMA IMPLEMENTATION
// =====================================================

console.log("\n🔸 Custom Standard Schema Implementation");

const customUserSchema = {
  "~standard": {
    version: 1,
    vendor: "custom-validator",
    validate: (data: any) => {
      if (!data.id || typeof data.id !== "string") {
        return { issues: [{ message: "Invalid id" }] };
      }
      if (!data.type || data.type !== "user") {
        return { issues: [{ message: "Invalid type" }] };
      }
      if (!data.name || typeof data.name !== "string") {
        return { issues: [{ message: "Invalid name" }] };
      }
      if (
        !data.email ||
        typeof data.email !== "string" ||
        !data.email.includes("@")
      ) {
        return { issues: [{ message: "Invalid email" }] };
      }
      return { value: data };
    },
  },
};

const customStore = KalphiteStore(customUserSchema);

console.log("  Schema vendor:", customUserSchema["~standard"].vendor);
console.log("  Schema version:", customUserSchema["~standard"].version);

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
console.log("  • Kalphite works with any Standard Schema compliant library");
console.log(
  "  • Universal interoperability - 'Integrate once, validate anywhere'"
);
