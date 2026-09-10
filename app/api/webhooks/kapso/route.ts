import { NextRequest, NextResponse } from 'next/server';
import { normalizeKapsoInbound, verifyKapsoSignature } from '@/lib/whatsapp/kapso';
import { recordInboundMessage, applyStatusUpdate } from '@/lib/services/conversations';
import { automateInbound } from '@/lib/services/whatsapp-automation';
import { z } from 'zod';

export async function POST(request:NextRequest) {
  if(process.env.WHATSAPP_PROVIDER!=='kapso') return new NextResponse('Provider disabled',{status:403});
  const body=await request.text();
  if(!verifyKapsoSignature(body,request.headers.get('x-webhook-signature'))) return new NextResponse('Invalid signature',{status:401});
  let payload:unknown;
  try {payload=JSON.parse(body);} catch {return new NextResponse('Invalid JSON',{status:400});}
  const event=request.headers.get('x-webhook-event');
  const phone=process.env.WHATSAPP_PHONE_NUMBER_ID;
  if(!phone) return new NextResponse('Phone not configured',{status:503});
  try {
    if(event==='whatsapp.message.received') {
      const message=normalizeKapsoInbound(payload,phone);
      if(message) {const saved=await recordInboundMessage(message);await automateInbound(saved.id);}
    } else {
      const statusEvent=z.object({phone_number_id:z.string(),message:z.object({id:z.string()})}).safeParse(payload);
      const statuses={'whatsapp.message.sent':'SENT','whatsapp.message.delivered':'DELIVERED','whatsapp.message.read':'READ','whatsapp.message.failed':'FAILED'} as const;
      if(statusEvent.success && statusEvent.data.phone_number_id===phone && event && event in statuses) await applyStatusUpdate({waMessageId:statusEvent.data.message.id,status:statuses[event as keyof typeof statuses]});
    }
    return NextResponse.json({received:true});
  } catch {return NextResponse.json({received:false},{status:503});}
}
