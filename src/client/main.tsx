import { render } from "preact";
import { App } from "./app";

// Served by the API server (not the bundler), so they're linked at runtime.
for (const [rel, href, type] of [
  ["manifest", "/manifest.webmanifest"],
  ["icon", "/icon.svg", "image/svg+xml"],
  ["apple-touch-icon", "/icon-192.png"],
] as const) {
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (type) link.type = type;
  document.head.appendChild(link);
}

render(<App />, document.getElementById("app")!);

if ("serviceWorker" in navigator && location.hostname !== "localhost" && location.protocol === "https:") {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
