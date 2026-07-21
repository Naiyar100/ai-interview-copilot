const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
const TOKEN_KEY = "authToken";

if (!API_URL) {
  throw new Error("VITE_API_URL is not configured");
}

export const apiRequest = async (
  path,
  { method = "GET", body, token, requiresAuth = false, signal } = {},
) => {
  const headers = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const authToken = token || (requiresAuth ? localStorage.getItem(TOKEN_KEY) : null);

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && requiresAuth) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }

    const error = new Error(payload.message || "Request failed");
    error.statusCode = response.status;
    error.errors = payload.errors || [];
    throw error;
  }

  return payload;
};

export const getUserProfile = () =>
  apiRequest("/users/me", { requiresAuth: true });

export const updateUserProfile = (profile) =>
  apiRequest("/users/me", {
    method: "PUT",
    body: profile,
    requiresAuth: true,
  });

export const getDashboardSummary = () =>
  apiRequest("/dashboard/summary", { requiresAuth: true });

export const getDashboardOverview = ({ timezone, signal } = {}) =>
  apiRequest(`/dashboard/overview?timezone=${encodeURIComponent(timezone || "UTC")}`, {
    requiresAuth: true,
    signal,
  });

export const updateDashboardGoal = ({ target, timezone }) =>
  apiRequest("/dashboard/goal", {
    method: "PUT",
    body: { target, timezone },
    requiresAuth: true,
  });

export const getScheduledInterviews = () =>
  apiRequest("/scheduled-interviews", { requiresAuth: true });

const toQueryString = (query = {}) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) params.set(key, value);
  });
  return params.toString();
};

export const getAnalyticsOverview = (filters = {}, signal) => {
  const query = toQueryString(filters);
  return apiRequest(`/analytics/overview${query ? `?${query}` : ""}`, { requiresAuth: true, signal });
};

export const compareAnalyticsInterviews = (interviewIds) =>
  apiRequest("/analytics/compare", { method: "POST", body: { interviewIds }, requiresAuth: true });

export const exportAnalytics = (format, filters) =>
  apiRequest("/analytics/export", { method: "POST", body: { format, filters }, requiresAuth: true });

export const getAnalyticsViews = () => apiRequest("/analytics/views", { requiresAuth: true });
export const createAnalyticsView = (name, filters) => apiRequest("/analytics/views", { method: "POST", body: { name, filters }, requiresAuth: true });
export const updateAnalyticsView = (id, updates) => apiRequest(`/analytics/views/${id}`, { method: "PUT", body: updates, requiresAuth: true });
export const deleteAnalyticsView = (id) => apiRequest(`/analytics/views/${id}`, { method: "DELETE", requiresAuth: true });

export const downloadBase64File = ({ contentBase64, filename, mimeType }) => {
  const bytes = Uint8Array.from(atob(contentBase64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
};

export const createScheduledInterview = (schedule) =>
  apiRequest("/scheduled-interviews", { method: "POST", body: schedule, requiresAuth: true });

export const updateScheduledInterview = (scheduleId, schedule) =>
  apiRequest(`/scheduled-interviews/${scheduleId}`, { method: "PUT", body: schedule, requiresAuth: true });

export const cancelScheduledInterview = (scheduleId) =>
  apiRequest(`/scheduled-interviews/${scheduleId}`, { method: "DELETE", requiresAuth: true });

const notifyInterviewChanged = () =>
  window.dispatchEvent(new Event("interviews:changed"));

export const createInterview = async (interview) => {
  const response = await apiRequest("/interviews", {
    method: "POST",
    body: interview,
    requiresAuth: true,
  });
  notifyInterviewChanged();
  return response;
};

export const generateInterviewQuestions = async (interviewId) => {
  const response = await apiRequest(`/interviews/${interviewId}/generate`, {
    method: "POST",
    requiresAuth: true,
  });
  notifyInterviewChanged();
  return response;
};

export const regenerateInterviewQuestions = async (
  interviewId,
  confirmAnswerReset = false,
) => {
  const response = await apiRequest(`/interviews/${interviewId}/regenerate`, {
    method: "POST",
    body: { confirmAnswerReset },
    requiresAuth: true,
  });
  notifyInterviewChanged();
  return response;
};

export const getInterviews = (query = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== "" && value !== null && value !== undefined) {
      searchParams.set(key, value);
    }
  });
  const queryString = searchParams.toString();
  return apiRequest(`/interviews${queryString ? `?${queryString}` : ""}`, {
    requiresAuth: true,
  });
};

export const getInterview = (interviewId) =>
  apiRequest(`/interviews/${interviewId}`, { requiresAuth: true });

export const updateInterview = async (interviewId, updates) => {
  const response = await apiRequest(`/interviews/${interviewId}`, {
    method: "PUT",
    body: updates,
    requiresAuth: true,
  });
  notifyInterviewChanged();
  return response;
};

export const completeInterview = async (interviewId, updates) => {
  const response = await apiRequest(`/interviews/${interviewId}/complete`, {
    method: "PATCH",
    body: updates,
    requiresAuth: true,
  });
  notifyInterviewChanged();
  return response;
};

export const evaluateInterview = async (interviewId) => {
  const response = await apiRequest(`/interviews/${interviewId}/evaluate`, {
    method: "POST",
    requiresAuth: true,
  });
  notifyInterviewChanged();
  return response;
};

export const reevaluateInterview = async (interviewId, mode = "keep") => {
  const response = await apiRequest(`/interviews/${interviewId}/re-evaluate`, {
    method: "POST",
    body: { mode },
    requiresAuth: true,
  });
  notifyInterviewChanged();
  return response;
};

export const getInterviewEvaluations = (interviewId) =>
  apiRequest(`/interviews/${interviewId}/evaluations`, { requiresAuth: true });

export const getInterviewEvaluation = (interviewId, evaluationId) =>
  apiRequest(`/interviews/${interviewId}/evaluations/${evaluationId}`, {
    requiresAuth: true,
  });

export const deleteInterview = async (interviewId) => {
  const response = await apiRequest(`/interviews/${interviewId}`, {
    method: "DELETE",
    requiresAuth: true,
  });
  notifyInterviewChanged();
  return response;
};

export const getResumes = () =>
  apiRequest("/resumes", { requiresAuth: true });

export const getResume = (resumeId) =>
  apiRequest(`/resumes/${resumeId}`, { requiresAuth: true });

export const setActiveResume = (resumeId) =>
  apiRequest(`/resumes/${resumeId}/active`, {
    method: "PATCH",
    requiresAuth: true,
  });

export const deleteResume = (resumeId) =>
  apiRequest(`/resumes/${resumeId}`, {
    method: "DELETE",
    requiresAuth: true,
  });

export const uploadResume = (file, onProgress = () => {}) =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("resume", file);

    request.open("POST", `${API_URL}/resumes`);
    request.setRequestHeader("Accept", "application/json");
    const authToken = localStorage.getItem(TOKEN_KEY);
    if (authToken) request.setRequestHeader("Authorization", `Bearer ${authToken}`);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      const payload = (() => {
        try {
          return JSON.parse(request.responseText || "{}");
        } catch {
          return {};
        }
      })();

      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }
      if (request.status === 401) {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
      const error = new Error(payload.message || "Resume upload failed");
      error.statusCode = request.status;
      error.errors = payload.errors || [];
      reject(error);
    });
    request.addEventListener("error", () => reject(new Error("Unable to reach the server")));
    request.send(formData);
  });
