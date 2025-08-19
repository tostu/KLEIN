import { Hono } from "hono";
import upload from "./upload.js";
import proxy from "./proxy.js";

const routes = [
  { path: "/upload", handler: upload },
  { path: "/proxy-image", handler: proxy },
];

const app = new Hono();

// Mount all routes from array
routes.forEach(({ path, handler }) => {
  app.route(path, handler);
});

export default app;
