import { z } from 'zod';
import { computeOrderPricing } from '@/lib/pricing';

export const intakeSchema = z.object({
  step: z.enum(['name','size','quantity','date','address','location','email','confirm','human']).default('name'),
  name: z.string().optional(), milkSize: z.enum(['ML500','L1']).optional(), quantity: z.number().int().positive().optional(),
  date: z.string().optional(), address: z.string().optional(), lat: z.number().optional(), lng: z.number().optional(), email: z.string().nullable().optional(),
});
export type Intake = z.infer<typeof intakeSchema>;
export function advanceIntake(state: Intake | null, text: string, location: {lat:number;lng:number}|null, today: string): {state:Intake;reply:string;confirm?:boolean} {
  const value = text.trim();
  if (/^(stop|agent|human)$/i.test(value)) return {state:{step:'human'},reply:'Our team will assist you here. Send ORDER whenever you want to use automated ordering again.'};
  if (/^(order|start|restart)$/i.test(value) || !state) return {state:{step:'name'},reply:'Welcome to Gau Bhoomi Naturals! I can help order A2 milk for morning delivery. What is your name? Send AGENT for our team.'};
  const next = {...state};
  switch (state.step) {
    case 'human': return {state,reply:''};
    case 'name':
      if (value.length < 2 || value.length > 100) return {state,reply:'Please send your name (2–100 characters).'};
      next.name=value; next.step='size'; return {state:next,reply:'Choose A2 milk pack size: 500ml (₹65) or 1L (₹120). Delivery is ₹5 per order.'};
    case 'size':
      if (/^(500\s?ml|500)$/i.test(value)) next.milkSize='ML500';
      else if (/^(1\s?l|1\s?lit(er|re)|1000\s?ml)$/i.test(value)) next.milkSize='L1';
      else return {state,reply:'Please reply 500ml or 1L.'};
      next.step='quantity'; return {state:next,reply:'How many packs? Send a whole number from 1 to 50.'};
    case 'quantity':
      if (!/^\d+$/.test(value) || Number(value)<1 || Number(value)>50) return {state,reply:'Please send a quantity from 1 to 50.'};
      next.quantity=Number(value); next.step='date'; return {state:next,reply:'Which delivery date? Send YYYY-MM-DD. This order is for morning delivery.'};
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value || value<=today) return {state,reply:'Please send a valid future date as YYYY-MM-DD. For same-day requests, send AGENT.'};
      next.date=value; next.step='address'; return {state:next,reply:'Send the full delivery address, including house/flat, street, area and pincode.'};
    case 'address':
      if(value.length<15 || value.length>1000) return {state,reply:'Please send your full address, including house/flat, street and pincode.'};
      next.address=value; next.step='location'; return {state:next,reply:'Please attach the delivery location using WhatsApp → Attach (+) → Location. You can also send a Google Maps pin link. Place the pin at your building; a pincode alone is not precise enough for the driver.'};
    case 'location':
      if(!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat)>90 || Math.abs(location.lng)>180) return {state,reply:'Please attach a WhatsApp location pin or a Google Maps pin link for the delivery address, or send AGENT for help.'};
      next.lat=location.lat; next.lng=location.lng; next.step='email'; return {state:next,reply:'What is your email address? Send SKIP if you prefer not to provide one.'};
    case 'email':
      if(!/^skip$/i.test(value) && !z.email().safeParse(value).success) return {state,reply:'Please send a valid email address or SKIP.'};
      next.email=/^skip$/i.test(value)?null:value; next.step='confirm';
      return {state:next,reply:`Review your order:\n${next.name}\nA2 milk: ${next.quantity} × ${next.milkSize==='L1'?'1L':'500ml'}\nDate: ${next.date}, morning\n${next.address}\nTotal: ₹${computeOrderPricing({milkSize:next.milkSize!,quantity:next.quantity!}).total} including delivery.\nReply CONFIRM to place this order, RESTART to change it, or AGENT for help.`};
    case 'confirm': return /^confirm$/i.test(value)?{state:next,reply:'',confirm:true}:{state,reply:'Reply CONFIRM to place the reviewed order, RESTART to change it, or AGENT for help.'};
  }
}
