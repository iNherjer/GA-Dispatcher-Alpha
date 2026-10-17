'use strict';

// Reception staff are scene actors, never additional manifest passengers.
function planPickupReception(scene, vehicle, speedKts = 3.3) {
  if (!scene || !vehicle?.objectId) return [];
  return (scene.objects || []).filter(person => person?.objectId
    && person.departWithPickupVehicle === true && /^arrival_person_/.test(person.kind || ''))
    .map(person => {
      const target = { lat: Number(vehicle.lat), lon: Number(vehicle.lon), altFt: Number(vehicle.altFt) };
      const valid = [person.lat, person.lon, target.lat, target.lon, target.altFt].every(v => v != null && Number.isFinite(Number(v)));
      if (!valid) return null;
      const northM = (target.lat - Number(person.lat)) * 111320;
      const eastM = (target.lon - Number(person.lon)) * 111320 * Math.cos(target.lat * Math.PI / 180);
      return { person, target,
        walkMs: Math.ceil(Math.hypot(northM, eastM) / Math.max(0.5, speedKts * 0.514444) * 1000 + 1200) };
    }).filter(Boolean);
}

module.exports = { planPickupReception };
