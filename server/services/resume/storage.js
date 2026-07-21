import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const RESUME_UPLOAD_DIRECTORY = path.resolve(
  currentDirectory,
  "../../uploads/resumes",
);

export const ensureResumeUploadDirectory = () =>
  mkdir(RESUME_UPLOAD_DIRECTORY, { recursive: true });

export const createStoredResumeName = () => `${randomUUID()}.pdf`;

export const calculateResumeChecksum = async (filePath) => {
  const file = await readFile(filePath);
  return createHash("sha256").update(file).digest("hex");
};

export const deleteStoredResume = async (storedFileName) => {
  const filePath = path.resolve(RESUME_UPLOAD_DIRECTORY, storedFileName);
  if (path.dirname(filePath) !== RESUME_UPLOAD_DIRECTORY) {
    throw new Error("Invalid stored resume path");
  }

  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};
