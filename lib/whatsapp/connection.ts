export async function whatsappConnectionStatus(): Promise<string> {
  if (process.env.WHATSAPP_PROVIDER === 'kapso') {
    if (!process.env.KAPSO_API_KEY || !process.env.WHATSAPP_PHONE_NUMBER_ID) return 'Kapso number setup required';
    if (!process.env.KAPSO_WEBHOOK_SECRET) return 'Kapso webhook setup required';
    return process.env.WHATSAPP_AUTOMATION_ENABLED === 'true'
      ? 'Kapso configured · verify number status in Kapso'
      : 'Kapso configured · ordering paused';
  }
  const token=process.env.WHATSAPP_ACCESS_TOKEN;
  const phone=process.env.WHATSAPP_PHONE_NUMBER_ID;
  if(!token || !phone) return 'Setup required';
  try {
    const response=await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION||'v25.0'}/${encodeURIComponent(phone)}?fields=platform_type,status`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok) return 'Connection needs attention';
    const data=await response.json();
    if(data.platform_type!=='CLOUD_API') return 'Phone needs Cloud API onboarding';
    if(data.status!=='CONNECTED') return 'Phone registration incomplete';
    if(!process.env.META_APP_SECRET || !process.env.WHATSAPP_VERIFY_TOKEN) return 'Webhook setup required';
    return process.env.WHATSAPP_AUTOMATION_ENABLED==='true'?'Phone connected · ordering enabled':'Phone connected · ordering paused';
  } catch { return 'Unable to check connection'; }
}
