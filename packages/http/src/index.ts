import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ message: "Cerebrate server is running!" });
});

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Cerebrate server starting on port ${port}...`);

export default {
  port,
  fetch: app.fetch,
};
