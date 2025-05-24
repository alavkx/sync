import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { FileUpload } from "../components/FileUpload";
import { fileStorage } from "../services/fileStorage";
import type { FileMetadata } from "../sync-engine/fileTypes";

// Server functions for file operations
const getFiles = createServerFn({
  method: "GET",
}).handler(async () => {
  return fileStorage.getFiles();
});

export const updateFile = createServerFn({ method: "POST" })
  .validator(
    (d: {
      type: "add" | "update" | "delete";
      fileId: string;
      metadata: FileMetadata;
    }) => d
  )
  .handler(async ({ data }) => {
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
