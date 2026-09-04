import type { Server } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { seedDemoData } from "./modules/customers/demo-seed.js";

export async function start(): Promise<Server> {
  await pool.query("SELECT 1");
  if(config.DEMO_MODE)await seedDemoData();
  const server = createApp().listen(config.PORT, () => {
    console.log(`${config.APP_BANK_NAME} API listening on port ${config.PORT}`);
  });
  const shutdown = () => server.close(() => void pool.end());
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return server;
}
