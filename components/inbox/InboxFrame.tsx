'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
export function InboxFrame({list,children}:{list:React.ReactNode;children:React.ReactNode}) {
 const pathname=usePathname(); const router=useRouter(); const selected=pathname!='/inbox';
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible') router.refresh();}; const timer=setInterval(refresh,15000); window.addEventListener('focus',refresh); return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[router]);
 return <div className="flex h-[calc(100dvh-10rem)] min-h-96 overflow-hidden rounded-xl border border-border bg-surface"><div className={`${selected?'hidden md:block':'block'} w-full shrink-0 md:w-80`}>{list}</div><div className={`${selected?'flex':'hidden md:flex'} min-w-0 flex-1 flex-col overflow-hidden`}>{children}</div></div>;
}
