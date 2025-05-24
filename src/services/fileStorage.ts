import type { FileMetadata } from "../sync-engine/fileTypes";

// In-memory storage for demo purposes
const files = new Map<string, FileMetadata>();

export const fileStorage = {
  async getFiles(): Promise<FileMetadata[]> {
    return Array.from(files.values());
  },

  async addFile(metadata: FileMetadata): Promise<void> {
    files.set(metadata.id, metadata);
  },

  async updateFile(metadata: FileMetadata): Promise<void> {
    if (!files.has(metadata.id)) {
      throw new Error("File not found");
    }
    files.set(metadata.id, metadata);
  },

  async deleteFile(fileId: string): Promise<void> {
    if (!files.has(fileId)) {
      throw new Error("File not found");
    }
    files.delete(fileId);
  },
};
