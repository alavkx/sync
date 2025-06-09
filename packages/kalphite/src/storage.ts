import { PGlite } from "@electric-sql/pglite";
import type { StandardSchemaV1 } from "./standard-schema";

interface Mutation<
  TType extends PropertyKey,
  TArgs extends Record<string, unknown>
> {
  id: number;
  type: TType;
  args: TArgs;
}

interface StorageConfig<
  TSchema extends StandardSchemaV1,
  TMutators extends Record<PropertyKey, (state: TSchema) => TSchema>,
  TMutation = Mutation<
    keyof TMutators,
    Parameters<TMutators[keyof TMutators]>[0]
  >
> {
  schema: TSchema;
  mutators: TMutators;
  push: (mutations: TMutation[]) => Promise<void>;
  pull: () => Promise<TMutation[]>;
}

export class Storage<
  TSchema extends StandardSchemaV1,
  TMutators extends Record<
    string,
    (
      state: StandardSchemaV1.InferOutput<TSchema>,
      args: Parameters<TMutators[keyof TMutators]>[0]
    ) => StandardSchemaV1.InferOutput<TSchema>
  >,
  TMutation = Mutation<
    keyof TMutators,
    Parameters<TMutators[keyof TMutators]>[0]
  >
> implements StorageConfig<TSchema, TMutators>
{
  db = new PGlite("idb://kalphite");
  memory = new PGlite("memory://kalphite");
  schema: TSchema;
  mutators: TMutators;
  log: TMutation[] = [];
  push: (mutations: TMutation[]) => Promise<void> = async () => {};
  pull: (lastMutationId: number) => Promise<TMutation[]> = async () => [];

  constructor({
    schema,
    mutators,
    push,
    pull,
  }: StorageConfig<TSchema, TMutators>) {
    this.schema = schema;
    this.mutators = mutators;
    this.push = push;
    this.pull = pull;
  }

  async close() {
    await this.db.close();
    await this.memory.close();
  }
}
