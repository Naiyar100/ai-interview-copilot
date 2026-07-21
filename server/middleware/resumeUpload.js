import path from "node:path";
import multer from "multer";
import {
  createStoredResumeName,
  ensureResumeUploadDirectory,
  RESUME_UPLOAD_DIRECTORY,
} from "../services/resume/storage.js";

await ensureResumeUploadDirectory();

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, RESUME_UPLOAD_DIRECTORY),
  filename: (req, file, callback) => callback(null, createStoredResumeName()),
});

const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (file.mimetype !== "application/pdf" || extension !== ".pdf") {
    const error = new Error("Only PDF resume files are supported");
    error.statusCode = 415;
    return callback(error);
  }
  return callback(null, true);
};

const resumeUpload = (req, res, next) => {
  const configuredLimit = Number(process.env.MAX_RESUME_SIZE_MB);
  const maximumSizeMb = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : 5;

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maximumSizeMb * 1024 * 1024,
      files: 1,
    },
  }).single("resume")(req, res, next);
};

export default resumeUpload;
