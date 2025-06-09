import { describe, it } from "vitest";
import { z } from "zod";
import { Storage } from "../storage";

describe("TODO MVC", () => {
  it("should be able to create a new todo", async () => {
    const storage = new Storage({
      schema: z.object({
        todos: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            status: z.enum(["not started", "in progress", "completed"]),
          })
        ),
      }),
      mutators: {
        createTodo: (state, args) => ({
          ...state,
          todos: [...state.todos, args],
        }),
      },
      push: async (mutations) => {
        console.log(mutations);
        await Promise.resolve();
      },
      pull: async (lastMutationId: number) => {
        await Promise.resolve();
        return [
          {
            id: 0,
            type: "createTodo",
            args: {
              id: "1",
              title: "Buy groceries",
              completed: false,
            },
          },
        ];
      },
    });
    storage.mutators.createTodo({
      id: "1",
      title: "Buy groceries",
      status: "not started",
    });
  });
});
