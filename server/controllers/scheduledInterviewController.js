import ScheduledInterview from "../models/ScheduledInterview.js";
import { recordActivitySafe } from "../services/dashboard/activityService.js";
import { sendSuccess } from "../utils/apiResponse.js";

const formatSchedule = (item) => ({
  id: item._id, title: item.title, role: item.role, interviewType: item.interviewType,
  difficulty: item.difficulty, scheduledAt: item.scheduledAt, notes: item.notes,
  reminderEnabled: item.reminderEnabled, status: item.status,
  createdAt: item.createdAt, updatedAt: item.updatedAt,
});

const scheduleInput = (body) => [
  "title", "role", "interviewType", "difficulty", "scheduledAt",
  "notes", "reminderEnabled", "status",
].reduce((result, field) => body[field] === undefined ? result : { ...result, [field]: body[field] }, {});

const getOwnedSchedule = async (id, userId) => {
  const schedule = await ScheduledInterview.findById(id);
  if (!schedule) {
    const error = new Error("Scheduled interview not found");
    error.statusCode = 404;
    throw error;
  }
  if (!schedule.user.equals(userId)) {
    const error = new Error("You do not have access to this scheduled interview");
    error.statusCode = 403;
    throw error;
  }
  return schedule;
};

export const getScheduledInterviews = async (req, res) => {
  const schedules = await ScheduledInterview.find({ user: req.user._id, status: { $ne: "cancelled" } })
    .sort({ scheduledAt: 1 }).limit(20).lean();
  return sendSuccess(res, 200, "Scheduled interviews fetched successfully", { schedules: schedules.map(formatSchedule) });
};

export const createScheduledInterview = async (req, res) => {
  const schedule = await ScheduledInterview.create({ user: req.user._id, ...scheduleInput(req.body) });
  void recordActivitySafe({
    user: req.user._id, eventKey: `schedule:${schedule._id}:created`, type: "schedule_created",
    title: "Practice session scheduled", description: `${schedule.role} · ${schedule.difficulty}`,
    relatedEntityType: "schedule", relatedEntityId: schedule._id,
    metadata: { role: schedule.role, difficulty: schedule.difficulty }, xpAwarded: 0, occurredAt: schedule.createdAt,
  });
  return sendSuccess(res, 201, "Interview practice scheduled successfully", { schedule: formatSchedule(schedule) });
};

export const updateScheduledInterview = async (req, res) => {
  const schedule = await getOwnedSchedule(req.params.id, req.user._id);
  Object.assign(schedule, scheduleInput(req.body));
  await schedule.save();
  return sendSuccess(res, 200, "Scheduled interview updated successfully", { schedule: formatSchedule(schedule) });
};

export const deleteScheduledInterview = async (req, res) => {
  const schedule = await getOwnedSchedule(req.params.id, req.user._id);
  schedule.status = "cancelled";
  await schedule.save();
  return sendSuccess(res, 200, "Scheduled interview cancelled successfully", { id: schedule._id });
};
