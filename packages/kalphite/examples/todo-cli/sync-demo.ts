#!/usr/bin/env node

import { ModernSyncEngine } from "../../src/sync/ModernSyncEngine";
import { NetworkSyncEngine } from "../../src/sync/NetworkSyncEngine";
import { createTodo, generateId } from "./schema";

// =====================================================
// Sync Evolution Demo - Legacy vs Modern
// =====================================================

async function demonstrateLegacySync() {
  console.log("\n🔄 Legacy Sync Demo (WebSocket-based)\n");

  const legacyEngine = new NetworkSyncEngine({
    wsUrl: "ws://localhost:3001",
    roomId: "demo-room",
    userId: "demo-user-legacy",
  });

  // Set up event handlers
  legacyEngine.on("remoteChange", (change) => {
    console.log(
      `📥 Legacy: Received ${change.type} for ${change.entityType}:${change.entityId}`
    );
  });

  legacyEngine.on("connected", () => {
    console.log("🔗 Legacy: Connected to WebSocket server");
  });

  legacyEngine.on("disconnected", () => {
    console.log("❌ Legacy: Disconnected from server");
  });

  // Demonstrate offline queuing
  console.log("📱 Legacy: Working offline...");

  const todo1 = createTodo(generateId(), "Legacy Todo 1", {
    status: "pending",
    priority: "high",
  });
  const todo2 = createTodo(generateId(), "Legacy Todo 2", {
    status: "pending",
    priority: "medium",
  });

  await legacyEngine.sendChange({
    type: "upsert",
    entityType: "todo",
    entityId: todo1.id,
    entity: todo1,
  });

  await legacyEngine.sendChange({
    type: "upsert",
    entityType: "todo",
    entityId: todo2.id,
    entity: todo2,
  });

  console.log(`📦 Legacy: Queued ${legacyEngine.queueLength} operations`);

  // Simulate remote changes
  console.log("🌐 Legacy: Simulating remote changes...");

  await legacyEngine.simulateRemoteChange({
    type: "upsert",
    entityType: "todo",
    entityId: "remote-todo-1",
    entity: createTodo("remote-todo-1", "Remote Todo from Another User", {
      status: "completed",
      priority: "low",
    }),
    timestamp: Date.now(),
    userId: "other-user",
    operationId: "remote-op-1",
  });

  await legacyEngine.disconnect();
  console.log("✅ Legacy sync demo completed");
}

async function demonstrateModernSync() {
  console.log("\n🚀 Modern Sync Demo (Operation-based HTTP + WebSocket)\n");

  const modernEngine = new ModernSyncEngine({
    baseUrl: "http://localhost:3001",
    operationsEndpoint: "/sync/operations",
    stateEndpoint: "/sync/state",
    notificationUrl: "ws://localhost:3001/sync/notify",
    clientId: "demo-client-modern",
    userId: "demo-user-modern",
    batchSize: 5,
  });

  // Set up modern event handlers
  modernEngine.onOperationConfirmed((operation) => {
    console.log(`✅ Modern: Operation "${operation.name}" confirmed by server`);
  });

  modernEngine.onOperationFailed((data) => {
    console.log(
      `❌ Modern: Operation "${data.operation.name}" failed: ${data.error}`
    );
  });

  modernEngine.onStatePatch((patch) => {
    console.log(
      `📊 Modern: State updated to version ${patch.stateVersion} with ${patch.entities.length} entities`
    );
  });

  // Legacy compatibility - still works!
  modernEngine.on("remoteChange", (change) => {
    console.log(
      `📥 Modern: Received ${change.type} for ${change.entityType}:${change.entityId}`
    );
  });

  // Demonstrate operation-based sync
  console.log("🎯 Modern: Using operation-based sync...");

  try {
    // Named operations with semantic meaning
    await modernEngine.executeOperation("addTodo", ["Buy groceries", "high"]);
    await modernEngine.executeOperation("addTodo", ["Walk the dog", "medium"]);
    await modernEngine.executeOperation("completeTodo", ["todo-123"]);
    await modernEngine.executeOperation("updateTodoTitle", [
      "todo-456",
      "Updated title",
    ]);

    console.log(
      `📦 Modern: ${
        modernEngine.getPendingOperations().length
      } operations pending confirmation`
    );
    console.log(
      `📋 Modern: ${
        modernEngine.getQueuedOperations().length
      } operations queued for retry`
    );
  } catch (error) {
    console.log("📱 Modern: Operations queued for when online");
  }

  // Demonstrate backward compatibility
  console.log("🔄 Modern: Testing backward compatibility...");

  const legacyTodo = createTodo(generateId(), "Legacy-style Todo", {
    status: "pending",
    priority: "medium",
  });

  // Legacy sendChange still works - gets converted to operation internally
  await modernEngine.sendChange({
    type: "upsert",
    entityType: "todo",
    entityId: legacyTodo.id,
    entity: legacyTodo,
  });

  console.log("✅ Legacy sendChange converted to modern operation");

  // Show state version tracking
  console.log(
    `📌 Modern: Current state version: ${modernEngine.getCurrentStateVersion()}`
  );

  await modernEngine.disconnect();
  console.log("✅ Modern sync demo completed");
}

async function demonstrateEvolutionBenefits() {
  console.log("\n📈 Evolution Benefits Comparison\n");

  console.log("🔄 Legacy Sync (WebSocket-only):");
  console.log("  ✅ Real-time updates");
  console.log("  ✅ Conflict resolution");
  console.log("  ❌ Complex operational transforms");
  console.log("  ❌ WebSocket reliability issues");
  console.log("  ❌ Difficult debugging");

  console.log("\n🚀 Modern Sync (HTTP + WebSocket):");
  console.log("  ✅ Server authority (simpler conflicts)");
  console.log("  ✅ HTTP reliability & caching");
  console.log("  ✅ Named operations (semantic)");
  console.log("  ✅ Better debugging & monitoring");
  console.log("  ✅ Backward compatibility");
  console.log("  ✅ Framework agnostic");

  console.log("\n🎯 Migration Path:");
  console.log("  1. Existing code continues working");
  console.log("  2. Gradually adopt operation-based methods");
  console.log("  3. Server implements HTTP endpoints");
  console.log("  4. WebSocket becomes notification-only");
  console.log("  5. Full modern sync capabilities");
}

async function runSyncDemo() {
  console.log("🎭 Kalphite Sync Evolution Demo");
  console.log("=====================================");

  try {
    await demonstrateLegacySync();
    await demonstrateModernSync();
    await demonstrateEvolutionBenefits();

    console.log("\n🎉 Sync evolution demo completed successfully!");
    console.log("\nNext steps:");
    console.log("  • Implement server endpoints for HTTP sync");
    console.log("  • Add schema validation utilities");
    console.log("  • Create production deployment examples");
  } catch (error) {
    console.error("❌ Demo failed:", error);
  }
}

// Run the demo
if (require.main === module) {
  runSyncDemo();
}

export { runSyncDemo };
