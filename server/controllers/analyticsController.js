import mongoose from "mongoose";
import AnalyticsSavedView from "../models/AnalyticsSavedView.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { buildAnalyticsOverview, compareOwnedInterviews } from "../services/analytics/analyticsService.js";
import { normalizeAnalyticsFilters } from "../services/analytics/filterBuilder.js";
import { createAnalyticsExport } from "../services/analytics/exportService.js";

const fail = (statusCode, message) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const cleanName = (name) => {
  if (typeof name !== "string") fail(400, "Saved view name is required");
  const value = name.replace(/[<>$\0{}]/g, "").replace(/\s+/g, " ").trim();
  if (!value || value.length > 60) fail(400, "Saved view name must be between 1 and 60 characters");
  return value;
};
const formatView = (view) => ({ id: view._id, name: view.name, filters: view.filters, createdAt: view.createdAt, updatedAt: view.updatedAt });
const ownedView = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) fail(400, "Invalid saved view ID");
  const view = await AnalyticsSavedView.findById(id);
  if (!view) fail(404, "Saved analytics view not found");
  if (!view.user.equals(userId)) fail(403, "You do not have access to this saved view");
  return view;
};

export const getAnalyticsOverview = async (req, res) => {
  const filters = normalizeAnalyticsFilters(req.query);
  const analytics = await buildAnalyticsOverview(req.user, filters);
  return sendSuccess(res, 200, "Analytics fetched successfully", analytics);
};

export const compareInterviews = async (req, res) => {
  const ids = req.body?.interviewIds;
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4 || ids.some((id) => !mongoose.isValidObjectId(id)) || new Set(ids).size !== ids.length) fail(400, "Select 2 to 4 unique valid interviews");
  const interviews = await compareOwnedInterviews(req.user._id, ids);
  return sendSuccess(res, 200, "Interviews compared successfully", { interviews });
};

export const exportAnalytics = async (req, res) => {
  const filters = normalizeAnalyticsFilters(req.body?.filters || {});
  const analytics = await buildAnalyticsOverview(req.user, filters);
  const file = createAnalyticsExport(req.body?.format || "pdf", req.user, analytics);
  return sendSuccess(res, 200, "Analytics export generated successfully", {
    filename: file.filename, mimeType: file.mimeType, contentBase64: file.buffer.toString("base64"),
  });
};

export const listSavedViews = async (req, res) => {
  const views = await AnalyticsSavedView.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  return sendSuccess(res, 200, "Saved analytics views fetched successfully", { views: views.map(formatView) });
};

export const createSavedView = async (req, res) => {
  if (await AnalyticsSavedView.countDocuments({ user: req.user._id }) >= 10) fail(409, "You can save up to 10 analytics views");
  const filters = normalizeAnalyticsFilters(req.body?.filters || {});
  const view = await AnalyticsSavedView.create({ user: req.user._id, name: cleanName(req.body?.name), filters });
  return sendSuccess(res, 201, "Analytics view saved successfully", { view: formatView(view) });
};

export const updateSavedView = async (req, res) => {
  const view = await ownedView(req.params.id, req.user._id);
  if (req.body?.name !== undefined) view.name = cleanName(req.body.name);
  if (req.body?.filters !== undefined) view.filters = normalizeAnalyticsFilters(req.body.filters);
  await view.save();
  return sendSuccess(res, 200, "Analytics view updated successfully", { view: formatView(view) });
};

export const deleteSavedView = async (req, res) => {
  const view = await ownedView(req.params.id, req.user._id);
  await view.deleteOne();
  return sendSuccess(res, 200, "Analytics view deleted successfully", { id: view._id });
};
