import z from "zod";
import { Storage } from "./storage";

const TodoSchema = z.object({
  todos: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      completed: z.boolean(),
    })
  ),
  filter: z.enum(["all", "active", "completed"]),
});
type TodoState = z.infer<typeof TodoSchema>;

async function example() {
  const storage = new Storage({
    schema: TodoSchema,
    mutators: {
      addTodo: (
        state: TodoState,
        args: { id: string; text: string }
      ): TodoState => ({
        ...state,
        todos: [...state.todos, { ...args, completed: false }],
      }),
      toggleTodo: (state: TodoState, args: { id: string }): TodoState => ({
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === args.id ? { ...todo, completed: !todo.completed } : todo
        ),
      }),
      setFilter: (
        state: TodoState,
        args: { filter: "all" | "active" | "completed" }
      ): TodoState => ({
        ...state,
        filter: args.filter,
      }),
    },
    name: "my-todo-app",
    push: async (mutations) => {
      console.log("Pushing mutations:", mutations);
      // TODO: Implement push
    },
    pull: async (lastId) => {
      console.log("Pulling mutations after:", lastId);
      // TODO: Implement pull
      return [];
    },
  });
  const newState = storage.mutate("addTodo", {
    id: "1",
    text: "Learn Kalphite",
  });
  storage.mutate("toggleTodo", { id: "1" });
  // Type error if wrong args:
  // storage.mutate("addTodo", { wrongProp: "error" }); // TS Error!
  const currentState = storage.getState();
  console.log("Current todos:", currentState.todos);
  await storage.sync();
  await storage.close();
}

export { example };
