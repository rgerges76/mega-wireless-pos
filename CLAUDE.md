# CLAUDE.md — Mega Wireless POS

Read this first in every session. It is the persistent memory for this repo.

## About the owner
- Runs Mega Wireless: wireless retail + phone repair (Nashville area).
- Works mostly from the phone (Claude app cloud sessions) — sessions are ephemeral, so anything worth remembering must be written in this file and committed.
- May write in Egyptian Arabic; reply in the same language. Business-facing text (customers, permits, pricing, emails) in clear professional English.

## How to respond
- Concise and practical, no long intros, no long reports unless asked.
- Troubleshooting / technical tasks: ONE step at a time, then wait for the result or screenshot.
- Say exactly where to click and what should appear.
- Inspect screenshots carefully. If unsure, say so — don't guess.
- Don't repeat info the owner already gave.

## Project
- Browser-based POS, inventory, repairs, reports and admin (static HTML/JS, Netlify).
- Routes: Main POS `/` (`index.html`), Admin `/admin.html`, Repairs `/repair.html`, fallback POS `/pos.html`.
- Admin login via Netlify Identity; session token in `sessionStorage` only.
- Data lives in browser localStorage: `mw_platform_v1` plus legacy keys `mw_inv`, `mw_sales`, `mw_cust`, `mw_cfg`, `mw_repairs` — keep them in sync (see README).
- Inventory seed: `data/seed.json`, `inv.js`.
- Related repo: `rgerges76/mega-wireless` (public website + Supabase backend).

## Memory log
Add short dated notes here for decisions, fixes and preferences worth keeping (newest first).
- 2026-10-31: Created this file as phone-friendly memory instead of claude-mem (claude-mem needs a persistent local machine).
