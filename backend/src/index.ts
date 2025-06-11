import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Enable CORS for frontend requests
app.use(
  "/*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"], // Add your frontend URLs
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type"],
  }),
);

// In-memory storage for uploaded files (replace with proper storage in production)
const fileStorage = new Map();
let fileCounter = 0;

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// Upload endpoint
app.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("files[]");

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    // Generate unique filename
    const fileId = `file_${++fileCounter}_${Date.now()}`;
    const extension = file.name.split(".").pop() || "bin";
    const filename = `${fileId}.${extension}`;

    // Convert file to buffer for storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Store file data
    fileStorage.set(fileId, {
      filename: filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      buffer: buffer,
      uploadTime: new Date().toISOString(),
    });

    // Return response in format similar to Uguu
    return c.json({
      files: [
        {
          url: `${new URL(c.req.url).origin}/file/${fileId}`,
          filename: filename,
          size: file.size,
        },
      ],
    });
  } catch (error) {
    console.error("Upload error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// Download endpoint
app.get("/file/:fileId", async (c) => {
  const fileId = c.req.param("fileId");
  const fileData = fileStorage.get(fileId);

  if (!fileData) {
    return c.json({ error: "File not found" }, 404);
  }

  // Set appropriate headers
  c.header("Content-Type", fileData.mimeType);
  c.header("Content-Length", fileData.size.toString());
  c.header(
    "Content-Disposition",
    `inline; filename="${fileData.originalName}"`,
  );

  return c.body(fileData.buffer);
});

// List uploaded files (optional endpoint for debugging)
app.get("/files", (c) => {
  const files = Array.from(fileStorage.entries()).map(([id, data]) => ({
    id,
    filename: data.filename,
    originalName: data.originalName,
    size: data.size,
    uploadTime: data.uploadTime,
    url: `${new URL(c.req.url).origin}/file/${id}`,
  }));

  return c.json({ files });
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    filesStored: fileStorage.size,
  });
});

export default app;
