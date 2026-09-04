import { start } from "./bootstrap.js";

start().catch((error) => {
  console.error("Unable to start Great Lakes Bank API", error);
  process.exit(1);
});
