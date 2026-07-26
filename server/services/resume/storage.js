import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const RESUME_UPLOAD_DIRECTORY = path.resolve(
  currentDirectory,
  "../../uploads/resumes",
);

export const ensureResumeUploadDirectory = () =>
  mkdir(RESUME_UPLOAD_DIRECTORY, { recursive: true });

export const createStoredResumeName = () => `${randomUUID()}.pdf`;

const storageProvider = () => process.env.STORAGE_PROVIDER?.trim().toLowerCase() || "local";

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
};

export const calculateResumeChecksum = async (filePath) => {
  const file = await readFile(filePath);
  return createHash("sha256").update(file).digest("hex");
};

export const storeResume = async (filePath, storedFileName) => {
  if (storageProvider() !== "cloudinary") {
    return { storageProvider: "local", storageKey: storedFileName };
  }

  configureCloudinary();
  const publicId = `ai-interview-copilot/resumes/${path.parse(storedFileName).name}.pdf`;
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "raw",
    type: "authenticated",
    public_id: publicId,
    overwrite: false,
  });
  await unlink(filePath);
  return { storageProvider: "cloudinary", storageKey: result.public_id };
};

export const createResumePreview = async (storedFileName, provider = "local") => {
  if (provider === "cloudinary") {
    configureCloudinary();
    return {
      url: cloudinary.utils.private_download_url(storedFileName, "pdf", {
        resource_type: "raw",
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 300,
      }),
      expiresInSeconds: 300,
    };
  }
  const filePath = path.resolve(RESUME_UPLOAD_DIRECTORY, storedFileName);
  if (path.dirname(filePath) !== RESUME_UPLOAD_DIRECTORY) {
    throw new Error("Invalid stored resume path");
  }
  const file = await readFile(filePath);
  return { url: `data:application/pdf;base64,${file.toString("base64")}`, expiresInSeconds: 0 };
};

export const deleteStoredResume = async (storedFileName, provider = "local") => {
  if (provider === "cloudinary") {
    configureCloudinary();
    await cloudinary.uploader.destroy(storedFileName, {
      resource_type: "raw",
      type: "authenticated",
      invalidate: true,
    });
    return;
  }
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
