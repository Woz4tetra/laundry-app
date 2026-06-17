# 🧺 Laundry Recipe

A fun, mobile-first PWA that walks the family through our laundry process step by step:
sort → build loads → prep → wash → dry → done. It doubles as an interactive recipe and a
work-checker at key checkpoints (3/4-full gate, wash-settings confirmation, lint trap, etc.).
Runs on the home server and is reached over Tailscale.

## Features

- **Guided flow**: sort into bins, auto-proposed wash loads (with merge/split), then a
  per-load recipe with prep checklist, a 3/4-full gate, computed wash settings, and dry guidance.
- **Our actual machines**: stylized walkthroughs of the **LG washer (WM3400)** and
  **LG dryer (DLE3400W)** control panels, highlighting which dial/button to use, including
  emptying the lint trap.
- **Dryer calculator**: the dryer's auto mode is unreliable, so dial in a manual time/heat by
  load type, dampness, and fabric weight. Remembers the last settings per load type.
- **Bedtime scheduler**: warns when a wash+dry won't finish before quiet hours and suggests a
  delayed start (use the washer's Delay Wash button) so nothing runs while you sleep.
- **Live sync**: one shared session synced across phones over Server-Sent Events.
- **Timers + push notifications** when a wash or dry finishes (even with the app closed).
- **Editable rules**: every category, temperature, prep reminder, and machine step is editable
  in the in-app Rules editor as you learn more.
- **Mildly secure**: a single shared passcode behind Tailscale.

## Stack

- Web: Vite + React + TypeScript + Tailwind v4, installable PWA (vite-plugin-pwa).
- Server: Fastify + better-sqlite3 (single SQLite file), Web Push.
- Packaged as one Docker image.

## Develop

```bash
npm run install:all

# generate Web Push keys, paste into .env (see .env.example)
cp .env.example .env
npm run gen-vapid

# two terminals:
npm run dev:server   # http://localhost:23103
npm run dev:web      # http://localhost:32035 (proxies /api to the server)
```

To access the dev server from other devices on your local network, find your machine's IP:

```bash
ip route get 1 | awk '{print $7; exit}'   # Linux
# or: hostname -I | awk '{print $1}'
```

Then open `http://<your-ip>:32035` on any device on the same network. The Vite dev server
binds to all interfaces (`host: true`) and proxies `/api` to the backend on port 23103, which
also binds to `0.0.0.0`.

Run the engine unit tests:

```bash
npm test
```

## Deploy on the home server

Needs Docker with the Compose v2 plugin (the `docker compose` subcommand).
Ubuntu's `docker.io` package does not include it, so install the plugin too:

```bash
sudo apt install docker.io docker-compose-v2
```

Or install Docker Engine plus the Compose plugin from Docker's official repo:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Optional: run docker without `sudo` (log out and back in afterward, or run
`newgrp docker`):

```bash
sudo usermod -aG docker "$USER"
```

Then build and start:

```bash
cp .env.example .env       # set APP_PASSCODE, SESSION_SECRET, VAPID keys
docker compose up --build -d
```

If your machine only has the older Compose v1 (`docker-compose` as a separate
binary, with a hyphen), use `docker-compose up --build -d` instead.

Then open it from any device on the tailnet at `http://<tailscale-ip>:23103`. For HTTPS (needed
for some PWA/push features on iOS) expose it tailnet-only with:

```bash
tailscale serve --bg 23103
```

Data (the SQLite db) persists in `./data`.

## Notifications on Android

Push notifications fire when a wash or dry timer finishes, even with the app closed. Setup:

1. **Generate VAPID keys** and put them in `.env` (push is disabled without them):

   ```bash
   npm run gen-vapid   # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to paste into .env
   ```

   Restart the server after editing `.env`.

2. **Serve over HTTPS.** Web Push needs a secure origin. A plain
   `http://<tailscale-ip>:23103` will not work for notifications. Expose it tailnet-only:

   ```bash
   tailscale serve --bg 23103
   ```

   Then use the `https://<machine>.<tailnet>.ts.net` URL Tailscale prints.

3. **Install the app (Chrome on Android).** Open that HTTPS URL, then Chrome menu (⋮) →
   **Add to Home screen** / **Install app**. Installing makes notifications reliable and runs the
   app full screen.

4. **Enable notifications in-app.** Open the installed app, go to the **Rules** tab, and tap
   **Enable** next to 🔔 Notifications. Accept the browser permission prompt.

5. **If you dismissed the permission prompt**, re-grant it through Chrome (the reliable path on
   Pixel/Android). On the app's page tap the tune/page-info icon left of the address bar →
   **Permissions → Notifications → Allow**, or Chrome **⋮ → Settings → Site settings →
   Notifications**, find the app's origin, set it to **Allow**. The installed app uses the
   manifest short name, so in the app list it appears as **Laundry**, not "Laundry Recipe"; if a
   WebAPK was created its notifications may live under **Settings → Apps → Laundry** or, on many
   Pixels, under **Settings → Apps → Chrome**.

Each phone subscribes itself, so repeat steps 3 to 5 on every device. If notifications stop after a
server restart, the subscription is still valid; re-enabling in Rules re-registers it.

## Care-label scanner (later phase)

A care-label OCR helper is stubbed in. Point it at a local VLM (Qwen2.5-VL / Qwen3-VL) via
Ollama by setting `OLLAMA_URL` (and optionally `OLLAMA_MODEL`) in `.env`. Run Ollama with
`OLLAMA_KEEP_ALIVE=0` and a pinned `CUDA_VISIBLE_DEVICES` so it loads on demand and frees the GPU
between scans.
