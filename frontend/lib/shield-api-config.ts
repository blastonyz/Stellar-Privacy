export type AppEnv = "development" | "production";

const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "development") as AppEnv;

const defaults: Record<AppEnv, string> = {
  development:
    process.env.NEXT_PUBLIC_SHIELD_API_DEV ?? "http://localhost:8080",
  production: process.env.NEXT_PUBLIC_SHIELD_API_PROD ?? "",
};

/** Resolved Shield backend base URL (no trailing slash). */
export const shieldApiBaseUrl = (
  process.env.NEXT_PUBLIC_SHIELD_API ?? defaults[appEnv] ?? defaults.development
).replace(/\/$/, "");

export const shieldApiConfig = {
  appEnv,
  isProduction: appEnv === "production",
  baseUrl: shieldApiBaseUrl,
};

export function assertShieldApiConfigured(): void {
  if (!shieldApiBaseUrl) {
    throw new Error(
      appEnv === "production"
        ? "Set NEXT_PUBLIC_SHIELD_API_PROD or NEXT_PUBLIC_SHIELD_API for production builds."
        : "Set NEXT_PUBLIC_SHIELD_API_DEV or NEXT_PUBLIC_SHIELD_API for the local Shield backend.",
    );
  }
}
