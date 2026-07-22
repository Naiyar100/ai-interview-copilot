const UNSAFE_KEY_PATTERN = /(^\$)|\./;

const findUnsafeKey = (value, path = "request") => {
  if (!value || typeof value !== "object") return null;

  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_KEY_PATTERN.test(key)) return `${path}.${key}`;
    const nestedKey = findUnsafeKey(child, `${path}.${key}`);
    if (nestedKey) return nestedKey;
  }

  return null;
};

export const preventNoSqlInjection = (req, res, next) => {
  void res;
  const unsafeKey = [req.body, req.query, req.params]
    .map((value) => findUnsafeKey(value))
    .find(Boolean);

  if (unsafeKey) {
    const error = new Error("Request contains an unsafe field name");
    error.statusCode = 400;
    error.errors = [unsafeKey];
    return next(error);
  }

  return next();
};

export const requireJsonContentType = (req, res, next) => {
  void res;
  const hasRequestBody =
    Number(req.headers["content-length"] || 0) > 0 ||
    Boolean(req.headers["transfer-encoding"]);
  if (
    ["POST", "PUT", "PATCH"].includes(req.method) &&
    hasRequestBody &&
    !["/api/resumes", "/api/resume", "/api/resume/upload"].includes(req.path) &&
    !req.is("application/json")
  ) {
    const error = new Error("Content-Type must be application/json");
    error.statusCode = 415;
    return next(error);
  }
  return next();
};
