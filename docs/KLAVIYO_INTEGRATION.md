# Mega Wireless Klaviyo integration

This branch adds a server-side Klaviyo event bridge for the Repair Desk.

## What it does

- Adds optional customer email capture to Repair Desk.
- Adds an explicit email-marketing opt-in checkbox. It is OFF by default.
- Sends repair lifecycle events to Klaviyo through a Netlify Function.
- Creates/updates Klaviyo customer profiles using a hashed external customer ID.
- Does not send IMEI, serial number, diagnosis, or repair issue text to Klaviyo.
- Does not block repair ticket saving if Klaviyo is unavailable.
- Subscribes an email address to marketing only when the customer explicitly opts in.

## Klaviyo events

- `Repair Ticket Created`
- `Repair Ticket Updated`
- `Repair Status Changed` (server endpoint supported for future UI wiring)

Event properties are limited to repair ID, device, status, total, balance, and store.

## Required Netlify environment variable

Set this only in Netlify environment variables, never in browser JavaScript or the repository:

`KLAVIYO_PRIVATE_API_KEY`

The key should use least-privilege Klaviyo scopes sufficient for Events, Profiles, and Subscriptions.

If the variable is missing, the endpoint returns 503 and the Repair Desk continues working normally.

## Security and privacy

- Private API key is server-side only.
- Marketing consent is explicit and unchecked by default.
- Operational repair data is minimized before it is sent to Klaviyo.
- Customer phone is used server-side only to derive a one-way hashed external ID; the raw phone number is not sent to Klaviyo by this integration.
- Klaviyo sync failures are non-blocking and logged in the browser console / Netlify function logs.
