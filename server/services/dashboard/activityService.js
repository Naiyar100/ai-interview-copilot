import UserActivity from "../../models/UserActivity.js";
import logger from "../../config/logger.js";
import { invalidateAnalyticsCache } from "../analytics/cacheService.js";

const publicMetadata = (metadata = {}) => ({
  ...(typeof metadata.role === "string" ? { role: metadata.role } : {}),
  ...(typeof metadata.score === "number" ? { score: metadata.score } : {}),
  ...(typeof metadata.count === "number" ? { count: metadata.count } : {}),
  ...(typeof metadata.difficulty === "string" ? { difficulty: metadata.difficulty } : {}),
  ...(typeof metadata.durationMinutes === "number" ? { durationMinutes: metadata.durationMinutes } : {}),
});

export const formatActivity = (activity) => ({
  id: activity._id,
  type: activity.type,
  title: activity.title,
  description: activity.description,
  relatedEntityType: activity.relatedEntityType,
  relatedEntityId: activity.relatedEntityId,
  metadata: publicMetadata(activity.metadata),
  occurredAt: activity.occurredAt,
});

export const recordActivity = async (event) => {
  const result = await UserActivity.updateOne(
    { user: event.user, eventKey: event.eventKey },
    { $setOnInsert: event },
    { upsert: true },
  );
  if (result.upsertedCount === 1) invalidateAnalyticsCache(event.user.toString());
  return result.upsertedCount === 1;
};

export const recordActivitySafe = (event) =>
  recordActivity(event).catch((error) => {
    logger.warn({ err: error, eventKey: event.eventKey }, "Dashboard activity could not be recorded");
    return false;
  });

export const syncHistoricalActivities = async (userId, interviews, resumes) => {
  const events = [];
  interviews.forEach((interview) => {
    const id = interview._id.toString();
    events.push({
      user: userId, eventKey: `interview:${id}:created`, type: "interview_created",
      title: "Interview created", description: `${interview.role} practice started`,
      relatedEntityType: "interview", relatedEntityId: interview._id,
      metadata: { role: interview.role, difficulty: interview.difficulty }, xpAwarded: 10,
      occurredAt: interview.createdAt,
    });
    (interview.answers || []).forEach((answer, index) => {
      if (!answer?.trim()) return;
      events.push({
        user: userId, eventKey: `interview:${id}:question:${index + 1}`, type: "question_answered",
        title: "Interview question answered", description: interview.role,
        relatedEntityType: "interview", relatedEntityId: interview._id,
        metadata: { role: interview.role, count: 1 }, xpAwarded: 5,
        occurredAt: interview.updatedAt,
      });
    });
    if (interview.status === "completed") events.push({
      user: userId, eventKey: `interview:${id}:completed`, type: "interview_completed",
      title: "Interview completed", description: interview.role,
      relatedEntityType: "interview", relatedEntityId: interview._id,
      metadata: { role: interview.role, score: interview.score, durationMinutes: Math.round((interview.duration || 0) / 60) }, xpAwarded: 50,
      occurredAt: interview.completedAt || interview.updatedAt,
    });
    if (interview.evaluations?.length) events.push({
      user: userId, eventKey: `interview:${id}:evaluated`, type: "evaluation_generated",
      title: "AI evaluation generated", description: `${interview.role}${interview.score != null ? ` · ${interview.score}%` : ""}`,
      relatedEntityType: "interview", relatedEntityId: interview._id,
      metadata: { role: interview.role, score: interview.score }, xpAwarded: 15 + (interview.score >= 80 ? 25 : 0),
      occurredAt: interview.evaluations.at(-1).evaluatedAt,
    });
  });
  const firstVoiceInterview = interviews
    .filter((item) => item.status === "completed" && item.voiceMetadata?.mode === "voice")
    .sort((a, b) => new Date(a.completedAt || a.updatedAt) - new Date(b.completedAt || b.updatedAt))[0];
  if (firstVoiceInterview) events.push({
    user: userId, eventKey: "user:voice:first", type: "voice_interview_completed",
    title: "First voice interview completed", description: firstVoiceInterview.role,
    relatedEntityType: "interview", relatedEntityId: firstVoiceInterview._id,
    metadata: { role: firstVoiceInterview.role }, xpAwarded: 40,
    occurredAt: firstVoiceInterview.completedAt || firstVoiceInterview.updatedAt,
  });
  resumes.forEach((resume, index) => events.push({
    user: userId, eventKey: `resume:${resume._id}:uploaded`, type: "resume_uploaded",
    title: "Resume uploaded", description: resume.originalFileName,
    relatedEntityType: "resume", relatedEntityId: resume._id,
    metadata: {}, xpAwarded: index === 0 ? 50 : 0, occurredAt: resume.uploadDate || resume.createdAt,
  }));
  if (!events.length) return;
  await UserActivity.bulkWrite(events.map((event) => ({
    updateOne: {
      filter: { user: userId, eventKey: event.eventKey },
      update: { $setOnInsert: event },
      upsert: true,
    },
  })), { ordered: false });
};
