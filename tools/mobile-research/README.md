# Mobile chat research kit (real Android + soft keyboard)

Desktop DevTools device mode can't show how the chat behaves on a phone. It draws
no keyboard, the visual viewport never shrinks, and in "Responsive" mode the UA
stays desktop, so the `isMobile` code path in `chat.js` never runs. Take real
measurements on a real phone instead.

## One-time setup

1. adb: Android platform-tools extracted to `C:\tools\platform-tools` (add to PATH
   or let `capture.ps1` find it there).
2. Phone: Settings → About phone → tap *Build number* 7× → Developer options →
   **USB debugging** on. Xiaomi/Redmi: tap *MIUI/HyperOS version* 7× instead; Developer
   options are under *Additional settings*; also enable **USB debugging (Security settings)**
   so scripted taps work. Plug in and accept the RSA prompt. Check with `adb devices`, which should
   show `<serial>  device`. If Windows shows the phone only as a WPD/MTP device
   (Xiaomi `PID_FF40`), USB debugging isn't active yet.
   Also enable **Stay awake** in Developer options. A locked or sleeping phone pauses
   Chrome, so screenshots come out black and measurements time out.
3. Desktop Chrome → `chrome://inspect/#devices`. Phone Chrome tabs appear. **Inspect**
   opens full DevTools with a live screencast of the real page. If the phone doesn't
   show up while the adb server is running, untick *Discover USB devices*.

## Measure

- **By hand:** in the inspected tab's console, paste `measure.js`. It returns a
  snapshot and then logs a table every time the keyboard opens or closes or the
  visual viewport scrolls.
- **Scripted:** `node tools/mobile-research/cdp-eval.mjs [urlSubstring]` (after
  `adb forward tcp:9222 localabstract:chrome_devtools_remote`, which `capture.ps1` does for you).
- **Screenshot + measurement per step:** `tools/mobile-research/capture.ps1`
  (see header for examples). Output goes to `docs/mobile-ux/<site>/<step>.png|json`.
  Tap coordinates = pixel coordinates in the previous screenshot, or computed from an
  element's CSS rect: `x = cssX × dpr`, `y = (cssY + screenH − innerH) × dpr`. With the
  URL bar showing and gesture navigation, `screenH − innerH` is the browser top bar height.
  `-Browser` picks the Chrome flavour (default `com.chrome.beta`; stable is
  `com.android.chrome`). Each running flavour has its own DevTools socket, and the script
  forwards the right one.

The screenshot is taken about 1 s before the measurement. While the URL bar or keyboard is
still animating, the two can disagree, and the **screenshot is ground truth**. Re-capture
with a longer `-WaitMs` if they differ.
They can also disagree in a stable state. When the URL bar reappears while the chat opens from a scrolled
page, Chrome keeps reporting the URL-bar-hidden `innerH` (839 instead of 783), so every rect is about 56 px
off and `inputFullyVisible` says true for an input that's actually hidden (baseline `08r-05`). Always
look at the screenshot, not just the JSON.

Key fields: `innerH` (layout viewport), `vvH` / `vvOffsetTop` (what's actually visible),
`occludedH` (keyboard + autofill row), `headerVisible`, `inputGapToVvBottom`,
`visibleMessagesH`.

**Diagnosis check (keyboard open):** `innerH` unchanged + `vvH` smaller + `vvOffsetTop > 0`
means Chrome's default `interactive-widget=resizes-visual`: the browser scrolls the
visual viewport to the input and pushes the header off-screen. If `innerH` shrinks
instead, the page is in `resizes-content` mode.

## Testing local changes before deploying

`override.mjs` makes the phone tab load `extensions/chat-bubble/assets/chat.js` and `chat.css`
from your working copy, and patches the rendered HTML for `chat-interface.liquid` edits (keep
`PATCHES` in the script in sync with those edits). Run it in its own terminal, since it has to keep running:

```powershell
node tools/mobile-research/override.mjs kabel-essager "<product url>"   # navigates the on-screen tab
```

It prints `local chat.js`, `local chat.css` and `document ... (1/1 patches)` when the override took effect.
Then run the scenario with `capture.ps1` **without `-Url`**, which would open a new tab without the override.
Stop the script to get the deployed widget back.

## Baseline scenario (as run for `docs/mobile-ux/baseline/`)

Run it again after any layout fix and compare the JSON step by step.

Tap coordinates below are for the **Redmi Note 12S** (1080×2400, dpr 2.75), portrait, URL bar
visible, page at scroll 0, current widget layout. On another phone, or after a fix moves
elements, recompute them from the JSON rects: `x = cssX × dpr`, `y = (cssY + screenH − innerH) × dpr`.
Bottom-anchored elements (FAB, fan options) keep their screen position when the URL bar hides.
Top-anchored ones (chat close button) don't.

```powershell
$env:Path = "C:\tools\platform-tools;$env:Path"
$c = ".\tools\mobile-research\capture.ps1"; $m = "kabel-essager"
$u = "https://informatica.com.ua/products/kabel-essager-type-c-pd-100w-fast-charge-s-displeem-qc-3-0-200sm-provod-dlya-bystroy-zaryadki-i-peredachi-dannykh"
& $c -Site baseline -Step 01-chat-closed        -Url $u -Match $m -WaitMs 7000
& $c -Site baseline -Step 02a-fan-open          -Tap 960,2280 -Match $m -WaitMs 1200   # main FAB
& $c -Site baseline -Step 02b-chat-opened       -Tap 959,2098 -Match $m -WaitMs 1500   # "AI-помічник" fan option
& $c -Site baseline -Step 02c-keyboard-dismissed -Back -Match $m -WaitMs 1200           # only if occludedH > 100!
& $c -Site baseline -Step 03-input-focused      -Tap 440,2283 -Match $m -WaitMs 1200   # chat input (keyboard closed)
& $c -Site baseline -Step 04-sent               -Text "usb c cable 100w" -Enter -Match $m -WaitMs 4000  # hits PRODUCTION chat
& $c -Site baseline -Step 05-products           -Match $m -WaitMs 15000
& $c -Site baseline -Step 06-keyboard-hidden    -Back -Match $m -WaitMs 1200
& $c -Site baseline -Step 07-chat-closed-again  -Tap 978,644 -Match $m -WaitMs 1200    # close X (URL bar visible)
```

- **08 scroll position:** `adb shell input swipe 540 1700 540 800 400`, capture `08a`, tap FAB and
  AI option (same coordinates), capture `08c` with `-WaitMs 4000` or more (the URL bar comes back
  while the chat opens), Back if the keyboard is open, then close. The close button's y after scrolling is
  `(rects.header.top + 32 + screenH − innerH) × dpr`. Compare `scrollY` before and after.
- **09 autofill row:** on a closed chat, pass
  `-Setup 'document.querySelector(".shop-ai-chat-input input").setAttribute("autocomplete","off")'`,
  then open through FAB → AI option and compare `occludedH`.
- **Back safety:** press Back only when `occludedH > 100` (keyboard open). Otherwise Back leaves the page
  or closes the tab.
- **Landscape:** `adb shell settings put system accelerometer_rotation 0`, then
  `adb shell settings put system user_rotation 1` (`0` = portrait). Coordinates must be recomputed.

## Scenario for other sites

1. `01-chat-closed`: page loaded, chat closed
2. `02-chat-open`: open the chat (tap the launcher, or use the widget's JS API, e.g. `$crisp.push(["do","chat:open"])`)
3. `03-input-focused`: tap the input, keyboard open
4. `04-back-keyboard-hidden`: Back
5. `05-second-back`: Back again. Does it close the widget or leave the page?

## Comfort checklist (score per site/step)

- Chat header + close button visible with keyboard open
- Input flush above keyboard (not covered, no gap)
- Latest message visible; auto-scroll on keyboard open / new reply
- Visible message area height with keyboard open (px)
- Background page doesn't jump; scroll position restored on close
- No unexpected zoom; autofill row shown?
- Keyboard auto-opens on chat open?
- Product cards usable with keyboard open
- Tap targets ≥ 44px; keyboard dismiss behaviour
- Landscape usability

## Competitors

Intercom (intercom.com), Crisp (crisp.chat), Tidio (tidio.com), tawk.to, Zendesk
messaging, Gorgias and Shopify Inbox (on stores using them), plus Telegram Web as a
keyboard reference. Run the same scenario. Also check *how* each one does it: viewport meta
(`interactive-widget`?), panel height (`100dvh`, JS px from `visualViewport`, or a
full-screen iframe), `visualViewport` listeners, autofocus, input
`font-size`/`autocomplete`/`enterkeyhint`, body scroll-lock. For iframe widgets, set
`window.__mrSelectors` or run `measure.js` in the iframe's context. For shadow-DOM widgets,
add `shadowHost`, e.g. Tidio:
`-Setup 'window.__mrSelectors = { shadowHost: "#tidio-chat", window: ".chat", header: ".tidio-li9nkz", messages: "#conversation-group", input: ".input-group" }'`
(hashed class names change between Tidio releases, so re-discover them if rects come back null).

Observed so far: Chrome shows its key/card/location autofill row for `<input type=text>`
(even with `autocomplete="off"`) but not for `<textarea>`. The row costs about 64 CSS px of height.
