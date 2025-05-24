import React, { useCallback, useState } from "react";
import { updateFile } from "../routes/index";
import type { FileMetadata } from "../sync-engine/fileTypes";
import { useSyncEngine } from "../sync-engine/useSyncEngine";

export function FileUpload() {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const { state, applyChange } = useSyncEngine("file-upload-client");

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files;
      if (!selectedFiles) return;

      for (const file of Array.from(selectedFiles)) {
        const metadata: FileMetadata = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          status: "uploading",
        };

        // Add to local state
        setFiles((prev) => [...prev, metadata]);

        // Sync the change
        await applyChange({
          clientId: "file-upload-client",
          data: {
            type: "add",
            fileId: metadata.id,
            metadata,
          },
        });

        // Update server
        await updateFile({
          type: "add",
          fileId: metadata.id,
          metadata,
        });

        // Simulate upload
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Update status to uploaded
          const updatedMetadata = { ...metadata, status: "uploaded" as const };
          setFiles((prev) =>
            prev.map((f) => (f.id === metadata.id ? updatedMetadata : f))
          );

          await applyChange({
            clientId: "file-upload-client",
            data: {
              type: "update",
              fileId: metadata.id,
              metadata: updatedMetadata,
            },
          });

          await updateFile({
            type: "update",
            fileId: metadata.id,
            metadata: updatedMetadata,
          });
        } catch (error) {
          // Update status to error
          const errorMetadata = {
            ...metadata,
            status: "error" as const,
            error: "Upload failed",
          };
          setFiles((prev) =>
            prev.map((f) => (f.id === metadata.id ? errorMetadata : f))
          );

          await applyChange({
            clientId: "file-upload-client",
            data: {
              type: "update",
              fileId: metadata.id,
              metadata: errorMetadata,
            },
          });

          await updateFile({
            type: "update",
            fileId: metadata.id,
            metadata: errorMetadata,
          });
        }
      }
    },
    [applyChange]
  );

  const handleDelete = useCallback(
    async (fileId: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));

      await applyChange({
        clientId: "file-upload-client",
        data: {
          type: "delete",
          fileId,
          metadata: files.find((f) => f.id === fileId)!,
        },
      });

      await updateFile({
        type: "delete",
        fileId,
        metadata: files.find((f) => f.id === fileId)!,
      });
    },
    [applyChange, files]
  );

  return (
    <div className="file-upload">
      <h2>File Upload</h2>

      <div className="upload-area">
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="file-input"
        />
      </div>

      <div className="file-list">
        <h3>Files</h3>
        {files.map((file) => (
          <div key={file.id} className="file-item">
            <span className="file-name">{file.name}</span>
            <span className="file-size">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
            <span className={`file-status ${file.status}`}>
              {file.status}
              {file.error && `: ${file.error}`}
            </span>
            <button
              onClick={() => handleDelete(file.id)}
              className="delete-button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="sync-status">
        <h3>Sync Status</h3>
        <pre>{JSON.stringify(state, null, 2)}</pre>
      </div>
    </div>
  );
}
