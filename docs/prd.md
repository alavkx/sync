**Product Requirements Document (PRD)**

## Product: MVP Code Review Tool

### Overview

A lightweight, web-based code review tool that allows users to view diffs between two commits, leave inline comments, and approve or request changes. The tool will support basic Git integration, diff viewing, and single-user reviews.

---

## Features

### 1. Git Integration

**Goal**: Retrieve file trees and diffs between two commits.

#### Subtasks:

-

#### Design:

Use `simple-git` or native `git` CLI wrappers:

```ts
const git = simpleGit(repoPath);
const diff = await git.diff([`${baseSHA}..${headSHA}`]);
```

---

### 2. Diff Viewer UI

**Goal**: Render file-by-file diffs with basic syntax highlighting.

#### Subtasks:

-

#### Design:

Use `react-diff-viewer` or custom logic with line tokens:

```ts
<DiffViewer oldValue={base} newValue={head} splitView={true} />
```

---

### 3. Inline Commenting

**Goal**: Allow users to click on a line and add a comment.

#### Subtasks:

-

#### Design:

```ts
type Comment = {
  id: string;
  reviewId: string;
  filePath: string;
  lineNumber: number;
  side: "base" | "head";
  authorId: string;
  message: string;
  createdAt: Date;
};
```

---

### 4. Review Flow

**Goal**: Allow user to submit a review with a final status.

#### Subtasks:

-

#### Design:

```ts
type Review = {
  id: string;
  baseCommit: string;
  headCommit: string;
  authorId: string;
  status: "commented" | "approved" | "changes_requested";
  createdAt: Date;
};
```

---

### 5. Basic Auth System

**Goal**: Track users and associate authorship.

#### Subtasks:

-

#### Design:

Use simple JWT or cookie session-based login.

```ts
type User = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
};
```

---

## Out of Scope for MVP

- CI Integration
- Multi-user concurrent editing
- PR sync with GitHub/GitLab
- AST-aware diffs
- Comment threading
- WebSocket or real-time features

---

## Tech Stack

- **Frontend**: TanStack Start + Tailwind + React + shadcn/ui + Simple Sync Engine
- **Backend**: Node.js (TanStack Start routes)
- **Database**: PostgreSQL
- **Git**: `simple-git` or raw CLI

---

## Milestones

### Week 1:

-

### Week 2:

-

### Week 3:

- ***

Let me know if you want API routes next, DB schema DDL, or UI mockups.
