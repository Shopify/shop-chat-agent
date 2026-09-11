# Mobile chat UX findings (real Android + soft keyboard)

Device: Redmi Note 12S, Chrome Beta 154, CSS viewport 392×873, dpr 2.75, gesture navigation.
With the URL bar visible, `innerH` = 783. The method is in `tools/mobile-research/README.md`.
The screenshots and JSON captures named below (`baseline/`, `competitors/`, `experiments/`, `fixed/`) were
removed from the tree after merging. View them at commit `1dd6354`, e.g.
`git show 1dd6354:docs/mobile-ux/fixed/03-input-focused.png > 03.png`.

## Why desktop emulation looked fine

Chrome on Android (since 108) defaults to `interactive-widget=resizes-visual`. When the keyboard opens,
the layout viewport keeps its height (`innerH` 783), only the visual viewport shrinks (`vvH` 464),
and Chrome scrolls the visual viewport down (`vvOffsetTop` 319) to reveal the focused input.
DevTools device mode has no keyboard and a desktop UA in Responsive mode, so neither the
keyboard behaviour nor the widget's mobile code path (`isMobile` UA sniff) runs there.

## Baseline: our widget (product page, Essager cable)

| Step | innerH | vvH | vvOffsetTop | occluded | Header visible | Visible messages | Observation |
|---|---|---|---|---|---|---|---|
| 01 chat closed | 783 | 783 | 0 | 0 | – | – | – |
| 02b open chat (fan → AI) | 783 | 464 | 319 | 319 | **no** | 380 px | Autofocus pops the keyboard 500 ms after opening, so the user never sees the header/greeting |
| 02c keyboard dismissed | 783 | 783 | 0 | 0 | yes | 522 px | Window is only 671 px tall (top 112), so the site header + breadcrumb show above it |
| 03 tap input | 783 | 464 | 319 | 319 | **no** | 380 px | Same as 02b |
| 04 send message | 783 | 464 | 319 | 319 | **no** | 380 px | Own message and greeting are hidden above; only the typing dots are visible |
| 05 reply with products | 783 | 464 | 319 | 319 | **no** | 380 px | Cards fill the view; reply text and header hidden; product list scrolls inside the scrolling chat |
| 06 keyboard hidden (Back) | 783 | 783 | 0 | 0 | yes | 522 px | Recovers |
| 07 close chat | 783 | 783 | 0 | 0 | – | – | – |
| 08 page scrolled 399 px → open → close | 839 (open) | 520 | 319 | 319 | **no** | – | **Scroll position lost** (399 → 0; re-run 389 → 0). Opened from a scrolled page, the **input stays hidden under the autofill row**, with the same result at +4 s and +8 s (`08r-04`, `08r-05`). The URL bar is back on screen but Chrome still reports the URL-bar-hidden `innerH` 839, so the page is drawn about 56 px lower than the rects say. The JSON `inputFullyVisible: true` is wrong here; the screenshot is ground truth |
| 09 `autocomplete="off"` on input | 783 | 464 | 319 | 319 | **no** | 380 px | Chrome's key/card/location row still shown; no height gained |

## Root causes (confirmed on device)

1. **Header pushed off-screen:** the window is `position: fixed` and sized to the layout viewport,
   but the user sees only `[vvOffsetTop, vvOffsetTop + vvH]` = `[319, 783]`. The top 319 px
   (header, close button, first messages) are off-screen. Nothing in the widget listens to
   `visualViewport`.
2. **Fixed `80vh` height:** `chat.css:28` `--dynamic-vh: 80vh`. `chat.js` writes `--viewport-height`,
   which no CSS reads (dead wiring).
3. **Autofocus on open** (`chat.js:145-147`) opens the keyboard immediately, so the first impression is an empty grey box.
4. **Scroll lock by `body { position: fixed }`** (`chat.css:673-678`) resets the page to the top on open, and nothing restores it on close.
5. **`<input type=text>`** triggers Chrome's autofill accessory row (about 64 px). `autocomplete="off"` doesn't remove it. A `<textarea>` doesn't get the row (seen on Tidio).
6. **Short conversations are top-aligned** inside the messages area, so they sit in the hidden 319 px.
7. **Nested scroll:** product grid `max-height: 40vh; overflow-y: auto` inside the scrolling messages area (`chat.css:641-645`).

## Competitors

### Tidio (tidio.com, shadow DOM `#tidio-chat`)

- **Size and lock:** full-screen panel (`position: fixed; top: 0; bottom: 0` = 783 px). Scroll lock uses `overflow: hidden` on html/body, not `position: fixed`.
- **Opening:** no autofocus. Opens on a home screen and needs one more tap into the conversation.
- **Keyboard:** same `resizes-visual` result. `vvOffsetTop` 255, **header also hidden**, 429 px of messages visible, input flush above the keyboard.
- **Input:** `<textarea>`, so no autofill row (occluded 255 vs our 319). Font 14 px, no `enterkeyhint` (Enter shows ↵).
- **Back button:** opening adds `#mobile-widget` to the URL. The first Back hides the keyboard, the second closes the widget and stays on the page.

### Crisp (crisp.chat, light DOM `.crisp-client`)

This is the reference behaviour.

- **Size and lock:** full-screen panel (`position: fixed`) whose `max-height` is set **by JS to the visible viewport height** (inline `max-height: 782.909px` → `528px` when the keyboard opens). Scroll lock uses `overflow: hidden` via a class on `<html>`, not `position: fixed`.
- **Opening:** no autofocus. Opens on the Messages tab with the greeting and suggestion chips.
- **Keyboard:** `vvOffsetTop` stays **0**. The panel shrinks to `vvH` (528), so Chrome has nothing to scroll: header, close button, chips and input are all visible and 417 px of messages show (screenshot `03-input-focused`).
- **Input:** `<textarea autocomplete="off">`, 13.6 px, so no autofill row (occluded 255).
- **Back button:** the first Back hides the keyboard and the panel returns to 783 px. The second Back left the page. Back isn't intercepted, but the tab had been opened by an adb intent, so Chrome closed it.
- **Viewport meta:** `maximum-scale=1, user-scalable=0, viewport-fit=cover` on its own site. That disables zoom, which an embedded widget can't (and shouldn't) impose on a merchant theme.

## Other confirmed issues

- **No Android Back handling:** `chat.js` uses no history API (`pushState`/`popstate`/`hashchange`), so pressing Back with the chat open (keyboard hidden) leaves the product page. Tidio pushes `#mobile-widget`, so Back closes the widget and keeps the shopper on the page.

## Experiments on our widget (live JS injection, no deploy)

Both were run on a fresh product page load, opening the chat through fan → AI, which autofocuses and opens the keyboard.

| Experiment | innerH | vvH | vvOffsetTop | Window (top–bottom) | Header visible | Visible messages | Result |
|---|---|---|---|---|---|---|---|
| Baseline (02b) | 783 | 464 | 319 | 112–783 | no | 380 px | Header and greeting off-screen |
| A: runtime `interactive-widget=resizes-content` | **464** | 464 | 0 | 48–464 | **yes** | 267 px | Works: Chrome honours a meta changed after load. But the **whole merchant page** resizes, the site header takes space above the chat, and the page's fixed/sticky elements would be affected |
| B: `visualViewport` fit (Crisp-style) | 783 | 464 | 255 | 255–719 | **yes** | 315 px | Works: chat header, greeting and input fill exactly the visible area, and the page layout is untouched |

Setup JS used for B (passed with `capture.ps1 -Setup`):

```js
var w = document.querySelector(".shop-ai-chat-window"); var vv = window.visualViewport;
window.__mrFit = function () { w.style.top = vv.offsetTop + "px"; w.style.bottom = "auto";
  w.style.height = vv.height + "px"; w.style.maxHeight = vv.height + "px"; };
vv.addEventListener("resize", __mrFit); vv.addEventListener("scroll", __mrFit); __mrFit();
```

## Comparison summary (keyboard open)

| | Ours | Tidio | Crisp |
|---|---|---|---|
| Header / close visible | no | no | **yes** |
| Visual viewport scrolled by Chrome | 319 px | 255 px | **0** |
| Occluded by keyboard (+ autofill row) | 319 px | 255 px | 255 px |
| Autofocus on open | yes | no | no |
| Input element | `input` (autofill row) | `textarea` | `textarea` |
| Page scroll lock | `body { position: fixed }`, **position lost** | `overflow: hidden` | `overflow: hidden` |
| Back closes chat | no (leaves page) | **yes** (`#mobile-widget`) | no |

## Proposed fixes, ranked (for the follow-up implementation)

1. **Fit the open chat to the visual viewport on mobile** (experiment B, the Crisp pattern). While open, make the window full-screen and track `visualViewport` `resize`/`scroll` (`top = offsetTop`, `height = height`). This replaces the fixed `80vh` and the dead `--viewport-height` wiring. It fixes the header, greeting and input visibility (root causes 1, 2 and 6). Prefer it over experiment A, which resizes the merchant's whole page.
   *Verified in one state only:* chat opened with the keyboard up, on a fresh page at scroll 0. **Not yet
   verified:** keyboard dismissed (the window must grow back), close and reopen (inline `top`/`height` must be
   cleared on close), opening from a scrolled page, and product-card replies. Cover these with the full scenario when implementing.
2. **Don't autofocus the input on mobile open** (Tidio and Crisp don't). The shopper sees the header and greeting first, and the keyboard opens on their tap.
3. **Use `<textarea rows="1" enterkeyhint="send">`** instead of `<input type=text>`. This removes Chrome's autofill row and shows a send key. Enter-to-send needs `keydown` handling (Shift+Enter for a new line).
   *Measured on our page* (`experiments/textarea-autofill-row/`): with the keyboard open, an injected `<textarea>` leaves
   **255 px** covered and an `<input type=text>` **319 px**, so the switch gives the chat **64 px** more.
4. **Replace the `body { position: fixed }` lock with `overflow: hidden` on html/body** (Tidio and Crisp). This keeps the page scroll position (399 → 0 today). It may also avoid the URL-bar jump that hid the input when the chat was opened from a scrolled page (`08c`). That second effect is unverified, so re-test with scenario 08.
5. **Make Android Back close the chat:** push a history state or hash on open, close on `popstate` (Tidio pattern).
6. **Keep the latest message in view:** scroll to bottom on `visualViewport` resize, and bottom-align short conversations.
7. **Remove the nested product-grid scroll** (`max-height: 40vh; overflow-y: auto`) on mobile.
8. **Use one definition of "mobile"** (UA sniff in JS vs the 480 px CSS breakpoint) so wide phones and landscape get the same layout.

Verify each fix by re-running the baseline scenario (steps 01–09) with `capture.ps1` and comparing JSON with
`baseline/` at commit `1dd6354`.

## Implemented and verified (branch `feat/mobile-keyboard-ux`)

Fixes 1–5 were implemented in `chat.js`, `chat.css` and `chat-interface.liquid`, then verified on the same phone
**before deploying**, using `tools/mobile-research/override.mjs` (serves the local files to the phone tab).
Captures were in `fixed/` (see commit `1dd6354`), and every row below was checked on the screenshot, not only in the JSON.

| Step | innerH | vvH | vvOffsetTop | Window | Screenshot |
|---|---|---|---|---|---|
| 02b open chat (fan → AI) | 783 | 783 | 0 | 0–783 | Full screen: header, conversation, input. **No keyboard** |
| 03 tap input (page top) | 528 | 528 | 0 | 0–528 | **Header visible**, textarea right above the keyboard, **no autofill row**, latest message in view |
| 06 Back | 783 | 783 | 0 | 0–783 | Keyboard hidden, chat still open |
| 07 Back again | 783 | 783 | 0 | closed | **Chat closed, still on the product page** |
| 08c open from page scrolled 391 px | 839 | 839 | 0 | 0–839 | Header visible |
| 08d tap input (scrolled page) | 528 | 528 | 0 | 0–528 | **Textarea fully visible** (was hidden under the keyboard before) |
| 08e close with X | 783 | 783 | 0 | closed | **Scroll position kept (391 → 391)**, viewport meta restored |

A first pass also confirmed that Enter (the `keydown` handler) sends the message and the reply with product cards renders.

Verification turned up two more issues, both now fixed:

- **Theme header painted over the full-screen chat:** Shopify's app-block wrapper (`.shopify-app-block`) is
  `position: relative; z-index: 2`, a stacking context that traps the widget's `z-index: 9999` below the
  theme's sticky header section (`z-index: 10`). While the chat is open on mobile, the wrapper is raised to 9999 (`chat.css`).
- **Input hidden when the chat was opened from a scrolled page, even with the `visualViewport` fit:** with the
  URL bar hidden, the keyboard brings it back, but Chrome keeps the old `innerHeight` (839), so everything renders
  56 px too low. `scrollTo(0)` doesn't bring the bar back (probed). Fix: while the chat is open on mobile, append
  `interactive-widget=resizes-content` to the viewport meta tags (restored on close). Chrome then resizes the
  layout viewport consistently (`innerH` 528). The `visualViewport` fit stays as the fallback for browsers
  that ignore `interactive-widget` (e.g. iOS Safari).

Not verified: iOS Safari, landscape, desktop (the desktop code path is unchanged apart from the textarea and the Enter handler).
Follow-up changes:

- **App-block wrapper lift on all screen sizes:** the wrapper is now raised while the chat window **or its option menu**
  is open (not only on mobile). When closed it stays at `z-index: 2`, so theme drawers still cover the launcher.
  Checked on desktop Chrome with the rule injected: 2 closed, 9999 menu open, 9999 chat open, 2 after close. At a 911 px
  window height the desktop popup (top 228 px) didn't overlap the header either way.
- **Zoom-blocking viewport tag removed:** `chat-interface.liquid` rendered its own
  `<meta name="viewport" … maximum-scale=1.0, user-scalable=no>` into `<body>` on every page, blocking pinch-zoom store-wide.
  It's gone. The textarea is 16 px on mobile instead, which avoids iOS Safari's zoom-on-focus.
  **Not yet verified on the phone** (pinch-zoom before and after).

## Not covered this round

- Intercom, tawk.to, Zendesk, Gorgias, Shopify Inbox (same scenario, same kit)
- Landscape; `navigator.virtualKeyboard.overlaysContent` + `env(keyboard-inset-height)` (API is present on this device)
- iOS Safari (out of scope; different keyboard behaviour, and the 14 px input font will trigger focus-zoom there)
