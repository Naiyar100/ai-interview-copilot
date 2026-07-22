import { sendError } from "../utils/apiResponse.js";

export const notFoundHandler = (req, res, next) => {
  const error = new Error(`API route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, req, res, next) => {
  void next;
  let statusCode = error.statusCode || 500;
  let message = error.message;
  let errors = error.errors || [];

  if (error.retryAfterSeconds) {
    res.set("Retry-After", String(error.retryAfterSeconds));
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    message = "The resume PDF exceeds the maximum allowed size";
  } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
    statusCode = 400;
    message = "Upload one PDF using the resume field";
  } else if (error.code === 11000 && error.keyPattern?.checksum) {
    statusCode = 409;
    message = "This resume has already been uploaded";
  } else if (error.code === 11000 && error.keyPattern?.name) {
    statusCode = 409;
    message = "A saved analytics view with this name already exists";
  } else if (error.code === 11000) {
    statusCode = 409;
    message = "An account with this email already exists";
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(error.errors).map(
      (validationError) => validationError.message,
    );
  } else if (statusCode === 500) {
    message = "Internal server error";
  }

  const log = statusCode >= 500 ? req.log?.error : req.log?.warn;
  log?.call(req.log, {
    err: error,
    statusCode,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?._id?.toString(),
  }, "Request failed");

  return sendError(res, statusCode, message, errors);
};
