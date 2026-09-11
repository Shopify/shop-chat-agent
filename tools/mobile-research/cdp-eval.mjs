// Evaluate measure.js inside the on-screen Chrome tab of the USB-connected
// Android phone and print the JSON snapshot. Background tabs are skipped, so the
// numbers always match what a screenshot shows.
// Prereq: adb forward tcp:9222 localabstract:chrome_devtools_remote
// Usage:  node tools/mobile-research/cdp-eval.mjs [urlSubstring] [port] [setupJs]
// setupJs runs before measuring, e.g. an experiment:
//   "document.querySelector('.shop-ai-chat-input input').autocomplete = 'off'"
import { readFileSync } from "node:fs";

const match = process.argv[2] || "informatica.com.ua";
const port = process.argv[3] || "9222";
const setup = process.argv[4] ? `${process.argv[4]};\n` : "";
const expression = setup + readFileSync(new URL("./measure.js", import.meta.url), "utf8");

const evaluate = (tab) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("timeout"));
    }, 3000);
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true },
        }),
      );
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      const failure = msg.error || msg.result.exceptionDetails;
      if (failure) reject(new Error(JSON.stringify(failure)));
      else resolve(msg.result.result.value);
    };
    ws.onerror = (event) => {
      clearTimeout(timer);
      reject(new Error(`CDP connection failed: ${event.message || event.type}`));
    };
  });

const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const candidates = tabs.filter((t) => t.type === "page" && t.url.includes(match));

for (const tab of candidates) {
  try {
    const snapshot = await evaluate(tab);
    if (snapshot.visibility === "visible") {
      console.log(JSON.stringify(snapshot, null, 2));
      process.exit(0);
    }
  } catch (error) {
    console.error(`${tab.url}: ${error.message}`);
  }
}

console.error(
  `No on-screen phone tab matching "${match}" (${candidates.length} background matches). ` +
    "Bring Chrome with that page to the foreground.",
);
process.exit(1);
