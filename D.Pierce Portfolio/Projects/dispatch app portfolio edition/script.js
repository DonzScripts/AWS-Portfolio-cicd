// Dispatch Oracle — brokers, pins, and full details
let map, routeLayer, previewLayer;
let markers = [];
let fuelMarkers = [];
let loadsData = [];

// Dedicated markers for current locations and load pins
let markerFromLoc = null;
let markerPickupLoc = null;
let markerLoadPickup = null;
let markerLoadDelivery = null;

const fromInput = document.getElementById('fromInput');
const toInput = document.getElementById('toInput');
const fromUseLoc = document.getElementById('fromUseLoc');
const pickupInput = document.getElementById('pickupInput');
const pickupUseLoc = document.getElementById('pickupUseLoc');
const equipFilter = document.getElementById('equipFilter');
const radiusSel = document.getElementById('radiusMiles');

const routeMeta = document.getElementById('routeMeta');
const loadList = document.getElementById('loadList');
const loadCount = document.getElementById('loadCount');

const OSRM = 'https://router.project-osrm.org';

function initMap(){
  map = L.map('map').setView([35.2271,-80.8431], 6); // Charlotte
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}
document.addEventListener('DOMContentLoaded', initMap);

// Geocoding helpers
async function geocode(q){
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {headers:{'Accept-Language':'en'}});
  const data = await res.json();
  if(!data.length) return null;
  const d = data[0];
  const a = d.address || {};
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || '';
  const state = a.state || a.region || '';
  return { lat: +d.lat, lon: +d.lon, city, state, label: `${city && state ? city+', '+state : d.display_name.split(',').slice(0,2).join(', ')}` };
}

async function reverseGeocode(lat, lon){
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
  const r = await fetch(url, {headers:{'Accept-Language':'en'}});
  const d = await r.json();
  const a = d.address || {};
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || '';
  const state = a.state || a.region || '';
  return { city, state, label: `${city}${state ? ', '+state : ''}` };
}

// OSRM routing
async function osrmRoute(a, b){
  const url = `${OSRM}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if(!data || !data.routes || !data.routes.length) throw new Error('No route');
  return data.routes[0];
}

function clearMapLayers(){
  if(routeLayer){ map.removeLayer(routeLayer); routeLayer = null; }
  if(previewLayer){ map.removeLayer(previewLayer); previewLayer = null; }
  if(markerLoadPickup){ map.removeLayer(markerLoadPickup); markerLoadPickup=null; }
  if(markerLoadDelivery){ map.removeLayer(markerLoadDelivery); markerLoadDelivery=null; }
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

// Geolocation and markers
function locateAndFill(inputEl, type){
  if(!navigator.geolocation){
    alert('Geolocation not available in this browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const {latitude:lat, longitude:lon} = pos.coords;
    const info = await reverseGeocode(lat, lon);
    inputEl.value = info.label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    inputEl.dataset.lat = lat;
    inputEl.dataset.lon = lon;
    // Show a pinpoint for location
    const opts = {radius: 6, color:'#fff', weight:2, fillColor:'#2b9fef', fillOpacity:0.9};
    const cm = L.circleMarker([lat, lon], opts).bindPopup(`${info.label}`);
    if(type === 'from'){
      if(markerFromLoc) map.removeLayer(markerFromLoc);
      markerFromLoc = cm.addTo(map);
    }else if(type === 'pickup'){
      if(markerPickupLoc) map.removeLayer(markerPickupLoc);
      markerPickupLoc = cm.addTo(map);
    }
  }, (err)=>{
    alert('Location error: '+err.message);
  }, {enableHighAccuracy:true, timeout:10000});
}

fromUseLoc.addEventListener('change', (e)=>{
  if(e.target.checked){ locateAndFill(fromInput, 'from'); }
});
pickupUseLoc.addEventListener('change', (e)=>{
  if(e.target.checked){ locateAndFill(pickupInput, 'pickup'); }
});

// Build Route
document.getElementById('routeBtn').addEventListener('click', async ()=>{
  try{
    // don't remove current location markers when building a route
    if(routeLayer){ map.removeLayer(routeLayer); routeLayer = null; }
    if(previewLayer){ map.removeLayer(previewLayer); previewLayer = null; }
    if(markerLoadPickup){ map.removeLayer(markerLoadPickup); markerLoadPickup=null; }
    if(markerLoadDelivery){ map.removeLayer(markerLoadDelivery); markerLoadDelivery=null; }
    markers.forEach(m => map.removeLayer(m)); markers = [];

    const a = await (async ()=>{
      if(fromInput.dataset.lat && fromInput.dataset.lon){
        const city = (fromInput.value||'').split(',')[0];
        const state = (fromInput.value||'').split(',')[1]||'';
        return {lat:+fromInput.dataset.lat, lon:+fromInput.dataset.lon, city, state};
      }
      const g = await geocode(fromInput.value);
      return g;
    })();
    const b = await geocode(toInput.value);
    if(!a || !b){ routeMeta.textContent = 'Enter valid From and To.'; return; }

    markers.push(L.marker([a.lat, a.lon]).addTo(map).bindPopup(`${a.city}, ${a.state}`));
    markers.push(L.marker([b.lat, b.lon]).addTo(map).bindPopup(`${b.city}, ${b.state}`));

    const r = await osrmRoute(a,b);
    routeLayer = L.geoJSON(r.geometry, {style:{color:'#2b9fef', weight:5}}).addTo(map);
    map.fitBounds(routeLayer.getBounds(), {padding:[40,40]});

    const miles = r.distance/1609.344;
    const mins = Math.round(r.duration/60);
    routeMeta.textContent = `Distance: ${miles.toFixed(0)} mi • ETA: ${Math.floor(mins/60)}h ${mins%60}m`;
  }catch(e){
    routeMeta.textContent = 'Routing failed. Try different points.';
    console.error(e);
  }
});

// Load generation
const CITIES = [
  {city:'Atlanta', state:'GA', lat:33.749, lon:-84.388},
  {city:'Charlotte', state:'NC', lat:35.2271, lon:-80.8431},
  {city:'Savannah', state:'GA', lat:32.0809, lon:-81.0912},
  {city:'Raleigh', state:'NC', lat:35.7796, lon:-78.6382},
  {city:'Columbia', state:'SC', lat:34.0007, lon:-81.0348},
  {city:'Jacksonville', state:'FL', lat:30.3322, lon:-81.6557},
  {city:'Richmond', state:'VA', lat:37.5407, lon:-77.4360},
  {city:'Nashville', state:'TN', lat:36.1627, lon:-86.7816},
  {city:'Birmingham', state:'AL', lat:33.5186, lon:-86.8104},
  {city:'Miami', state:'FL', lat:25.7617, lon:-80.1918},
  {city:'Dallas', state:'TX', lat:32.7767, lon:-96.7970},
  {city:'Chicago', state:'IL', lat:41.8781, lon:-87.6298},
  {city:'New York', state:'NY', lat:40.7128, lon:-74.0060},
  {city:'Memphis', state:'TN', lat:35.1495, lon:-90.0490},
  {city:'Greensboro', state:'NC', lat:36.0726, lon:-79.7920}
];

const EQUIP_MULT = { "Dry Van": 1.00, "Reefer": 1.15, "Flatbed": 1.10 };
const BROKERS = [
  {name:"Apex Logistics Group", mc:"MC 784512", phone:"(312) 555‑0142", email:"apex@demo-broker.com"},
  {name:"BlueLine Freight Brokerage", mc:"MC 671203", phone:"(470) 555‑0190", email:"blueline@demo-broker.com"},
  {name:"Summit Carrier Services", mc:"MC 558901", phone:"(615) 555‑0113", email:"summit@demo-broker.com"},
  {name:"Pioneer Load Exchange", mc:"MC 902144", phone:"(980) 555‑0177", email:"pioneer@demo-broker.com"}
];
const COMMODITIES = {
  "Dry Van": ["Paper goods","Consumer packaged goods","Electronics","Retail freight"],
  "Reefer": ["Frozen food","Produce","Dairy","Meat"],
  "Flatbed": ["Lumber","Steel coils","Construction materials","Machinery"]
};

function laneRPM(miles){
  if(miles < 250) return randRange(2.25, 5.0);
  if(miles < 800) return randRange(1.50, 3.5);
  return randRange(1.00, 2.5);
}
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function randRange(a,b){ return a + Math.random()*(b-a); }
function randInt(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
function pickDestinations(origin, count=6){
  const shuffled = [...CITIES].sort(()=>Math.random()-0.5);
  return shuffled.filter(c => !(c.city===origin.city && c.state===origin.state)).slice(0, count);
}
function addDays(date, days){
  const d = new Date(date.getTime()); d.setDate(d.getDate()+days); return d;
}
function fmtDate(d){
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

// Generate loads
async function generateLoads(){
  loadList.innerHTML = '';
  loadCount.textContent = '0 results';
  loadsData = [];

  let origin;
  if(pickupInput.dataset.lat && pickupInput.dataset.lon){
    origin = { lat:+pickupInput.dataset.lat, lon:+pickupInput.dataset.lon };
    const rev = await reverseGeocode(origin.lat, origin.lon);
    origin.city = rev.city||'Origin'; origin.state = rev.state||'';
  }else{
    const g = await geocode(pickupInput.value || 'Charlotte, NC');
    if(!g){ alert('Enter a pickup city or use location.'); return; }
    origin = g;
  }

  const selectedEquip = Array.from(equipFilter.options).filter(o => o.selected).map(o => o.value);
  if(!selectedEquip.length){ alert('Select at least one equipment type.'); return; }

  const dests = pickDestinations(origin, 6);
  for(const dest of dests){
    try{
      const r = await osrmRoute(origin, dest);
      const miles = r.distance/1609.344;
      const rpmBase = laneRPM(miles);

      for(const eq of selectedEquip){
        const rpm = clamp(rpmBase * (EQUIP_MULT[eq]||1), 0.5, 5.0);
        const pay = Math.round(rpm * miles);
        const weight = eq === 'Reefer' ? randInt(28000, 44000) : eq === 'Flatbed' ? randInt(30000, 48000) : randInt(20000, 45000);
        const broker = BROKERS[Math.floor(Math.random()*BROKERS.length)];
        const commodity = COMMODITIES[eq][Math.floor(Math.random()*COMMODITIES[eq].length)];
        const daysTransit = Math.max(1, Math.round(miles/500));
        const now = new Date();
        const puDate = fmtDate(addDays(now, 0));
        const delDate = fmtDate(addDays(now, daysTransit));
        const loadId = `DO-${randInt(100000,999999)}`;
        const ageMin = randInt(5, 180);

        loadsData.push({
          id: loadId,
          postedMins: ageMin,
          equipment: eq,
          pickup:{city:origin.city, state:origin.state, lat:origin.lat, lon:origin.lon},
          delivery: dest,
          miles: Math.round(miles),
          rpm: +rpm.toFixed(2),
          pay,
          weight,
          commodity,
          broker,
          puDate,
          delDate,
          puWindow: "08:00–14:00",
          delWindow: "08:00–16:00",
          detention: "$40/hr after 2 hrs",
          layover: "$250/day",
          notes: "Driver must call on arrival/departure; 2 straps or load locks as needed.",
          routeGeo: r.geometry
        });
      }
    }catch(e){ console.warn('Route fail for', dest, e); }
  }

  // Render board cards with more info
  loadsData.forEach((L, idx)=>{
    const el = document.createElement('div');
    el.className = 'card-row';
    el.innerHTML = `
      <div>
        <div><strong>${L.pickup.city}, ${L.pickup.state}</strong> → <strong>${L.delivery.city}, ${L.delivery.state}</strong></div>
        <div class="badges">
          <span class="badge primary">${L.equipment}</span>
          <span class="badge">Miles: ${L.miles}</span>
          <span class="badge">Rate: $${L.rpm}/mi</span>
          <span class="badge">Weight: ${L.weight.toLocaleString()} lb</span>
          <span class="badge">Aged: ${L.postedMins} min</span>
          <span class="badge">Broker: ${L.broker.name}</span>
        </div>
      </div>
      <div class="price">$${L.pay.toLocaleString()}</div>
    `;
    el.addEventListener('click', ()=> openLoad(idx));
    loadList.appendChild(el);
  });
  loadCount.textContent = `${loadsData.length} results`;
}

document.getElementById('findLoadsBtn').addEventListener('click', generateLoads);

// ---- Fuel stops via Overpass (OpenStreetMap) ----
function clearFuelStops(){
  fuelMarkers.forEach(m=> map.removeLayer(m));
  fuelMarkers = [];
}

async function fetchFuelStopsInBBox(bbox){
  // bbox: Leaflet LatLngBounds -> south,west,north,east
  const s = bbox.getSouth();
  const w = bbox.getWest();
  const n = bbox.getNorth();
  const e = bbox.getEast();
  const query = `[out:json][timeout:25];
(
  node["amenity"="fuel"](${s},${w},${n},${e});
  way["amenity"="fuel"](${s},${w},${n},${e});
  relation["amenity"="fuel"](${s},${w},${n},${e});
);
out center;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method:'POST',
    body: query
  });
  const data = await res.json();
  return (data.elements||[]).map(el => {
    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    const name = (el.tags && (el.tags.name || el.tags.brand)) || 'Fuel Station';
    return {lat, lon, name, brand: el.tags && el.tags.brand, addr: el.tags && (el.tags['addr:street']||'')};
  }).filter(x => x.lat && x.lon);
}

async function showFuelStopsForCurrentRoute(){
  clearFuelStops();
  // Prefer previewLayer (selected load). Fallback to full routeLayer.
  let layer = previewLayer || routeLayer;
  if(!layer){
    const t = document.getElementById('toast');
    t.textContent = 'No route selected. Build a route or open a load first.';
    t.hidden = false; setTimeout(()=>{t.hidden=true;}, 2200);
    return;
  }
  const bbox = layer.getBounds();
  const stops = await fetchFuelStopsInBBox(bbox);
  stops.slice(0,150).forEach(s => {
    const m = L.circleMarker([s.lat, s.lon], {radius:6, weight:2, color:'#fff', fillColor:'#68e06e', fillOpacity:0.95})
      .bindPopup(`<strong>${s.name}</strong><br>${s.addr || ''}`);
    fuelMarkers.push(m.addTo(map));
  });
  if(stops.length){
    const t = document.getElementById('toast');
    t.textContent = `Fuel stops shown: ${stops.length}`;
    t.hidden = false; setTimeout(()=>{t.hidden=true;}, 2200);
  }
}


// Open load: show drawer, route preview, and pins at pickup & delivery
function openLoad(i){
  const Ld = loadsData[i];
  const drawer = document.getElementById('drawer');
  const content = document.getElementById('drawerContent');
  document.getElementById('drawerTitle').textContent = `${Ld.equipment} — ${Ld.pickup.city}, ${Ld.pickup.state} → ${Ld.delivery.city}, ${Ld.delivery.state}`;

  content.innerHTML = `
    <table class="table">
      <tr><th>Load #</th><td>${Ld.id}</td></tr>
      <tr><th>Broker</th><td>${Ld.broker.name} • ${Ld.broker.mc}<br>${Ld.broker.phone} • ${Ld.broker.email}</td></tr>
      <tr><th>Pickup</th><td>${Ld.pickup.city}, ${Ld.pickup.state} &nbsp;•&nbsp; ${Ld.puDate} (${Ld.puWindow})</td></tr>
      <tr><th>Delivery</th><td>${Ld.delivery.city}, ${Ld.delivery.state} &nbsp;•&nbsp; ${Ld.delDate} (${Ld.delWindow})</td></tr>
      <tr><th>Commodity</th><td>${Ld.commodity}</td></tr>
      <tr><th>Equipment</th><td>${Ld.equipment}</td></tr>
      <tr><th>Weight</th><td>${Ld.weight.toLocaleString()} lb</td></tr>
      <tr><th>Miles</th><td>${Ld.miles}</td></tr>
      <tr><th>Rate</th><td>$${Ld.rpm}/mi</td></tr>
      <tr><th>Total</th><td class="price">$${Ld.pay.toLocaleString()}</td></tr>
      <tr><th>Accessorials</th><td>Detention: ${Ld.detention} • Layover: ${Ld.layover}</td></tr>
      <tr><th>Notes</th><td>${Ld.notes}</td></tr>
      <tr><th>Posted</th><td>${Ld.postedMins} min ago</td></tr>
    </table>
    <p class="muted">Map updated with this lane's route and pins.</p>
  `;

  drawer.classList.add('open');

  // Clear previous preview and load pins
  if(previewLayer){ map.removeLayer(previewLayer); previewLayer=null; }
  if(markerLoadPickup){ map.removeLayer(markerLoadPickup); markerLoadPickup=null; }
  if(markerLoadDelivery){ map.removeLayer(markerLoadDelivery); markerLoadDelivery=null; }

  // Add preview route
  previewLayer = L.geoJSON(Ld.routeGeo, {style:{color:'#68e06e', weight:4, dashArray:'6,6'}}).addTo(map);

  // Add pickup/delivery pinpoints
  markerLoadPickup = L.marker([Ld.pickup.lat, Ld.pickup.lon]).addTo(map).bindPopup(`Pickup: ${Ld.pickup.city}, ${Ld.pickup.state}`);
  markerLoadDelivery = L.marker([Ld.delivery.lat, Ld.delivery.lon]).addTo(map).bindPopup(`Delivery: ${Ld.delivery.city}, ${Ld.delivery.state}`);

  // Fit both pins and route
  const group = L.featureGroup([markerLoadPickup, markerLoadDelivery, previewLayer]);
  map.fitBounds(group.getBounds(), {padding:[40,40]});
}

document.getElementById('drawerFuelBtn').addEventListener('click', showFuelStopsForCurrentRoute);
document.getElementById('fuelStopsBtn').addEventListener('click', showFuelStopsForCurrentRoute);
document.getElementById('closeDrawer').addEventListener('click', ()=>{
  document.getElementById('drawer').classList.remove('open');
});

// Clear button
document.getElementById('clearBtn').addEventListener('click', ()=>{
  [fromInput,toInput,pickupInput].forEach(el=>{
    el.value=''; delete el.dataset.lat; delete el.dataset.lon;
  });
  fromUseLoc.checked = false; pickupUseLoc.checked = false;
  Array.from(equipFilter.options).forEach(o=>o.selected=false);
  radiusSel.value = '50';
  routeMeta.textContent = 'Distance: — • ETA: —';
  loadList.innerHTML = ''; loadCount.textContent = '0 results';

  if(routeLayer){ map.removeLayer(routeLayer); routeLayer=null; }
  if(previewLayer){ map.removeLayer(previewLayer); previewLayer=null; }
  if(markerLoadPickup){ map.removeLayer(markerLoadPickup); markerLoadPickup=null; }
  if(markerLoadDelivery){ map.removeLayer(markerLoadDelivery); markerLoadDelivery=null; }
  if(markerFromLoc){ map.removeLayer(markerFromLoc); markerFromLoc=null; }
  if(markerPickupLoc){ map.removeLayer(markerPickupLoc); markerPickupLoc=null; }
  clearFuelStops();
  markers.forEach(m=>map.removeLayer(m)); markers=[];

  map.setView([35.2271,-80.8431], 6);
});

document.getElementById('fuelStopsBtn').addEventListener('click', ()=>{
  const t = document.getElementById('toast');
  t.textContent = 'Fuel stops demo: integrate with a fuel API or waypoint service.';
  t.hidden = false;
  setTimeout(()=>{t.hidden=true;}, 2600);
});
