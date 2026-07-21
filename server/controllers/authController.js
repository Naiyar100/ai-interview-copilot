import { sendSuccess } from "../utils/apiResponse.js";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRequiredFields = (fields) =>
  Object.entries(fields)
    .filter(([, value]) => typeof value !== "string" || !value.trim())
    .map(([field]) => `${field} is required`);

const createHttpError = (statusCode, message, errors = []) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = errors;
  return error;
};

export const registerUser = async (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = validateRequiredFields({ name, email, password });

  if (errors.length) {
    return next(
      createHttpError(400, "Please provide all required fields", errors),
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return next(createHttpError(400, "Please provide a valid email address"));
  }

  if (password.length < 6) {
    return next(
      createHttpError(400, "Password must be at least 6 characters long"),
    );
  }

  const existingUser = await User.exists({ email: normalizedEmail });

  if (existingUser) {
    return next(
      createHttpError(409, "An account with this email already exists"),
    );
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
  });
  req.log?.info({ userId: user._id.toString(), event: "auth.register" }, "User registered");

  return sendSuccess(res, 201, "User registered successfully", {
    token: generateToken(user._id),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
};

export const loginUser = async (req, res, next) => {
  const { email, password } = req.body;
  const errors = validateRequiredFields({ email, password });

  if (errors.length) {
    return next(
      createHttpError(400, "Please provide email and password", errors),
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return next(createHttpError(400, "Please provide a valid email address"));
  }

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password",
  );

  if (!user || !(await user.comparePassword(password))) {
    req.log?.warn({ email: normalizedEmail, event: "auth.login_failed" }, "Login failed");
    return next(createHttpError(401, "Invalid email or password"));
  }

  req.log?.info({ userId: user._id.toString(), event: "auth.login" }, "User logged in");

  return sendSuccess(res, 200, "Login successful", {
    token: generateToken(user._id),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
};

export const getCurrentUser = async (req, res) =>
  sendSuccess(res, 200, "User profile fetched successfully", {
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      createdAt: req.user.createdAt,
    },
  });
