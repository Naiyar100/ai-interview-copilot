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
    return next(createUnauthorizedError());
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).select(
      "_id name email createdAt updatedAt",
    );

    if (!user) {
      return next(createUnauthorizedError());
    }

    req.user = user;
    return next();
  } catch {
    return next(createUnauthorizedError());
  }
};

export default protect;
