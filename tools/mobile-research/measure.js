// Mobile chat viewport measurement snippet.
// Paste into DevTools console (chrome://inspect -> phone tab) or run via cdp-eval.mjs.
// Returns a snapshot object and, once per page, logs a console.table on every
// visualViewport resize/scroll (keyboard open/close, focus scroll).
//
// Rects are in layout-viewport coordinates; the part the user actually sees is
// [vvOffsetTop, vvOffsetTop + vvH]. Competitor widgets: set window.__mrSelectors
// = { window, header, messages, input, shadowHost? } before running
// (shadowHost: query inside that element's open shadow root; iframes: select the iframe).
(() => {
  const sel = Object.assign(
    {
      window: ".shop-ai-chat-window",
      header: ".shop-ai-chat-header",
      messages: ".shop-ai-chat-messages",
      input: ".shop-ai-chat-input",
    },
    window.__mrSelectors,
  );
  const vv = window.visualViewport;
  const host = sel.shadowHost && document.querySelector(sel.shadowHost);
  const scope = (host && host.shadowRoot) || document;

  const rect = (selector) => {
    const el = scope.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
    };
  };

  const snapshot = () => {
    const vvTop = vv ? vv.offsetTop : 0;
    const vvBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const header = rect(sel.header);
    const messages = rect(sel.messages);
    const input = rect(sel.input);
    const meta = document.querySelector('meta[name="viewport"]');
    const active = document.activeElement;

    return {
      time: new Date().toISOString(),
      url: location.href,
      visibility: document.visibilityState,
      ua: navigator.userAgent,
      uaMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      cssMobile480: matchMedia("(max-width: 480px)").matches,
      orientation: screen.orientation ? screen.orientation.type : null,
      viewportMeta: meta ? meta.content : null,
      dpr: window.devicePixelRatio,
      screenH: screen.height,
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      vvH: vv ? Math.round(vv.height) : null,
      vvOffsetTop: vv ? Math.round(vv.offsetTop) : null,
      vvScale: vv ? vv.scale : null,
      scrollY: Math.round(window.scrollY),
      occludedH: vv ? Math.round(window.innerHeight - vv.height) : null,
      chatOpen: !!scope.querySelector(`${sel.window}.active`),
      bodyLocked: document.body.classList.contains("shop-ai-chat-open"),
      activeElement: active
        ? `${active.tagName.toLowerCase()}${active.className ? "." + String(active.className).trim().replace(/\s+/g, ".") : ""}`
        : null,
      rects: { window: rect(sel.window), header, messages, input },
      messagesScroll: (() => {
        const el = scope.querySelector(sel.messages);
        return el
          ? {
              top: Math.round(el.scrollTop),
              height: el.scrollHeight,
              client: el.clientHeight,
            }
          : null;
      })(),
      headerVisible: header
        ? header.top >= vvTop - 1 && header.bottom <= vvBottom + 1
        : null,
      inputFullyVisible: input
        ? input.top >= vvTop - 1 && input.bottom <= vvBottom + 1
        : null,
      inputGapToVvBottom: input ? Math.round(vvBottom - input.bottom) : null,
      visibleMessagesH: messages
        ? Math.max(
            0,
            Math.round(
              Math.min(messages.bottom, vvBottom) -
                Math.max(messages.top, vvTop),
            ),
          )
        : null,
    };
  };

  if (vv && !window.__mrWatching) {
    window.__mrWatching = true;
    let timer;
    const log = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = snapshot();
        console.table({
          innerH: s.innerH,
          vvH: s.vvH,
          vvOffsetTop: s.vvOffsetTop,
          occludedH: s.occludedH,
          scrollY: s.scrollY,
          headerVisible: s.headerVisible,
          inputGapToVvBottom: s.inputGapToVvBottom,
          visibleMessagesH: s.visibleMessagesH,
        });
      }, 150);
    };
    vv.addEventListener("resize", log);
    vv.addEventListener("scroll", log);
  }

  return snapshot();
})();
