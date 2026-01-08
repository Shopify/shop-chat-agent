# 🔄 How to Restart Your Shop Chat Agent (Development)

When you close your computer or the terminal process stops, you'll need to restart the development server and update the chat configuration. Follow these steps:

---

## 📋 Step-by-Step Restart Process

### Step 1: Open Terminal
Open your Terminal application and navigate to the project directory:
```bash
cd /Users/romanzenner/Dev/shop-chat-agent
```

### Step 2: Start the Development Server
Run the Shopify development command:
```bash
shopify app dev
```

**What to expect:**
- You'll see loading animations and build messages
- Wait for: **"✅ Ready, watching for changes in your app"**
- This usually takes 15-30 seconds

### Step 3: Find Your New Tunnel URL
Once the server is ready, look for this line in the terminal output:
```
└ Using URL: https://[something-random].trycloudflare.com
```

**Example:**
```
└ Using URL: https://featuring-thesaurus-situated-combat.trycloudflare.com
```

**⚠️ IMPORTANT:** This URL changes every time you restart! You need to copy the new one.

**Alternative method:** Press `a` in the terminal to see App info, which shows the URL.

### Step 4: Create Your Chat API URL
Take the tunnel URL and add `/chat` to the end:

**Example:**
- Tunnel URL: `https://featuring-thesaurus-situated-combat.trycloudflare.com`
- Chat API URL: `https://featuring-thesaurus-situated-combat.trycloudflare.com/chat` ✅

### Step 5: Update in Shopify Theme Editor
1. Go to **Shopify Admin** → **Online Store** → **Themes**
2. Click **Customize** (on your active theme)
3. In the left sidebar, click the **App embeds** icon (🧩 puzzle piece)
4. Find **"AI Chat Assistant"**
5. Click the **settings/gear icon** ⚙️ next to it
6. Scroll down to find **"Chat API URL"**
7. **Replace the old URL** with your new Chat API URL
8. Click **Save** (top right corner)

### Step 6: Test It
1. **Refresh your storefront** page (hard refresh: `Cmd + Shift + R` on Mac)
2. **Open the chat bubble** (bottom right corner)
3. **Send a test message** like "hi" or "show me products"
4. You should see the AI respond! 🎉

---

## 🚨 Common Issues & Fixes

### Issue 1: "Error: listen EADDRINUSE: address already in use"
**Solution:** Kill the stuck process first:
```bash
pkill -9 -f "shopify"
lsof -ti:9293 | xargs kill -9 2>/dev/null
sleep 2
shopify app dev
```

### Issue 2: "Failed to fetch" or "ERR_CONNECTION_REFUSED"
**Cause:** You haven't updated the Chat API URL in the theme editor.
**Solution:** Follow Steps 4-6 above to update the URL.

### Issue 3: Chat shows "Chat API URL not configured"
**Cause:** The URL in the theme settings is empty or still has the placeholder.
**Solution:** Make sure you've saved the new tunnel URL in the theme editor (Steps 4-6).

---

## 💡 Quick Reference

**Commands:**
```bash
# Navigate to project
cd /Users/romanzenner/Dev/shop-chat-agent

# Start server
shopify app dev

# Kill stuck processes (if needed)
pkill -9 -f "shopify"
```

**URLs to Update:**
- Find in terminal: `└ Using URL: https://xxx.trycloudflare.com`
- Add `/chat`: `https://xxx.trycloudflare.com/chat`
- Update at: Shopify Admin → Themes → Customize → App embeds → AI Chat Assistant

---

## 🎯 Why Does This Happen?

The development server uses **Cloudflare Tunnels** to expose your local server to the internet. These tunnel URLs are:
- ✅ **Free and convenient** for development
- ❌ **Temporary** - they change every restart
- ⚠️ **Only for development** - not for production

**For Production:** You'll deploy to a permanent hosting service (Shopify hosting, Railway, Heroku, etc.) with a fixed URL that never changes.

---

## 📝 Notes

- The `.env` file with your `CLAUDE_API_KEY` persists across restarts (no need to change it)
- Your database (`dev.sqlite`) persists (conversation history is saved)
- Only the **tunnel URL** changes each restart

---

**Last Updated:** November 4, 2025

