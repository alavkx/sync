import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { FileUpload } from "../../src/components/FileUpload";
import type { FileMetadata } from "../../src/sync-engine/fileTypes";
import { fileStorage } from "../services/fileStorage";

type FileOperation = {
  type: "add" | "update" | "delete";
  fileId: string;
  metadata: FileMetadata;
};

// Server functions for file operations
const getFiles = createServerFn({
  method: "GET",
}).handler(async () => {
  return fileStorage.getFiles();
});

export const updateFile = createServerFn({ method: "POST" })
  .validator((d: FileOperation) => d)
  .handler(async ({ data }: { data: FileOperation }) => {
    switch (data.type) {
      case "add":
        await fileStorage.addFile(data.metadata);
        break;
      case "update":
        await fileStorage.updateFile(data.metadata);
        break;
      case "delete":
        await fileStorage.deleteFile(data.fileId);
        break;
    }
    return { success: true };
  });

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => await getFiles(),
});

function Home() {
  return (
    <div className="app">
      <h1>File Upload Demo</h1>
      <p>Upload files and watch them sync across clients</p>
      <FileUpload />
    </div>
  );
}
