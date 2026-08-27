# Mega Wireless POS

Mega Wireless browser-based POS, inventory, repairs, reports and admin control center.

## Canonical routes

- Main POS: `/` or `/index.html`
- Admin: `/admin.html` or `/admin`
- Repairs: `/repair.html` or `/repairs`
- Lightweight fallback POS: `/pos.html`

## Authentication

The Admin no longer uses the old hardcoded `mega4717` browser password.

Admin login uses the site's Netlify Identity token endpoint and stores the active session token only in `sessionStorage` for the current browser session.

## Data model

The project has a unified platform store in browser localStorage:

- `mw_platform_v1`

For compatibility with the original Main POS, the shared data bridge also reads/writes the legacy keys:

- `mw_inv` — inventory/cost/price/quantity/barcode/IMEI data
- `mw_sales` — Main POS transactions
- `mw_cust` — category/custom inventory lists
- `mw_cfg` — POS settings such as tax
- `mw_repairs` — repair tickets

When the Admin or lightweight POS loads, existing legacy inventory and sales are merged into `mw_platform_v1`. Admin edits are written back to the legacy keys so the rich Main POS and Admin remain synchronized on the same browser/domain.

## Repairs

Repair intake is handled by `repair.html`.

A repair can be sent to the Main POS as a `Repair` line item. When the repair line is sold, the repair ticket is reconciled to Completed/paid status when Admin or Repairs next loads.

## Inventory seed

`data/seed.json` contains the product catalog and initial platform data. Many imported catalog products intentionally start with Cost/Price/Qty of `0` until actual local POS inventory values are merged or entered.

## Backup

Use Admin → Backup / Restore → **Download Full Backup**.

The full backup contains both the unified platform data and the compatible legacy POS stores. Make a backup before clearing browser data, changing computers, or performing a major inventory change.

## Important storage limitation

Operational POS data is currently stored in the browser. It is synchronized between Main POS, Admin and Repairs only when they are opened under the same site/domain and browser profile.

Different computers, phones, browser profiles, or cleared browser storage do not automatically share live inventory/sales. True multi-device synchronization requires a server/database backend.

## Public website

The separate public Mega Wireless website is maintained in its own repository. Website Deals in this POS are not automatically pushed to that separate repository; Admin can export the deals JSON for a controlled publishing workflow.
