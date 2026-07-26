import logger from "./logger.js";

const requiredEnvironmentVariables = [
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "CLIENT_URL",
];

const assertUrlList = (value, variable) => {
  for (const candidate of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new Error(`${variable} must contain valid HTTP(S) URLs`);
    }
  }
};

const validateEnvironment = () => {
  const missingVariables = requiredEnvironmentVariables.filter(
    (variable) => !process.env[variable]?.trim(),
  );

  if (missingVariables.length) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`,
    );
  }

  const environment = process.env.NODE_ENV || "development";
  if (!["development", "test", "production"].includes(environment)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGODB_URI)) {
    throw new Error("MONGODB_URI must be a valid MongoDB connection string");
  }
  if (!/^\d+$/.test(process.env.PORT || "5000")) {
    throw new Error("PORT must be a valid port number");
  }
  assertUrlList(process.env.CLIENT_URL, "CLIENT_URL");

  const storageProvider = process.env.STORAGE_PROVIDER || "local";
  if (!["local", "cloudinary"].includes(storageProvider)) {
    throw new Error("STORAGE_PROVIDER must be local or cloudinary");
  }

  if (environment === "production") {
    if (process.env.JWT_SECRET.trim().length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters in production");
    }
    if (!process.env.GEMINI_API_KEY?.trim()) {
      throw new Error("GEMINI_API_KEY is required in production");
    }
    if (storageProvider !== "cloudinary") {
      throw new Error("STORAGE_PROVIDER must be cloudinary in production");
    }
  }

  if (storageProvider === "cloudinary") {
    const cloudVariables = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
    const missingCloudVariables = cloudVariables.filter((name) => !process.env[name]?.trim());
    if (missingCloudVariables.length) {
      throw new Error(`Missing Cloudinary environment variables: ${missingCloudVariables.join(", ")}`);
    }
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    logger.warn(
      "GEMINI_API_KEY is not configured. Authentication will remain available, but AI question generation is disabled.",
    );
  }
};

export default validateEnvironment;
