import { resolveGoogleMapsUrl } from '@/lib/maps/resolveShareUrl';
import { geocodeAddress } from '@/lib/maps/geocode';
import { addToAutomaticRound } from '@/lib/services/automatic-routes';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { advanceIntake, intakeSchema } from '@/lib/whatsapp/intake';
import { todayBusinessDateString, businessDateOnlyToDate } from '@/lib/tz';
import { computeOrderPricing } from '@/lib/pricing';
import { sendSessionTextMessage } from '@/lib/whatsapp/client';

/** State and order creation commit atomically, once per inbound message. */
export async function automateInbound(messageId: string) {
  if (process.env.WHATSAPP_AUTOMATION_ENABLED !== 'true') return;
  const incoming = await db.whatsappMessage.findUniqueOrThrow({where:{id:messageId},include:{conversation:true}});
  let linkedLocation: {lat:number;lng:number}|null = null;
  const incomingState = intakeSchema.safeParse(incoming.conversation.intakeState);
  let addressPin: {lat:number;lng:number;label:string}|null = null;
  const addressText = incoming.textBody?.trim() ?? '';
  if (!incoming.automationProcessedAt && incomingState.success && incomingState.data.step === 'address' && addressText.length >= 15 && addressText.length <= 1000) {
    const resolved = await geocodeAddress(addressText);
    if (resolved.ok && Number.isFinite(resolved.data.latitude) && Number.isFinite(resolved.data.longitude) && Math.abs(resolved.data.latitude) <= 90 && Math.abs(resolved.data.longitude) <= 180) {
      addressPin = {lat: resolved.data.latitude, lng: resolved.data.longitude, label: resolved.data.formattedAddress};
    }
  }
  if(!incoming.automationProcessedAt && incomingState.success && incomingState.data.step==='location' && /^https:\/\//i.test(incoming.textBody?.trim()??'')) {
    const resolved=await resolveGoogleMapsUrl(incoming.textBody!.trim());
    if(resolved.ok) linkedLocation={lat:resolved.data.latitude,lng:resolved.data.longitude};
  }
  const reply = await db.$transaction(async tx => {
    const initial = await tx.whatsappMessage.findUniqueOrThrow({where:{id:messageId}});
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.conversationId}))`;
    const message = await tx.whatsappMessage.findUniqueOrThrow({where:{id:messageId},include:{conversation:true}});
    if(message.automationProcessedAt) return null;
    // Old retries must never reopen the customer-service window.
    if(Date.now()-message.createdAt.getTime()>23*60*60*1000) {
      await tx.whatsappMessage.update({where:{id:messageId},data:{automationProcessedAt:new Date()}}); return null;
    }
    const previous=intakeSchema.safeParse(message.conversation.intakeState);
    const result=advanceIntake(previous.success?previous.data:null,message.textBody??'',message.locationLatitude!=null&&message.locationLongitude!=null?{lat:message.locationLatitude,lng:message.locationLongitude}:linkedLocation,todayBusinessDateString());
    let replyText=result.reply;
    // A geocoder result is a suggestion, not proof of the customer's entrance.
    // The customer confirms or replaces it; the driver never types addresses.
    if (previous.success && previous.data.step === 'address' && result.state.step === 'location' && addressPin) {
      result.state.lat = addressPin.lat;
      result.state.lng = addressPin.lng;
      replyText = `I found this possible delivery location: ${addressPin.label}\nhttps://www.google.com/maps?q=${addressPin.lat},${addressPin.lng}\nOpen the map and check your building. Reply USE PIN if correct, or attach your exact WhatsApp location / Google Maps pin link. The driver will use this pin.`;
    }
    if(result.confirm) {
      const state=result.state;
      if(!state.name||!state.milkSize||!state.quantity||!state.date||!state.address||state.lat==null||state.lng==null) throw new Error('Incomplete order intake');
      if(state.date<=todayBusinessDateString()) {result.state.step='date';replyText='The selected date has passed. Please send a future delivery date as YYYY-MM-DD.';}
      else {
        const customer=await tx.customer.upsert({where:{phone:`+${message.conversation.waId}`},create:{name:state.name,phone:`+${message.conversation.waId}`,email:state.email},update:{name:state.name,...(state.email?{email:state.email}:{})}});
        const address=await tx.address.create({data:{customerId:customer.id,formattedAddress:state.address,latitude:state.lat,longitude:state.lng,source:'WHATSAPP_LOCATION'}});
        const order=await tx.order.create({data:{customerId:customer.id,addressId:address.id,conversationId:message.conversationId,milkSize:state.milkSize,quantity:state.quantity,deliveryDate:businessDateOnlyToDate(state.date),deliveryWindow:'MORNING',orderType:'ONE_TIME',source:'WHATSAPP',status:'CONFIRMED',...computeOrderPricing({milkSize:state.milkSize,quantity:state.quantity})}});
        await addToAutomaticRound(tx, order.id);
        await tx.customer.update({where:{id:customer.id},data:{defaultAddressId:address.id}});
        await tx.whatsappConversation.update({where:{id:message.conversationId},data:{customerId:customer.id}});
        await tx.auditLog.create({data:{action:'ORDER_CREATED',entityType:'Order',entityId:order.id,actorType:'system',metadata:{source:'WHATSAPP'}}});
        replyText=`Order GBN-${String(order.sequenceNumber).padStart(6,'0')} is placed for ${state.date}, morning. Total ₹${order.total}. Payment is pending. Send ORDER to place another order or AGENT for help.`;
        result.state={step:'human'};
      }
    }
    await tx.whatsappConversation.update({where:{id:message.conversationId},data:{intakeState:result.state as Prisma.InputJsonValue}});
    await tx.whatsappMessage.update({where:{id:messageId},data:{automationProcessedAt:new Date()}});
    if(!replyText) return null;
    return tx.whatsappMessage.create({data:{conversationId:message.conversationId,direction:'OUTBOUND',type:'TEXT',textBody:replyText,status:'PENDING',automationReplyTo:messageId},include:{conversation:true}});
  },{timeout:15000});
  if(!reply) return;
  // A send timeout has an uncertain delivery outcome: keep it visible for the
  // owner rather than retrying blindly and potentially sending twice.
  const sent=await sendSessionTextMessage(reply.conversation.waId,reply.textBody!);
  await db.whatsappMessage.update({where:{id:reply.id},data:sent.ok?{status:'SENT',waMessageId:sent.waMessageId}:{status:'FAILED',errorDetail:sent.error}});
}
