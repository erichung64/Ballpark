import index from "../client/index.html";
import { handleAnswer, handleDay, handleOpen, handleStanding, isDev } from "./api";

const PUBLIC = new URL("../../public/", import.meta.url).pathname;

const staticFile = (name: string, type: string) => () =>
  new Response(Bun.file(PUBLIC + name), {
    headers: { "content-type": type, "cache-control": "public, max-age=86400" },
  });

const ip = (req: Request, srv: { requestIP(r: Request): { address: string } | null }) =>
  (process.env.RAILWAY_ENVIRONMENT_ID && req.headers.get("x-real-ip")) || srv.requestIP(req)?.address || "unknown";

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  development: isDev ? { hmr: true, console: true } : false,
  routes: {
    "/": index,
    "/api/day": { GET: handleDay },
    "/api/open": { POST: (req, srv) => handleOpen(req, ip(req, srv)) },
    "/api/answer": { POST: (req, srv) => handleAnswer(req, ip(req, srv)) },
    "/api/standing": { GET: handleStanding },
    "/manifest.webmanifest": staticFile("manifest.webmanifest", "application/manifest+json"),
    "/icon.svg": staticFile("icon.svg", "image/svg+xml"),
    "/icon-192.png": staticFile("icon-192.png", "image/png"),
    "/icon-512.png": staticFile("icon-512.png", "image/png"),
    "/favicon.ico": staticFile("icon-192.png", "image/png"),
    "/sw.js": staticFile("sw.js", "text/javascript"),
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
  error(err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  },
});

console.log(`Ballpark running at ${server.url}${isDev ? " (dev)" : ""}`);
