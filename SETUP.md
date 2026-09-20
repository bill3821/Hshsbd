# Setup

MEMECOIN SNIPER is a single-page app. It runs entirely in your browser — there is
nothing to build and no dependencies to install. The launcher in `launcher/`
serves it from a small local web server (stock Python 3, standard library only)
and opens it for you.

Serving it over `http://127.0.0.1` rather than opening the file directly matters:
from a `file://` page, browsers give the app a null origin and the DexScreener and
Jupiter calls get blocked.

## 1. Get the files

```bash
git clone https://github.com/bill3821/Hshsbd.git
cd Hshsbd
```

## 2. Put an icon on your Desktop

**macOS / Linux**

```bash
./launcher/install-desktop-icon.sh
```

**Windows** — double-click `launcher\install-desktop-icon.bat`.

That creates a **Fly Trader** icon on your Desktop (on Linux it also lands in your
application menu, on macOS it's a real `Fly Trader.app`). Double-click it and the
app starts: a console window opens with the log, and your browser opens the app.

Close the app by pressing `Ctrl+C` in that console window, or just closing it.

## 3. Point it at your RPC

The first run asks for an RPC endpoint:

```
RPC URL: https://mainnet.helius-rpc.com/?api-key=YOUR-KEY
```

Paste yours and press Enter — or press Enter alone to use the free public
`api.mainnet-beta.solana.com`, which is heavily rate-limited and will miss fills.

It's saved to `config.local.js`, which is git-ignored, so your API key stays on
your machine and never gets committed. To change it later:

```bash
python3 launcher/fly_trader.py --set-rpc
```

You can also override it for a single run:

```bash
FLY_RPC_URL="https://mainnet.helius-rpc.com/?api-key=YOUR-KEY" ./launcher/fly-trader.command
```

## 4. Trade

1. Paste the base58 private key of a **dedicated** wallet and hit **Load**.
2. Check the numbers under **Settings** — buy size, take profit, max hold, slippage.
3. Hit **START BOT**.

The key is held in the page only; it signs transactions locally and is gone as soon
as you close the tab. The bot trades real SOL — fund the wallet with an amount you
are willing to lose outright.

## Running it without the icon

```bash
python3 launcher/fly_trader.py            # serve + open browser
python3 launcher/fly_trader.py --port 9000
python3 launcher/fly_trader.py --no-browser
```

## If something doesn't work

| Symptom | Fix |
| --- | --- |
| "Python 3 was not found" | Install it from [python.org](https://python.org), then re-run the launcher. |
| Icon does nothing (Linux) | Right-click it → *Allow Launching* / *Trust*. |
| macOS: "can't be opened, unidentified developer" | Right-click `Fly Trader.app` → **Open** → **Open**. |
| Wallet loads but balance is wrong or slow | Your RPC is rate-limiting. Re-run with `--set-rpc` and use a paid endpoint. |
| "Invalid key" | The app wants a base58 secret key, not a seed phrase or a JSON array. |
| Page is blank | Check `vendor/solana-web3.iife.min.js` is present — that's the Solana library. |

## Changes from the original single file

- **`@solana/web3.js` is vendored** into `vendor/` instead of being pulled from
  unpkg on every load. If the CDN is slow or blocked the wallet can't load and
  the bot can't sign anything, so the bundle now ships with the app. The unpkg
  copy stays as a fallback. See `vendor/README.md`.
- **Transaction-version detection was fixed.** Jupiter returns v0 versioned
  transactions by default. The original check read the version bit from byte 0
  of the serialized transaction, but that byte is the signature count, so every
  swap went to the legacy parser and failed with
  `✗ Sign/send: Versioned messages must be deserialized...`. No trade could
  complete. The bit is now read from the message, after the signature array.
- **The RPC endpoint is configurable** via `config.local.js`, rather than being
  hardcoded to the public mainnet endpoint.

Trading logic, filters, defaults and UI are untouched.

## Files

| Path | What it is |
| --- | --- |
| `Index.html` | The app. |
| `config.local.js` | Your RPC endpoint. Git-ignored, created by the launcher. |
| `config.example.js` | Template for the above. |
| `launcher/fly_trader.py` | The launcher: local server + browser. |
| `launcher/fly-trader.command` / `.sh` / `.bat` | Double-clickable wrappers. |
| `launcher/install-desktop-icon.*` | Creates the Desktop icon. |
| `launcher/make_icon.py` | Regenerates the icon art. |
| `vendor/` | Vendored `@solana/web3.js` bundle. |
| `test/` | End-to-end browser test of the bot loop. See `test/README.md`. |
