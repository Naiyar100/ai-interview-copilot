import mongoose from "mongoose";
import { addUtcDays, isValidTimezone, toDateKey } from "../dashboard/dateUtils.js";

const PRESETS = new Set(["7d", "30d", "90d", "6m", "12m", "all", "custom"]);
const DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);
const TYPES = new Set(["Technical", "Behavioral", "Mixed"]);
const STATUSES = new Set(["draft", "completed"]);

const fail = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const cleanText = (value, label, max = 120) => {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > max || /[$\0{}]/.test(value)) fail(`Invalid ${label} filter`);
  return value.trim();
};

const parseScore = (value, label) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) fail(`${label} must be between 0 and 100`);
  return number;
};

const presetStart = (preset, today) => {
  const days = { "7d": 6, "30d": 29, "90d": 89, "6m": 182, "12m": 364 }[preset];
  return days == null ? null : addUtcDays(today, -days);
};

export const normalizeAnalyticsFilters = (query = {}) => {
  const timezone = cleanText(query.timezone || "UTC", "timezone", 80);
  if (!isValidTimezone(timezone)) fail("Invalid timezone");
  const preset = query.preset || "30d";
  if (!PRESETS.has(preset)) fail("Invalid date preset");
  const today = toDateKey(new Date(), timezone);
  let startDate = preset === "custom" ? query.startDate : presetStart(preset, today);
  let endDate = preset === "custom" ? query.endDate : preset === "all" ? null : today;
  if (preset === "custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "")) fail("Custom range requires valid start and end dates");
    if (startDate > endDate) fail("Start date must be before end date");
    if (startDate > today) fail("Date range cannot be entirely in the future");
    if (endDate > today) endDate = today;
  }
  const difficulty = cleanText(query.difficulty, "difficulty");
  const interviewType = cleanText(query.interviewType, "interview type");
  const status = cleanText(query.status, "status");
  if (difficulty && !DIFFICULTIES.has(difficulty)) fail("Invalid difficulty filter");
  if (interviewType && !TYPES.has(interviewType)) fail("Invalid interview type filter");
  if (status && !STATUSES.has(status)) fail("Invalid status filter");
  const resumeId = cleanText(query.resumeId, "resume", 30);
  if (resumeId && !mongoose.isValidObjectId(resumeId)) fail("Invalid resume filter");
  const voiceMode = cleanText(query.voiceMode, "voice mode", 10);
  if (voiceMode && !["voice", "text"].includes(voiceMode)) fail("Invalid voice mode filter");
  const scoreMin = parseScore(query.scoreMin, "Minimum score");
  const scoreMax = parseScore(query.scoreMax, "Maximum score");
  if (scoreMin != null && scoreMax != null && scoreMin > scoreMax) fail("Minimum score cannot exceed maximum score");
  const aggregation = query.aggregation || "day";
  if (!["day", "week", "month"].includes(aggregation)) fail("Invalid trend aggregation");
  return {
    preset, startDate: startDate || null, endDate: endDate || null, timezone,
    role: cleanText(query.role, "role"), interviewType, difficulty, status,
    category: cleanText(query.category, "category", 80), resumeId, voiceMode,
    scoreMin, scoreMax, aggregation,
  };
};

export const buildInterviewFilter = (userId, filters) => {
  const filter = { user: userId };
  if (filters.startDate || filters.endDate) {
    filter.createdAt = {};
    if (filters.startDate) filter.createdAt.$gte = dateKeyToUtc(filters.startDate, filters.timezone);
    if (filters.endDate) filter.createdAt.$lt = dateKeyToUtc(addUtcDays(filters.endDate, 1), filters.timezone);
  }
  if (filters.role) filter.role = filters.role;
  if (filters.interviewType) filter.interviewType = filters.interviewType;
  if (filters.difficulty) filter.difficulty = filters.difficulty;
  if (filters.status) filter.status = filters.status;
  if (filters.resumeId) filter.resume = filters.resumeId;
  if (filters.voiceMode) filter["voiceMetadata.mode"] = filters.voiceMode;
  if (filters.scoreMin != null || filters.scoreMax != null) {
    filter.score = {};
    if (filters.scoreMin != null) filter.score.$gte = filters.scoreMin;
    if (filters.scoreMax != null) filter.score.$lte = filters.scoreMax;
  }
  if (filters.category) filter["generatedQuestions.category"] = filters.category;
  return filter;
};

export const dateKeyToUtc = (dateKey, timezone) => {
  const target = Date.parse(`${dateKey}T00:00:00.000Z`);
  let candidate = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = formatter.formatToParts(new Date(candidate));
    const part = (type) => Number(parts.find((item) => item.type === type)?.value);
    const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    candidate += target - represented;
  }
  return new Date(candidate);
};

export const previousPeriodFilters = (filters) => {
  if (!filters.startDate || !filters.endDate || filters.preset === "all") return null;
  const days = Math.round((new Date(`${filters.endDate}T00:00:00Z`) - new Date(`${filters.startDate}T00:00:00Z`)) / 86400000) + 1;
  const endDate = addUtcDays(filters.startDate, -1);
  return { ...filters, startDate: addUtcDays(endDate, -days + 1), endDate };
};
