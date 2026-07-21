const requiredEnvironmentVariables = [
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "CLIENT_URL",
];

const validateEnvironment = () => {
  const missingVariables = requiredEnvironmentVariables.filter(
    (variable) => !process.env[variable]?.trim(),
  );

  if (missingVariables.length) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`,
    );
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.warn(
      "GEMINI_API_KEY is not configured. Authentication will remain available, but AI question generation is disabled.",
    );
  }
};

export default validateEnvironment;
