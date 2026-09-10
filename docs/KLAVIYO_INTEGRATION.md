# Mega Wireless Klaviyo integration

This branch adds a server-side Klaviyo event bridge for the Repair Desk with SMS-first marketing consent.

## What it does

- Uses the repair customer's phone number as the SMS marketing contact channel.
- Hides the email capture field from the Repair Desk integration UI.
- Adds an explicit SMS-marketing opt-in checkbox. It is OFF by default.
- Sends repair lifecycle events to Klaviyo through a Netlify Function.
- Creates/updates Klaviyo customer profiles using a hashed external customer ID.
- Does not send IMEI, serial number, diagnosis, or repair issue text to Klaviyo.
- Does not block repair ticket saving if Klaviyo is unavailable.
- Sends the raw phone number to Klaviyo only when the customer explicitly opts in to SMS marketing.
- Subscribes the phone number to SMS marketing only when the customer explicitly opts in.

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

## SMS consent behavior

- Consent is explicit and unchecked by default.
- The checkbox states that the customer agrees to occasional Mega Wireless promotional text messages.
- Consent is optional and not required for repair service.
- The notice includes message/data-rate language and STOP opt-out language.
- US 10-digit phone numbers are normalized to E.164 format (`+1...`) before subscription.
- If SMS consent is checked but the phone cannot be normalized to a valid supported format, the Klaviyo sync is skipped with an error while the repair ticket itself still saves locally.

## Security and privacy

- Private API key is server-side only.
- Operational repair data is minimized before it is sent to Klaviyo.
- Without SMS marketing consent, the phone is used server-side only to derive a one-way hashed external ID; the raw phone number is not sent to Klaviyo by this integration.
- With explicit SMS marketing consent, the normalized phone number is sent to Klaviyo so the profile can be subscribed to SMS marketing.
- Klaviyo sync failures are non-blocking and logged in the browser console / Netlify function logs.
