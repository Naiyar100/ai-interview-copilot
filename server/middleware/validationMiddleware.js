import { body, param, query, validationResult } from "express-validator";
import { isValidTimezone } from "../services/dashboard/dateUtils.js";

export const validateRequest = (req, res, next) => {
  void res;
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const error = new Error("Validation failed");
  error.statusCode = 400;
  error.errors = result.array().map(({ path, msg }) => `${path}: ${msg}`);
  return next(error);
};

export const registerValidation = [
  body("name").isString().trim().isLength({ min: 1, max: 100 }),
  body("email").isEmail().normalizeEmail().isLength({ max: 254 }),
  body("password").isString().isLength({ min: 6, max: 128 }),
  validateRequest,
];

export const loginValidation = [
  body("email").isEmail().normalizeEmail().isLength({ max: 254 }),
  body("password").isString().isLength({ min: 1, max: 128 }),
  validateRequest,
];

export const profileValidation = [
  body("name").isString().trim().isLength({ min: 1, max: 100 }),
  body("email").isEmail().normalizeEmail().isLength({ max: 254 }),
  validateRequest,
];

export const objectIdValidation = [
  param("id").isMongoId().withMessage("must be a valid ObjectId"),
  validateRequest,
];

export const evaluationIdValidation = [
  param("id").isMongoId().withMessage("must be a valid ObjectId"),
  param("evaluationId").isMongoId().withMessage("must be a valid ObjectId"),
  validateRequest,
];

export const interviewCreateValidation = [
  body("role").isString().trim().isLength({ min: 1, max: 120 }),
  body("experienceLevel").isString().trim().isLength({ min: 1, max: 80 }),
  body("difficulty").isIn(["Easy", "Medium", "Hard"]),
  body("interviewType").isIn(["Technical", "Behavioral", "Mixed"]),
  body("questionCount").isInt({ min: 1, max: 20 }).toInt(),
  validateRequest,
];

export const interviewListValidation = [
  query("page").optional().isInt({ min: 1, max: 100000 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  query("difficulty").optional().isIn(["Easy", "Medium", "Hard"]),
  query("status").optional().isIn(["draft", "completed"]),
  query("role").optional().isString().trim().isLength({ max: 120 }),
  query("search").optional().isString().trim().isLength({ max: 120 }),
  query("date").optional().isISO8601({ strict: true }),
  query("sortBy").optional().isIn(["createdAt", "completedAt", "role", "difficulty", "status"]),
  query("sortOrder").optional().isIn(["asc", "desc"]),
  validateRequest,
];

export const reevaluationValidation = [
  param("id").isMongoId().withMessage("must be a valid ObjectId"),
  body("mode").optional().isIn(["keep", "replace"]),
  validateRequest,
];

export const dashboardTimezoneValidation = [
  query("timezone").optional().isString().trim().isLength({ min: 1, max: 80 }).custom(isValidTimezone).withMessage("must be a valid IANA timezone"),
  validateRequest,
];

export const goalValidation = [
  body("target").isInt({ min: 1, max: 50 }).toInt(),
  body("timezone").isString().trim().isLength({ min: 1, max: 80 }).custom(isValidTimezone).withMessage("must be a valid IANA timezone"),
  validateRequest,
];

export const activityListValidation = [
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validateRequest,
];

const cleanFeedbackText = (value) =>
  typeof value === "string"
    ? [...value.trim()]
        .filter((character) => {
          const code = character.charCodeAt(0);
          return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
        })
        .join("")
    : value;

export const feedbackValidation = [
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("must be a whole number from 1 to 5")
    .toInt(),
  body("liked")
    .isString()
    .customSanitizer(cleanFeedbackText)
    .isLength({ min: 1, max: 1000 }),
  body("improvements")
    .isString()
    .customSanitizer(cleanFeedbackText)
    .isLength({ min: 1, max: 1000 }),
  body("foundBug").isBoolean({ strict: true }).toBoolean(),
  body("bugDescription")
    .optional()
    .isString()
    .customSanitizer(cleanFeedbackText)
    .isLength({ max: 1000 }),
  body("pageOrFeature")
    .optional()
    .isString()
    .customSanitizer(cleanFeedbackText)
    .isLength({ max: 120 }),
  validateRequest,
];

const scheduleFields = [
  body("title").isString().trim().isLength({ min: 1, max: 120 }),
  body("role").isString().trim().isLength({ min: 1, max: 120 }),
  body("interviewType").isIn(["Technical", "Behavioral", "Mixed"]),
  body("difficulty").isIn(["Easy", "Medium", "Hard"]),
  body("scheduledAt").isISO8601().toDate().custom((value) => value.getTime() > Date.now()).withMessage("must be in the future"),
  body("notes").optional().isString().trim().isLength({ max: 500 }),
  body("reminderEnabled").optional().isBoolean().toBoolean(),
];

export const scheduleCreateValidation = [...scheduleFields, validateRequest];
export const scheduleUpdateValidation = [
  body("title").optional().isString().trim().isLength({ min: 1, max: 120 }),
  body("role").optional().isString().trim().isLength({ min: 1, max: 120 }),
  body("interviewType").optional().isIn(["Technical", "Behavioral", "Mixed"]),
  body("difficulty").optional().isIn(["Easy", "Medium", "Hard"]),
  body("scheduledAt").optional().isISO8601().toDate().custom((value) => value.getTime() > Date.now()).withMessage("must be in the future"),
  body("notes").optional().isString().trim().isLength({ max: 500 }),
  body("reminderEnabled").optional().isBoolean().toBoolean(),
  body("status").optional().isIn(["scheduled", "cancelled", "started"]),
  validateRequest,
];
