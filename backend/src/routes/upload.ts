import { Hono } from "hono";

const upload = new Hono();

upload.post("/", async (c) => {
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

export default upload;
