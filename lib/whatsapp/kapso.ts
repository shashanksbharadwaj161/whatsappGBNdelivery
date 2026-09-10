import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { NormalizedInboundMessage } from './webhook';

export function verifyKapsoSignature(body:string, signature:string|null, secret=process.env.KAPSO_WEBHOOK_SECRET) {
  if(!secret || !signature) return false;
  const expected=Buffer.from(createHmac('sha256',secret).update(body).digest('hex'));
  const actual=Buffer.from(signature);
  return expected.length===actual.length && timingSafeEqual(expected,actual);
}
const eventSchema=z.object({
  phone_number_id:z.string(),
  message:z.object({id:z.string().min(1),timestamp:z.string(),from:z.string().optional(),type:z.string(),
    text:z.object({body:z.string()}).optional(),
    location:z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),name:z.string().optional(),address:z.string().optional()}).optional(),
    kapso:z.object({direction:z.string(),origin:z.string().optional()}).optional(),
  }),
  conversation:z.object({phone_number:z.string().optional(),contact_name:z.string().nullable().optional()}).optional(),
});
export function normalizeKapsoInbound(payload:unknown, phoneId:string):NormalizedInboundMessage|null {
  const parsed=eventSchema.safeParse(payload);
  if(!parsed.success) return null;
  const {message,conversation,phone_number_id}=parsed.data;
  if(phone_number_id!==phoneId || message.kapso?.direction!=='inbound' || message.kapso.origin==='history_sync') return null;
  const waId=(message.from??conversation?.phone_number??'').replace(/^\+/,'');
  if(!/^\d{7,15}$/.test(waId)) return null;
  const timestamp=new Date(Number(message.timestamp)*1000);
  if(!Number.isFinite(timestamp.getTime())) return null;
  const base={waId,displayName:conversation?.contact_name??null,waMessageId:message.id,timestamp};
  if(message.type==='text' && message.text) return {...base,type:'TEXT',textBody:message.text.body};
  if(message.type==='location' && message.location) return {...base,type:'LOCATION',locationLatitude:message.location.latitude,locationLongitude:message.location.longitude,locationName:message.location.name??message.location.address};
  return {...base,type:'UNKNOWN'};
}
