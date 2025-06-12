import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const spa = new Hono();

spa.get("*", serveStatic({ path: "./static/index.html" }));

export default spa;
