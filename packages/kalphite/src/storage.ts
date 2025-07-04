import { PGlite } from "@electric-sql/pglite";
import { nanoid } from "nanoid";
import type { StandardSchemaV1 } from "./standard-schema";

interface Mutation<
  TType extends string,
  TArgs extends Record<string, unknown>
> {
  id: string;
  index: number;
  type: TType;
  args: TArgs;
  confirmed: boolean;
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
  private lastMutationIndex = -1;

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
  async hydrate(state: StandardSchemaV1.InferOutput<TSchema>): Promise<void> {
    const mutations = await this.pull(0);
    for (const mutation of mutations) {
      mutation.confirmed = true;
      this.state = this.mutators[mutation.type](this.state, mutation.args);
    }
  }
  mutate<K extends keyof TMutators>(
    mutator: K,
    args: ExtractMutatorArgs<TMutators[K]>
  ): StandardSchemaV1.InferOutput<TSchema> {
    const newState = this.mutators[mutator](this.state, args);
    const result = this.schema["~standard"].validate(newState);
    if (result instanceof Promise) {
      throw new Error(
        "Async validation not supported in mutate - use async validateAndMutate instead"
      );
    }
    if (result.issues) {
      throw new Error(
        `Mutation ${mutator as string} failed validation: ${result.issues
          .map((i) => i.message)
          .join(", ")}`
      );
    }
    this.lastMutationIndex += 1;
    const mutation: StorageMutation<TMutators> = {
      id: nanoid(),
      index: this.lastMutationIndex,
      type: mutator as string,
      args,
      confirmed: false,
    } as StorageMutation<TMutators>;
    this.optimisticDb.sql`
      INSERT INTO mutations (id, index, type, args, confirmed)
      VALUES (${mutation.id}, ${mutation.index}, ${
      mutation.type as string
    }, ${JSON.stringify(mutation.args)}, ${false})
    `;
    this.log.push(mutation);
    this.state = result.value as StandardSchemaV1.InferOutput<TSchema>;
    return this.state;
  }
  getState(): StandardSchemaV1.InferOutput<TSchema> {
    return this.state;
  }
  async sync(): Promise<void> {
    const pendingMutations = this.log.filter((m) => !m.confirmed);
    const remoteMutations = await this.pull(this.lastMutationIndex);
    // TODO: Rebase pending mutations on top of remote mutations
    const _acceptedMutations = await this.push(pendingMutations);
    // Should I expect push to return the mutations that were accepted?
    // TODO: Determine if we should use accepted mutations or remote mutations
    for (const mutation of remoteMutations) {
      mutation.confirmed = true;
      if (mutation.index > this.lastMutationIndex) {
        const mutator = this.mutators[mutation.type];
        if (mutator) {
          this.db.sql`
            INSERT INTO mutations (id, index, type, args, confirmed)
            VALUES (${mutation.id}, ${mutation.index}, ${
            mutation.type as string
          }, ${JSON.stringify(mutation.args)}, ${true})
          `;
          this.state = mutator(this.state, mutation.args);
          this.log.push(mutation);
          this.lastMutationIndex = Math.max(
            this.lastMutationIndex,
            mutation.index
          );
        }
      }
    }
    await this.push(this.log.filter((m) => m.index > this.lastMutationIndex));
  }
  async close(): Promise<void> {
    await Promise.all([this.db.close(), this.optimisticDb.close()]);
  }
}
