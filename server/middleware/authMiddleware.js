import jwt from "jsonwebtoken";
import User from "../models/User.js";

const createUnauthorizedError = () => {
  const error = new Error("Authentication required");
  error.statusCode = 401;
  return error;
};

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const [scheme, token, extra] = authorization?.trim().split(/\s+/) || [];

  if (scheme !== "Bearer" || !token || extra || !process.env.JWT_SECRET) {
    req.log?.warn({ path: req.originalUrl }, "Authentication rejected: missing or malformed bearer token");
    return next(createUnauthorizedError());
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select(
      "_id name email createdAt updatedAt",
    );

    if (!user) {
      req.log?.warn({ path: req.originalUrl }, "Authentication rejected: user no longer exists");
      return next(createUnauthorizedError());
    }

    req.user = user;
    return next();
  } catch (error) {
    req.log?.warn({ err: error, path: req.originalUrl }, "Authentication rejected: invalid or expired token");
    return next(createUnauthorizedError());
  }
};

export default protect;
