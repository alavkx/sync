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
  pull: (lastMutationId: number) => Promise<TMutation[]>;
  id: string;
}

export class Storage<
  TSchema extends StandardSchemaV1,
  TMutators extends Record<
    string,
    (
      args: Parameters<TMutators[keyof TMutators]>[0]
    ) => StandardSchemaV1.InferOutput<TSchema>
  >,
  TMutation = Mutation<
    keyof TMutators,
    Parameters<TMutators[keyof TMutators]>[0]
  >
> {
  id: string;
  db: PGlite;
  optimisticDb: PGlite;
  schema: TSchema;
  mutators: TMutators;
  log: TMutation[] = [];
  push: (mutations: TMutation[]) => Promise<void> = async () => {};
  pull: (lastMutationId: number) => Promise<TMutation[]> = async () =>
    [] as TMutation[];

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
    this.id = nanoid();
    this.db = new PGlite("idb://" + this.id);
    this.optimisticDb = new PGlite("memory://" + this.id);
  }

  async close() {
    await this.db.close();
    await this.memory.close();
  }
}
