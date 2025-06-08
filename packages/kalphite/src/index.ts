// Main exports for Kalphite Sync Engine
export { useKalphiteStore } from "./react/useKalphiteStore";
export { initializeStore } from "./store/initialize";
export { KalphiteStore } from "./store/KalphiteStore";

// Types
export type { KalphiteConfig } from "./types/config";
export type { Entity, EntityId, EntityType } from "./types/entity";
export type { ChangeOperation, FlushOperation } from "./types/operations";

// Standard Schema integration
export type { StandardSchemaV1 } from "@standard-schema/spec";
