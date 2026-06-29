import "./bootstrap-env.js";
import http from "node:http";
import https from "node:https";

export async function fetchHorizonJson(url: string): Promise<unknown> {
  const insecure = process.env.NODE_TLS !== "1";

  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const request = lib.get(
      url,
      parsed.protocol === "https:" ? { rejectUnauthorized: !insecure } : {},
      (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          response.resume();
          return;
        }

        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
  });
}
