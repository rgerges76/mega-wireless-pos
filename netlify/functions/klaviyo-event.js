const crypto = require('crypto');

const KLAVIYO_API = 'https://a.klaviyo.com/api';
const REVISION = '2026-07-15';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function normalizePhoneE164(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(-15);
}

function customerExternalId(phone) {
  const source = normalizePhoneDigits(phone);
  if (!source) return '';
  return 'mw_' + crypto.createHash('sha256').update(source).digest('hex').slice(0, 24);
}

async function klaviyo(path, method, apiKey, body) {
  const response = await fetch(`${KLAVIYO_API}${path}`, {
    method,
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: REVISION,
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Klaviyo ${response.status}: ${text.slice(0, 500)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  if (!apiKey) return json(503, { error: 'Klaviyo integration is not configured' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: 'Invalid JSON' });
  }

  const type = String(payload.type || '').trim();
  const repair = payload.repair || {};
  const allowedTypes = new Set(['repair_created', 'repair_updated', 'repair_status_changed']);
  if (!allowedTypes.has(type)) return json(400, { error: 'Unsupported event type' });

  const repairId = String(repair.id || '').trim();
  const customer = String(repair.customer || '').trim().slice(0, 120);
  const externalId = customerExternalId(repair.phone);
  const phoneNumber = normalizePhoneE164(repair.phone);
  const smsMarketingOptIn = repair.smsMarketingOptIn === true;

  if (!repairId || !customer || !externalId) {
    return json(400, { error: 'Missing required repair/customer identity fields' });
  }
  if (smsMarketingOptIn && !phoneNumber) {
    return json(400, { error: 'Valid phone number required for SMS opt-in' });
  }

  const status = String(repair.status || 'Received').slice(0, 80);
  const eventName = type === 'repair_created'
    ? 'Repair Ticket Created'
    : type === 'repair_status_changed'
      ? 'Repair Status Changed'
      : 'Repair Ticket Updated';

  const profileAttributes = {
    external_id: externalId,
    first_name: customer.split(/\s+/)[0] || customer,
    properties: {
      customer_type: 'Repair Customer',
      store: 'Mega Wireless Nashville',
      last_repair_id: repairId,
      last_repair_device: String(repair.device || '').slice(0, 120),
      last_repair_status: status,
      sms_marketing_opt_in: smsMarketingOptIn
    }
  };

  if (smsMarketingOptIn) profileAttributes.phone_number = phoneNumber;

  const eventBody = {
    data: {
      type: 'event',
      attributes: {
        unique_id: `${repairId}:${type}:${String(repair.updatedAt || repair.createdAt || Date.now())}`,
        metric: {
          data: {
            type: 'metric',
            attributes: { name: eventName }
          }
        },
        profile: {
          data: {
            type: 'profile',
            attributes: profileAttributes
          }
        },
        properties: {
          repair_id: repairId,
          device: String(repair.device || '').slice(0, 120),
          status,
          total: Number(repair.total || 0),
          balance: Number(repair.balance || 0),
          store: 'Mega Wireless Nashville'
        }
      }
    }
  };

  try {
    await klaviyo('/events', 'POST', apiKey, eventBody);

    if (smsMarketingOptIn) {
      const subscribeBody = {
        data: {
          type: 'profile-subscription-bulk-create-job',
          attributes: {
            custom_source: 'Mega Wireless Repair Desk',
            profiles: {
              data: [{
                type: 'profile',
                attributes: {
                  phone_number: phoneNumber,
                  subscriptions: {
                    sms: { marketing: { consent: 'SUBSCRIBED' } }
                  }
                }
              }]
            }
          }
        }
      };
      await klaviyo('/profile-subscription-bulk-create-jobs', 'POST', apiKey, subscribeBody);
    }

    return json(202, { ok: true });
  } catch (err) {
    console.error('Klaviyo sync failed', err);
    return json(502, { error: 'Klaviyo sync failed' });
  }
};
