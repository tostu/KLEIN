import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";

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

// Upload endpoint - now uploads to uguu.se
app.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("files[]");

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Check if file is an image
    if (!file.type.startsWith("image/")) {
      return c.json({ error: "Only image files are allowed" }, 400);
    }

    // Create FormData for uguu.se
    const uguuFormData = new FormData();
    uguuFormData.append("files[]", file);

    // Upload to uguu.se
    const response = await fetch("https://uguu.se/upload", {
      method: "POST",
      body: uguuFormData,
    });

    if (!response.ok) {
      throw new Error(`Uguu.se responded with status: ${response.status}`);
    }

    const result = await response.json();

    // Check if upload was successful
    if (!result.success || !result.files || result.files.length === 0) {
      throw new Error("Upload to uguu.se failed");
    }

    // Return the response with proxied URLs
    return c.json({
      success: true,
      files: result.files.map((file) => ({
        url: `/proxy-image?url=${file.url}`, // Return proxied URL
        originalUrl: file.url, // Keep original URL for reference
        filename: file.name,
        size: file.size || 0,
      })),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json(
      {
        success: false,
        error: "Upload failed",
        details: error.message,
      },
      500,
    );
  }
});

// Image proxy endpoint to avoid CORS issues
app.get("/proxy-image/:encodedUrl", async (c) => {
  try {
    const encodedUrl = c.req.param("encodedUrl");
    const imageUrl = decodeURIComponent(encodedUrl);

    // Validate that it's a uguu.se URL for security
    if (!imageUrl.startsWith("https://uguu.se/")) {
      return c.json({ error: "Invalid image URL" }, 400);
    }

    // Fetch the image from uguu.se
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
      );
      return c.json({ error: "Image not found" }, 404);
    }

    // Get the content type
    const contentType = response.headers.get("content-type");

    // Validate that it's actually an image
    if (!contentType || !contentType.startsWith("image/")) {
      return c.json({ error: "Invalid content type" }, 400);
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();

    // Set appropriate headers
    c.header("Content-Type", contentType);
    c.header("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    c.header("Content-Length", imageBuffer.byteLength.toString());

    // Return the image
    return c.body(imageBuffer);
  } catch (error) {
    console.error("Image proxy error:", error);
    return c.json({ error: "Failed to proxy image" }, 500);
  }
});

// Alternative proxy endpoint with direct URL parameter
app.get("/proxy-image", async (c) => {
  try {
    const imageUrl = c.req.query("url");

    if (!imageUrl) {
      return c.json({ error: "URL parameter is required" }, 400);
    }

    // Validate that it's a uguu.se URL for security
    if (!imageUrl.includes("uguu.se")) {
      return c.json({ error: "Invalid image URL" }, 400);
    }

    // Fetch the image from uguu.se
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
      );
      return c.json({ error: "Image not found" }, 404);
    }

    // Get the content type
    const contentType = response.headers.get("content-type");

    // Validate that it's actually an image
    if (!contentType || !contentType.startsWith("image/")) {
      return c.json({ error: "Invalid content type" }, 400);
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();

    // Set appropriate headers
    c.header("Content-Type", contentType);
    c.header("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    c.header("Content-Length", imageBuffer.byteLength.toString());

    // Return the image
    return c.body(imageBuffer);
  } catch (error) {
    console.error("Image proxy error:", error);
    return c.json({ error: "Failed to proxy image" }, 500);
  }
});

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

app.get("*", serveStatic({ path: "./static/index.html" }));

export default app;
