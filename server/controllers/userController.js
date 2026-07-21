import User from "../models/User.js";
import { sendSuccess } from "../utils/apiResponse.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createHttpError = (statusCode, message, errors = []) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = errors;
  return error;
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getUserProfile = async (req, res) =>
  sendSuccess(res, 200, "User profile fetched successfully", {
    user: formatUser(req.user),
  });

export const updateUserProfile = async (req, res, next) => {
  const { name, email } = req.body;
  const errors = [];

  if (typeof name !== "string" || !name.trim()) {
    errors.push("name is required");
  }

  if (typeof email !== "string" || !email.trim()) {
    errors.push("email is required");
  }

  if (errors.length) {
    return next(createHttpError(400, "Please provide valid profile details", errors));
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return next(createHttpError(400, "Please provide a valid email address"));
  }

  const duplicateUser = await User.exists({
    _id: { $ne: req.user._id },
    email: normalizedEmail,
  });

  if (duplicateUser) {
    return next(
      createHttpError(409, "An account with this email already exists"),
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      name: name.trim(),
      email: normalizedEmail,
    },
    { returnDocument: "after", runValidators: true },
  ).select("_id name email createdAt updatedAt");

  return sendSuccess(res, 200, "User profile updated successfully", {
    user: formatUser(user),
  });
};
