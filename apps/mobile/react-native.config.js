const appEnvRaw = process.env.APP_ENV || process.env.EAS_BUILD_PROFILE || "local";
const appEnv = String(appEnvRaw).trim().toLowerCase();
const isDevLike = appEnv === "dev" || appEnv === "local";

module.exports = {
  project: {
    android: {
      packageName: isDevLike
        ? "ie.freespace.app.dev"
        : "ie.freespace.app",
    },
  },
  dependencies: {
    "react-native-date-picker": {
      platforms: {
        ios: null,
      },
    },
  },
};
