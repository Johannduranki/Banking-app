import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import worker from "../dist/server/index.js";

const root = join(process.cwd(), "dist", "client");
const mime = { ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".svg":"image/svg+xml", ".woff2":"font/woff2" };
async function assets(request) {
  const pathname = decodeURIComponent(new URL(request.url).pathname);
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root)) return new Response("Not found", { status:404 });
  try { if (!(await stat(file)).isFile()) throw new Error(); return new Response(await readFile(file), { headers:{ "content-type":mime[extname(file)] || "application/octet-stream" } }); }
  catch { return new Response("Not found", { status:404 }); }
}
createServer(async (req,res) => {
  try {
    const url = `http://${req.headers.host || "localhost:3002"}${req.url}`;
    const request = new Request(url, { method:req.method, headers:req.headers });
    const pathname = new URL(url).pathname;
    const response = pathname.startsWith("/assets/") || /\.(png|svg|woff2)$/.test(pathname)
      ? await assets(request)
      : await worker.fetch(request, { ASSETS:{ fetch:assets } }, { waitUntil(){}, passThroughOnException(){} });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { console.error(error); res.writeHead(500); res.end("Duranki local service error"); }
}).listen(3002, "127.0.0.1", () => console.log("Duranki ready at http://localhost:3002/"));
