"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getCurrentLocation } from "@/lib/maps/current-location";
export function PlanFromLocation({routeId}:{routeId?:string}) {
  const router=useRouter(); const[pending,setPending]=useState(false); const[error,setError]=useState<string>();
  async function plan(){
    setPending(true);setError(undefined);
    try {
      const location=await getCurrentLocation();
      const response=await fetch(routeId?`/api/routes/${routeId}/reoptimize`:'/api/driver/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(routeId?{currentLocation:location}:location)});
      const data=await response.json(); if(!response.ok)throw new Error(data.error?.message??'Could not plan route');
      router.replace(`/driver/${data.id}`);router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Could not plan route');}finally{setPending(false);}
  }
  return <div className="space-y-2"><Button variant="outline" className="w-full" disabled={pending} onClick={plan}><LocateFixed size={18}/>{pending?'Finding location and planning…':routeId?'Reorder remaining stops from my location':'Plan today’s deliveries from my location'}</Button>{error&&<p role="alert" className="text-sm text-status-cancelled">{error}</p>}<p className="text-xs text-ink-muted">Uses road distances to reduce travel. Completed deliveries stay unchanged.</p></div>;
}
