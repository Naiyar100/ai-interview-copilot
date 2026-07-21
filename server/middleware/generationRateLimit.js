const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 6;
const requestsByUser = new Map();

const generationRateLimit = (req, res, next) => {
  const now = Date.now();
  const userId = req.user._id.toString();
  const recentRequests = (requestsByUser.get(userId) || []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );

  if (recentRequests.length >= MAX_REQUESTS) {
    const error = new Error("Too many AI requests. Please try again later.");
    error.statusCode = 429;
    return next(error);
  }

  recentRequests.push(now);
  requestsByUser.set(userId, recentRequests);
  return next();
};

export default generationRateLimit;
