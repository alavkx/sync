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
  name: string;
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
  name: string;
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
    name = "kalphite",
  }: StorageConfig<TSchema, TMutators>) {
    this.schema = schema;
    this.mutators = mutators;
    this.push = push;
    this.pull = pull;
    this.name = name;
    this.db = new PGlite("idb://" + name);
    this.optimisticDb = new PGlite("memory://" + name);
  }

  mutate(
    mutator: keyof TMutators,
    args: Parameters<TMutators[keyof TMutators]>[0]
  ) {
    const mutation = {
      id: (this.log.at(-1)?.id ?? -1) + 1,
      type: mutator,
      args,
    } satisfies TMutation;
    this.log.push(mutation);
    const result = this.mutators[mutator](args);
    this.optimisticDb.sql`
      INSERT INTO mutations (id, type, args)
      VALUES (${mutation.id}, ${mutation.type}, ${mutation.args})
    `;
    this.db.sql`
      INSERT INTO mutations (id, type, args)
      VALUES (${mutation.id}, ${mutation.type}, ${mutation.args})
    `;
    return result;
  }

  async close() {
    await Promise.all([this.db.close(), this.optimisticDb.close()]);
  }
}
