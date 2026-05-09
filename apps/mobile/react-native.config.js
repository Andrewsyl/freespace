const appEnvRaw = process.env.APP_ENV || process.env.EAS_BUILD_PROFILE || "local";
const appEnv = String(appEnvRaw).trim().toLowerCase();
const isDevLike = appEnv === "dev" || appEnv === "local";

module.exports = {
  project: {
    android: {
      packageName: isDevLike
        ? "com.andrewsyl.carparking.dev"
        : "com.andrewsyl.carparking",
    },
  },
};
