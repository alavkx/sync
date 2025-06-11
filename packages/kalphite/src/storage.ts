import { PGlite } from "@electric-sql/pglite";
import type { StandardSchemaV1 } from "./standard-schema";

interface Mutation<
  TType extends string,
  TArgs extends Record<string, unknown>
> {
  id: number;
  type: TType;
  args: TArgs;
}
interface MutatorDefinition<TState, TArgs extends Record<string, unknown>> {
  (state: TState, args: TArgs): TState;
}
type MutatorMap<TState> = Record<string, MutatorDefinition<TState, any>>;
type ExtractMutatorArgs<TMutator> = TMutator extends MutatorDefinition<
  any,
  infer TArgs
>
  ? TArgs
  : never;
type StorageMutation<TMutators extends MutatorMap<any>> = {
  [K in keyof TMutators]: Mutation<
    K & string,
    ExtractMutatorArgs<TMutators[K]>
  >;
}[keyof TMutators];
interface StorageConfig<
  TSchema extends StandardSchemaV1,
  TMutators extends MutatorMap<StandardSchemaV1.InferOutput<TSchema>>
> {
  schema: TSchema;
  mutators: TMutators;
  push?: (mutations: StorageMutation<TMutators>[]) => Promise<void>;
  pull?: (lastMutationId: number) => Promise<StorageMutation<TMutators>[]>;
  name?: string;
}
export class Storage<
  TSchema extends StandardSchemaV1,
  TMutators extends MutatorMap<StandardSchemaV1.InferOutput<TSchema>>
> {
  readonly name: string;
  readonly db: PGlite;
  readonly optimisticDb: PGlite;
  readonly schema: TSchema;
  readonly mutators: TMutators;
  private log: StorageMutation<TMutators>[] = [];
  private state: StandardSchemaV1.InferOutput<TSchema>;
  private push: (mutations: StorageMutation<TMutators>[]) => Promise<void>;
  private pull: (
    lastMutationId: number
  ) => Promise<StorageMutation<TMutators>[]>;

  constructor({
    schema,
    mutators,
    push = async () => {},
    pull = async () => [],
    name = "kalphite",
  }: StorageConfig<TSchema, TMutators>) {
    this.schema = schema;
    this.mutators = mutators;
    this.push = push;
    this.pull = pull;
    this.name = name;
    this.db = new PGlite("idb://" + name);
    this.optimisticDb = new PGlite("memory://" + name);
    this.state = {} as StandardSchemaV1.InferOutput<TSchema>;
  }
  mutate<K extends keyof TMutators>(
    mutator: K,
    args: ExtractMutatorArgs<TMutators[K]>
  ): StandardSchemaV1.InferOutput<TSchema> {
    const mutation: StorageMutation<TMutators> = {
      id: (this.log.at(-1)?.id ?? -1) + 1,
      type: mutator as string,
      args,
    } as StorageMutation<TMutators>;
    this.log.push(mutation);
    const newState = this.mutators[mutator](this.state, args);
    const result = this.schema["~standard"].validate(newState);
    if (result instanceof Promise) {
      throw new Error(
        "Async validation not supported in mutate - use async validateAndMutate instead"
      );
    }
    if (result.issues) {
      throw new Error(
        `Validation failed: ${result.issues.map((i) => i.message).join(", ")}`
      );
    }
    this.state = result.value as StandardSchemaV1.InferOutput<TSchema>;
    this.optimisticDb.sql`
      INSERT INTO mutations (id, type, args)
      VALUES (${mutation.id}, ${mutation.type as string}, ${JSON.stringify(
      mutation.args
    )})
    `;
    this.db.sql`
      INSERT INTO mutations (id, type, args)
      VALUES (${mutation.id}, ${mutation.type as string}, ${JSON.stringify(
      mutation.args
    )})
    `;
    return this.state;
  }
  getState(): StandardSchemaV1.InferOutput<TSchema> {
    return this.state;
  }
  async sync(): Promise<void> {
    const lastId = this.log.at(-1)?.id ?? -1;
    const remoteMutations = await this.pull(lastId);

    for (const mutation of remoteMutations) {
      if (mutation.id > lastId) {
        const mutator = this.mutators[mutation.type];
        if (mutator) {
          this.state = mutator(this.state, mutation.args);
          this.log.push(mutation);
        }
      }
    }

    await this.push(this.log.filter((m) => m.id > lastId));
  }
  async close(): Promise<void> {
    await Promise.all([this.db.close(), this.optimisticDb.close()]);
  }
}
