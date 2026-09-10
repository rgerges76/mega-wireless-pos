# Mega Wireless Klaviyo repair SMS integration

This branch adds a server-side Klaviyo event bridge for transactional Repair Desk text updates.

## Intended workflow

1. At repair intake, staff enters the customer's phone number.
2. Staff asks whether the customer wants automated text updates for this repair.
3. `Text repair status updates` is OFF by default and is checked only after explicit consent.
4. The repair is saved normally even if Klaviyo is unavailable.
5. When the repair transitions to `Ready for Pickup`, the POS emits one `Repair Ready for Pickup` event for that repair.
6. A Klaviyo metric-triggered SMS flow sends the ready-for-pickup text to the consenting customer.

The repair-status consent is not promotional consent. Profiles created through this path are marked `repair_sms_only: true` and `sms_marketing_eligible: false` so they must not be targeted by promotional SMS campaigns unless separate promotional consent is collected later.

## Klaviyo events

- `Repair Ticket Created`
- `Repair Ticket Updated`
- `Repair Status Changed`
- `Repair Ready for Pickup`

The ready event uses a fixed unique ID based on the repair ID so repeated saves of the same Ready status do not create duplicate ready events.

Event properties are limited to repair ID, device, status, total, balance, store, and notification type. IMEI/serial, diagnosis, and issue text are not sent.

## Ready-for-pickup message

Recommended transactional SMS body:

`Mega Wireless: Hi {{ first_name }}, your {{ event.device }} is ready for pickup. Reply STOP to opt out.`

Keep the flow transactional and do not add promotions, coupons, or sales language to this message.

## Required Netlify environment variable

Set only in Netlify environment variables, never in browser JavaScript or the repository:

`KLAVIYO_PRIVATE_API_KEY`

The current integration requires Events, Profiles, and Subscriptions access. The private key remains server-side.

## Consent and phone handling

- Repair SMS consent is explicit and unchecked by default.
- Consent is optional and not required for repair service.
- The notice includes message/data-rate and STOP opt-out language.
- US 10-digit phone numbers are normalized to E.164 (`+1...`).
- Without consent, the raw phone is not sent to Klaviyo; it is used server-side only to derive a one-way hashed external ID.
- With repair SMS consent, the normalized phone is sent to Klaviyo and SMS channel consent is recorded so Klaviyo can deliver the transactional repair flow.
- The profile remains explicitly marked as not eligible for promotional SMS targeting.

## Test before production merge

1. Wait for the latest `klaviyo-integration` Netlify Deploy Preview.
2. Create a test repair using a phone number you control and check `Text repair status updates`.
3. Confirm `Repair Ticket Created` appears in Klaviyo and the test phone has SMS consent.
4. Edit the same repair and change status to `Ready for Pickup` (or use Send to POS when applicable).
5. Confirm exactly one `Repair Ready for Pickup` event appears.
6. Configure the Klaviyo SMS flow to trigger on `Repair Ready for Pickup`, mark the SMS as transactional, and test delivery.
7. Only after the full test passes should PR #1 be merged to `main`.

## Security and reliability

- Private API key is server-side only.
- Operational repair data is minimized before it is sent to Klaviyo.
- Klaviyo failures do not block repair ticket saving.
- Ready events are idempotent in Klaviyo using `repairId:ready_for_pickup` as the unique event identifier.
- Current repair storage remains browser localStorage; this integration does not convert the POS into a multi-device database-backed system.
