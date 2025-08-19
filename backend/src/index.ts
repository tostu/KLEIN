import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";

import routes from "./routes/index.js";

const app = new Hono();

app.use("/assets/*", serveStatic({ root: "./static" }));
app.use("/favicon/*", serveStatic({ root: "./static" }));

// Enable CORS for frontend requests
app.use(
  "/*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://klein.app.tostu.me",
    ], // Add your frontend URLs
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type"],
  }),
);
// Proxy endpoint to get file info (optional)
app.get("/file-info/:url", async (c) => {
  try {
    const encodedUrl = c.req.param("url");
    const fileUrl = decodeURIComponent(encodedUrl);

    // Make a HEAD request to get file info
    const response = await fetch(fileUrl, { method: "HEAD" });

    if (!response.ok) {
      return c.json({ error: "File not found" }, 404);
    }

    return c.json({
      url: fileUrl,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      lastModified: response.headers.get("last-modified"),
    });
  } catch (error) {
    console.error("File info error:", error);
    return c.json({ error: "Failed to get file info" }, 500);
  }
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "uguu.se proxy",
  });
});

// Test endpoint to verify uguu.se connectivity
app.get("/test-uguu", async (c) => {
  try {
    const response = await fetch("https://uguu.se", { method: "HEAD" });
    return c.json({
      uguuStatus: response.ok ? "reachable" : "unreachable",
      statusCode: response.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      uguuStatus: "unreachable",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.route("/", routes);
app.get("*", serveStatic({ path: "./static/index.html" }));

export default app;
