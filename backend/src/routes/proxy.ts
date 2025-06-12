import { Hono } from "hono";

const proxy = new Hono();

proxy.get("/", async (c) => {
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

export default proxy;
