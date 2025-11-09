/* Dispatch Oracle – portfolio edition
   - Leaflet map
   - OSRM routing (free)
   - Nominatim autocomplete
   - Geolocation radius + mock loads
*/
document.addEventListener("DOMContentLoaded", () => {
  // Map
  const map = L.map("map", { zoomControl: true }).setView([39.5, -98.35], 4);

  // Fallback tile URL (some networks block the subdomain pattern)
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  // Elements
  const toast = document.getElementById("toast");
  const fromInput = document.getElementById("fromInput");
  const toInput = document.getElementById("toInput");
  const pickupInput = document.getElementById("pickupInput");
  const fromSuggest = document.getElementById("fromSuggest");
  const toSuggest = document.getElementById("toSuggest");
  const pickupSuggest = document.getElementById("pickupSuggest");
  const routeBtn = document.getElementById("routeBtn");
  const findLoadsBtn = document.getElementById("findLoadsBtn");
  const fuelToggle = document.getElementById("fuelToggle");
  const geoToggle  = document.getElementById("geoToggle");
  const radiusRange = document.getElementById("radiusRange");
  const radiusValue = document.getElementById("radiusValue");
  const resultsEl = document.getElementById("results");

  const showToast = (msg, ms=1800) => { toast.textContent = msg; toast.hidden = false; setTimeout(()=> toast.hidden=true, ms); };
  radiusValue.textContent = radiusRange.value;
  radiusRange.addEventListener("input", ()=> radiusValue.textContent = radiusRange.value);

  // State
  let A = null, B = null, desiredPickup = null;
  let routeLine = null;
  let tempMarkers = []; // fuel + load markers to clear together
  let radiusCircle = null, geoMarker = null;

  // A/B markers
  const markerA = L.marker([0,0], {opacity:0}).addTo(map);
  const markerB = L.marker([0,0], {opacity:0}).addTo(map);
  const setMarker = (which, latlng)=>{
    const m = which==="A" ? markerA : markerB;
    m.setLatLng(latlng).setOpacity(1);
    map.panTo(latlng);
  };

  // Autocomplete (Nominatim)
  function setupAutocomplete(input, list, onPick){
    input.addEventListener("input", async ()=>{
      const q = input.value.trim();
      if(q.length < 2){ list.innerHTML = ""; return; }
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&limit=6`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" }});
        const data = await res.json();
        if(!Array.isArray(data)){ list.innerHTML=""; return; }
        list.innerHTML = data.map(item=>{
          const city = item.display_name.split(",")[0];
          const state = item.address?.state || item.address?.county || "";
          const country = item.address?.country || "";
          return `<li data-lat="${item.lat}" data-lon="${item.lon}" data-name="${city}" data-state="${state}" data-country="${country}">
            ${city}${state?`, ${state}`:""}, ${country}
          </li>`;
        }).join("");
        list.querySelectorAll("li").forEach(li=>{
          li.addEventListener("click", ()=>{
            input.value = li.dataset.name + (li.dataset.state?`, ${li.dataset.state}`:"");
            list.innerHTML = "";
            onPick({
              lat: Number(li.dataset.lat),
              lon: Number(li.dataset.lon),
              name: li.dataset.name, state: li.dataset.state, country: li.dataset.country
            });
          });
        });
      } catch { list.innerHTML=""; }
    });
  }
  setupAutocomplete(fromInput, fromSuggest, (p)=>{ A = p; setMarker("A", [p.lat, p.lon]); });
  setupAutocomplete(toInput, toSuggest, (p)=>{ B = p; setMarker("B", [p.lat, p.lon]); });
  setupAutocomplete(pickupInput, pickupSuggest, (p)=>{ desiredPickup = p; map.setView([p.lat, p.lon], 10); showToast(`Pickup: ${p.name}${p.state?`, ${p.state}`:""}`); });

  // Build route (OSRM)
  routeBtn.addEventListener("click", async ()=>{
    if(!A || !B){ showToast("Please select both Point A and Point B."); return; }
    if(routeLine){ map.removeLayer(routeLine); }
    tempMarkers.forEach(m=> map.removeLayer(m)); tempMarkers = [];

    const url = `https://router.project-osrm.org/route/v1/driving/${A.lon},${A.lat};${B.lon},${B.lat}?overview=full&geometries=geojson`;
    try{
      const res = await fetch(url);
      const data = await res.json();
      if(!data.routes?.length){ showToast("No route found."); return; }
      const coords = data.routes[0].geometry.coordinates.map(([lon,lat])=>[lat,lon]);
      routeLine = L.polyline(coords, {color:"#56b6ff", weight:5, opacity:.9}).addTo(map);
      map.fitBounds(routeLine.getBounds(), {padding:[30,30]});
      showToast("Route built ✅");

      if(fuelToggle.checked){ plotFuelStationsAlongRoute(coords); }
    }catch{ showToast("Routing service unavailable."); }
  });

  function plotFuelStationsAlongRoute(coords){
    for(let i=20; i<coords.length; i+=40){
      const [lat, lon] = coords[i];
      const jitter = (Math.random()-0.5)*0.02;
      const p = [lat + jitter, lon + jitter];
      const mk = L.marker(p, {title:"Fuel Station"}).addTo(map);
      mk.bindPopup(`<b>Fuel Station</b><br>Diesel: $${(3.50+Math.random()*0.7).toFixed(2)}/gal`);
      tempMarkers.push(mk);
    }
  }

  // Geolocation + radius
  geoToggle.addEventListener("change", ()=>{
    if(geoToggle.checked){
      if(!navigator.geolocation){ showToast("Geolocation not supported"); geoToggle.checked=false; return; }
      navigator.geolocation.getCurrentPosition(pos=>{
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        setGeo(latlng);
      }, ()=>{
        showToast("Location permission denied"); geoToggle.checked=false;
      }, { enableHighAccuracy:true, timeout:8000 });
    } else { clearGeo(); }
  });

  function setGeo(latlng){
    clearGeo();
    geoMarker = L.marker(latlng, {title:"My location"}).addTo(map);
    const miles = Number(radiusRange.value);
    const meters = miles * 1609.34;
    radiusCircle = L.circle(latlng, {radius: meters, color:"#3478ff", fillColor:"#3478ff", fillOpacity:0.08}).addTo(map);
    map.fitBounds(radiusCircle.getBounds(), {padding:[20,20]});
  }
  function clearGeo(){
    if(geoMarker){ map.removeLayer(geoMarker); geoMarker=null; }
    if(radiusCircle){ map.removeLayer(radiusCircle); radiusCircle=null; }
  }

  // Mock loads within radius
  findLoadsBtn.addEventListener("click", ()=>{
    resultsEl.innerHTML = "";
    const center = geoToggle.checked && geoMarker ? geoMarker.getLatLng()
                : (desiredPickup ? L.latLng(desiredPickup.lat, desiredPickup.lon) : null);
    if(!center){ showToast("Turn on location or choose a desired pickup."); return; }

    const radiusMiles = Number(radiusRange.value);
    const loads = mockLoadsAround(center, radiusMiles, 6);
    loads.forEach(load => {
      const el = document.createElement("div");
      el.className = "load";
      el.innerHTML = `
        <div>
          <div><strong>${load.origin}</strong> → <strong>${load.dest}</strong> <span class="badge">${load.miles} mi</span></div>
          <div class="meta">${load.pickup} • ${load.equipment} • ${load.weight} lbs</div>
        </div>
        <div>
          <div class="payout">$${load.pay.toLocaleString()}</div>
          <div class="meta">${(load.pay/load.miles).toFixed(2)} $/mi</div>
        </div>`;
      resultsEl.appendChild(el);

      const mk = L.marker([load.lat, load.lon]).addTo(map);
      mk.bindPopup(`<b>${load.origin} → ${load.dest}</b><br>$${load.pay.toLocaleString()} • ${load.miles} mi`);
      tempMarkers.push(mk);
    });

    showToast(`Found ${loads.length} loads within ${radiusMiles} miles ✅`);
  });

  // Mock data helpers
  function mockLoadsAround(center, radiusMiles, count=6){
    const out = [];
    for(let i=0;i<count;i++){
      const km = radiusMiles * 1.60934;
      const r = (Math.random() * km) / 111; // ~deg lat
      const t = Math.random()*Math.PI*2;
      const lat = center.lat + r * Math.cos(t);
      const lon = center.lng + (r * Math.sin(t)) / Math.cos(center.lat*Math.PI/180);
      out.push({
        origin: randomCity(), dest: randomCity(),
        pay: Math.floor(800 + Math.random()*3200),
        miles: Math.floor(80 + Math.random()*900),
        equipment: ["Van","Reefer","Flatbed"][Math.floor(Math.random()*3)],
        weight: Math.floor(12000 + Math.random()*26000),
        pickup: randomPickupTime(),
        lat, lon
      });
    }
    return out;
  }
  function randomCity(){
    const c = ["Dallas, TX","Atlanta, GA","Chicago, IL","Charlotte, NC","Phoenix, AZ","Salt Lake City, UT","Nashville, TN","Denver, CO","Detroit, MI","Columbus, OH"];
    return c[Math.floor(Math.random()*c.length)];
  }
  function randomPickupTime(){
    const n = Math.floor(Math.random()*24);
    const day = Math.random()<0.5 ? "Today" : "Tomorrow";
    const h = (n%12)||12;
    const ampm = n<12 ? "AM" : "PM";
    return `${day} • ${h}:00 ${ampm}`;
  }
});
