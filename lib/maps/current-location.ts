export function getCurrentLocation(): Promise<{lat:number;lng:number}> {
  return new Promise((resolve,reject) => {
    if (!navigator.geolocation) { reject(new Error("Location is unavailable in this browser. Choose your starting point on the map.")); return; }
    navigator.geolocation.getCurrentPosition(p => resolve({lat:p.coords.latitude,lng:p.coords.longitude}), error => reject(new Error(error.code === 1 ? "Allow location access in your browser to plan from your current position." : "Could not locate you. Try again outdoors, or choose a starting point on the map.")), {enableHighAccuracy:true,timeout:15000,maximumAge:30000});
  });
}
