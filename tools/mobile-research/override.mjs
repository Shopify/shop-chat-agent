// Load the local chat widget (extensions/chat-bubble) into the phone's on-screen Chrome tab
// instead of the deployed extension, so a fix can be checked on the real device before
// `shopify app deploy`. Serves assets/chat.js and assets/chat.css from disk and applies PATCHES
// to the rendered HTML for edits made in chat-interface.liquid.
// The override lives only in that tab and only while this script runs (stop it to restore).
// Don't open pages with capture.ps1 -Url while it runs; that opens a new tab without the override.
// Prereq: adb forward tcp:9222 localabstract:chrome_devtools_remote (capture.ps1 sets it)
// Usage:  node tools/mobile-research/override.mjs [urlSubstring] [navigateUrl] [port]
import { readFileSync } from "node:fs";

const match = process.argv[2] || "informatica.com.ua";
const navigateUrl = process.argv[3];
const port = process.argv[4] || "9222";
const assetsDir = new URL("../../extensions/chat-bubble/assets/", import.meta.url);

// Rendered-HTML equivalents of edits to chat-interface.liquid
const PATCHES = [
  [
    /<input type="text" placeholder="([^"]*)">/,
    '<textarea rows="1" enterkeyhint="send" placeholder="$1"></textarea>',
  ],
];

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

const connect = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    const listeners = [];
    let nextId = 1;
    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const id = nextId++;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const call = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) call.rej(new Error(msg.error.message));
        else call.res(msg.result);
      } else {
        listeners.forEach((listener) => listener(msg));
      }
    };
    ws.onopen = () => resolve({ ws, send, on: (listener) => listeners.push(listener) });
    ws.onerror = () => reject(new Error("CDP connection failed"));
  });

const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
let client;
let host;
for (const tab of tabs.filter((t) => t.type === "page" && t.url.includes(match))) {
  const candidate = await connect(tab.webSocketDebuggerUrl);
  try {
    const { result } = await withTimeout(
      candidate.send("Runtime.evaluate", { expression: "document.visibilityState", returnByValue: true }),
      3000,
    );
    if (result.value === "visible") {
      client = candidate;
      host = new URL(tab.url).host;
      break;
    }
  } catch {}
  candidate.ws.close();
}
if (!client) {
  console.error(`No on-screen phone tab matching "${match}".`);
  process.exit(1);
}

const { send, on } = client;

on(async ({ method, params }) => {
  if (method !== "Fetch.requestPaused") return;
  const { requestId, request, resourceType, responseStatusCode, responseHeaders } = params;
  try {
    const asset = request.url.match(/\/assets\/(chat\.(?:js|css))(?:\?|$)/);
    if (asset) {
      const type = asset[1].endsWith(".js") ? "application/javascript" : "text/css";
      await send("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: `${type}; charset=utf-8` },
          { name: "Cache-Control", value: "no-store" },
        ],
        body: readFileSync(new URL(asset[1], assetsDir)).toString("base64"),
      });
      console.log(`local ${asset[1]}`);
    } else if (
      resourceType === "Document" &&
      new URL(request.url).host === host &&
      responseStatusCode >= 200 &&
      responseStatusCode < 300
    ) {
      const { body, base64Encoded } = await send("Fetch.getResponseBody", { requestId });
      let html = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
      let applied = 0;
      for (const [from, to] of PATCHES) {
        if (from.test(html)) {
          html = html.replace(from, to);
          applied++;
        }
      }
      await send("Fetch.fulfillRequest", {
        requestId,
        responseCode: responseStatusCode,
        responseHeaders: responseHeaders.filter((h) => !/^(content-length|content-encoding)$/i.test(h.name)),
        body: Buffer.from(html).toString("base64"),
      });
      console.log(`document ${request.url.slice(0, 90)} (${applied}/${PATCHES.length} patches)`);
    } else {
      await send("Fetch.continueRequest", { requestId });
    }
  } catch (error) {
    console.error(`${request.url.slice(0, 90)}: ${error.message}`);
    send("Fetch.continueRequest", { requestId }).catch(() => {});
  }
});

await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Fetch.enable", {
  patterns: [
    { urlPattern: "*/assets/chat.js*", requestStage: "Request" },
    { urlPattern: "*/assets/chat.css*", requestStage: "Request" },
    { resourceType: "Document", requestStage: "Response" },
  ],
});
if (navigateUrl) await send("Page.navigate", { url: navigateUrl });
else await send("Page.reload", { ignoreCache: true });
console.log(`Override active on ${host}. Stop this process to restore the deployed widget.`);
