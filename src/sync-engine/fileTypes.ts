export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  status: "uploading" | "uploaded" | "error";
  error?: string;
}

export interface FileChange {
  type: "add" | "update" | "delete";
  fileId: string;
  metadata: FileMetadata;
}
