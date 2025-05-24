# Module 1: Core Concepts & Architecture

## 1. The Big Picture

### Understanding the Sync Problem Space

The sync problem space is fundamentally about managing data consistency across multiple devices and users. Here are the key challenges:

1. **Network Uncertainty**

   - Intermittent connectivity
   - Variable latency
   - Bandwidth constraints
   - Connection failures

2. **Concurrent Modifications**

   - Multiple users editing the same data
   - Same user on multiple devices
   - Background processes and automated updates

3. **State Management**
   - Local state vs. server state
   - Conflict resolution
   - Version tracking
   - Data consistency guarantees

### Why We Need Sync Engines

Sync engines solve these problems by providing:

1. **Offline Support**

   - Local data access without network
   - Background synchronization
   - Conflict resolution when back online

2. **Real-time Updates**

   - Instant local changes
   - Background server synchronization
   - Efficient update propagation

3. **Consistency Guarantees**
   - Eventual consistency
   - Conflict resolution strategies
   - Data integrity preservation

### Replicache's High-Level Architecture

Replicache implements a sophisticated sync architecture with three main components:

1. **Client-Side Store**

   - In-browser persistent key-value store
   - Git-like versioning system
   - Local state management
   - Background sync capabilities

2. **Server-Side Components**

   - Push endpoint for receiving client changes
   - Pull endpoint for sending server updates
   - Poke system for real-time notifications
   - Database integration

3. **Sync Protocol**
   - Bidirectional sync
   - Optimistic updates
   - Conflict resolution
   - Version tracking

### Key Components: Client, Server, and Sync Protocol

#### Client Components

- **Replicache Instance**: The main client-side store
- **Client View**: The current state of the data
- **Mutators**: Functions that modify the data
- **Subscriptions**: React to data changes

#### Server Components

- **Push Endpoint**: Receives and processes client changes
- **Pull Endpoint**: Sends updates to clients
- **Poke System**: Notifies clients of changes
- **Database**: Stores the canonical state

#### Sync Protocol

- **Push**: Client → Server changes
- **Pull**: Server → Client updates
- **Poke**: Server → Client notifications
- **Cookie-based Versioning**: Tracks sync state

## Next Steps

In the next section, we'll dive deeper into the Client-Side Architecture, exploring how Replicache manages local state and handles persistence.

[Continue to Client-Side Architecture →]
