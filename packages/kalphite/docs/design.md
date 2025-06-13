# Kalphite Architectural Design

This document reflects the core architectural principles of the Kalphite system, designed for building robust, real-time, and collaborative applications.

Our design is woven from four fundamental ideas into a single, cohesive architecture:

### 1. Event Sourcing as the Foundation for Truth

Instead of storing the _current state_ of our data (e.g., the final text of a comment), we chose to store an **immutable log of events** (the mutations). This was the pivotal decision in our architecture.

- **Benefits:** It provides a perfect audit trail, makes debugging deterministic by allowing us to replay event sequences, and gives us "time travel" capabilities to view the state of the system at any point in time.
- **Trade-offs:** We accepted that this would make reading the current state more complex, but we valued the historical integrity and debugging power it provided.

### 2. CQRS for Performance and Scalability

We immediately addressed the primary challenge of Event Sourcing—read performance—by implementing **Command Query Responsibility Segregation (CQRS)**. We physically separated the models for writing data from the models for reading it.

- The **Command** side is responsible only for handling incoming user actions (commands) and writing new `mutations` to the event log.
- The **Query** side is responsible for building and maintaining a separate, highly-optimized **Read Model** from the event stream. This gives us the raw performance of a traditional database for reads, while retaining the powerful benefits of Event Sourcing for writes.

### 3. Client-Side Projections for a Decoupled UI

We recognized that the client application doesn't need a full replica of the server's database. It needs a **Projection**—a specific, often nested or reshaped, view of the data tailored precisely to what a particular UI screen is trying to display.

- This led to the concept of a powerful **Translator** layer in our API (e.g., GraphQL or tRPC resolvers).
- This layer's sole responsibility is to convert data from the server's normalized, relational Read Model into the hierarchical shape the client needs for its state projection.

### 4. Shared Schemas as the Type-Safe Contract

To make this entire system robust, bug-free, and maintainable, we introduced a **Shared Schema** (using Zod) as the ultimate contract between the client and server.

- This schema declaratively defines the precise shape of a Client-Side Projection.
- It is imported and used by the server to validate the output of the API's **Translator**.
- It is used by a type-safe API layer (like tRPC) to provide perfect, end-to-end type safety to the client, eliminating an entire class of data-shape-mismatch bugs and making the developer experience sublime.

---

In essence, our design can be summarized as: **writes are events, reads are projections of those events, and a shared schema guarantees that the projections are always correct.**
