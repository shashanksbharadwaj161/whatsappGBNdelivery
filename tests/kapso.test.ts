import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { normalizeKapsoInbound, verifyKapsoSignature } from '../lib/whatsapp/kapso';

const payload = {
  phone_number_id: 'test-phone',
  message: { id: 'wamid.test', timestamp: '1789000000', from: '919876543210', type: 'text',
    text: { body: 'ORDER' }, kapso: { direction: 'inbound', origin: 'business_app' } },
  conversation: { contact_name: 'Test Customer' },
};

test('Kapso signature authenticates the exact raw body and rejects tampering', () => {
  const body = JSON.stringify(payload);
  const secret = 'test-only-secret';
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyKapsoSignature(body, signature, secret), true);
  assert.equal(verifyKapsoSignature(body + ' ', signature, secret), false);
  assert.equal(verifyKapsoSignature(body, null, secret), false);
  assert.equal(verifyKapsoSignature(body, 'bad', secret), false);
});

test('Kapso converts new messages and customer pins for existing order intake', () => {
  assert.equal(normalizeKapsoInbound(payload, 'test-phone')?.textBody, 'ORDER');
  const location = normalizeKapsoInbound({ ...payload, message: { ...payload.message,
    type: 'location', location: { latitude: 12.97, longitude: 77.59, name: 'Entrance' } } }, 'test-phone');
  assert.equal(location?.type, 'LOCATION');
  assert.equal(location?.locationLatitude, 12.97);
  assert.equal(location?.locationName, 'Entrance');
});

test('Kapso ignores foreign numbers, historical imports and outgoing echoes', () => {
  assert.equal(normalizeKapsoInbound(payload, 'another-phone'), null);
  for (const kapso of [{ direction: 'outbound', origin: 'business_app' }, { direction: 'inbound', origin: 'history_sync' }]) {
    assert.equal(normalizeKapsoInbound({ ...payload, message: { ...payload.message, kapso } }, 'test-phone'), null);
  }
  assert.equal(normalizeKapsoInbound({ ...payload, message: { ...payload.message, type: 'location', location: { latitude: 200, longitude: 77 } } }, 'test-phone'), null);
});
