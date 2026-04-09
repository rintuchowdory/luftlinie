cat > src/js/app.js << 'EOF'
// Luftlinie — Entfernungsrechner
// Haversine formula + Nominatim (OpenStreetMap) — kein API Key!

let fromCoords = null, toCoords = null;
let fromName = "", toName = "";
let markerA = null, markerB = null;
let arcLine = null;
let clickMode = null; // 'from' or 'to'

// ─── MAP ──────────────────────────────────────────────────────────────────────
const map = L.map("map", { center: [30, 15], zoom: 3, zoomControl: true });
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "© OpenStreetMap"
}).addTo(map);

// Click on map to set points
let nextClick = "from";
map.on("click", async (e) => {
  const { lat, lng } = e.latlng;
  const name = await reverseGeocode(lat, lng);
  if (nextClick === "from") {
    setFrom(lat, lng, name);
    document.getElementById("from-input").value = name;
    nextClick = "to";
  } else {
    setTo(lat, lng, name);
    document.getElementById("to-input").value = name;
    nextClick = "from";
  }
  if (fromCoords && toCoords) calculate();
});

// ─── MARKERS ──────────────────────────────────────────────────────────────────
function makeIcon(type) {
  return L.divIcon({
    html: `<div class="marker-${type}"><span>${type.toUpperCase()}</span></div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

function setFrom(lat, lng, name) {
  fromCoords = { lat, lng };
  fromName = name;
  document.getElementById("from-coords").textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (markerA) map.removeLayer(markerA);
  markerA = L.marker([lat, lng], { icon: makeIcon("a") }).addTo(map)
    .bindPopup(`<b>A: ${name}</b>`);
}

function setTo(lat, lng, name) {
  toCoords = { lat, lng };
  toName = name;
  document.getElementById("to-coords").textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (markerB) map.removeLayer(markerB);
  markerB = L.marker([lat, lng], { icon: makeIcon("b") }).addTo(map)
    .bindPopup(`<b>B: ${name}</b>`);
}

// ─── GEOCODING (Nominatim) ────────────────────────────────────────────────────
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, { headers: { "Accept-Language": "de,en" } });
  return await res.json();
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, { headers: { "Accept-Language": "de,en" } });
  const data = await res.json();
  return data.display_name ? data.display_name.split(",").slice(0, 2).join(", ") : `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

// ─── AUTOCOMPLETE ─────────────────────────────────────────────────────────────
function setupAutocomplete(inputId, suggestionsId, type) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById(suggestionsId);
  let timer;

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { list.innerHTML = ""; return; }
    timer = setTimeout(async () => {
      const results = await geocode(q);
      list.innerHTML = "";
      results.forEach(r => {
        const li = document.createElement("li");
        li.textContent = r.display_name.split(",").slice(0, 3).join(", ");
        li.addEventListener("click", () => {
          const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
          const name = r.display_name.split(",").slice(0, 2).join(", ");
          input.value = name;
          list.innerHTML = "";
          if (type === "from") setFrom(lat, lng, name);
          else setTo(lat, lng, name);
          if (fromCoords && toCoords) calculate();
        });
        list.appendChild(li);
      });
    }, 400);
  });

  document.addEventListener("click", e => {
    if (!input.contains(e.target)) list.innerHTML = "";
  });
}

setupAutocomplete("from-input", "from-suggestions", "from");
setupAutocomplete("to-input", "to-suggestions", "to");

// ─── HAVERSINE ────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function bearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
             Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  const b = Math.atan2(y, x) * 180 / Math.PI;
  return ((b + 360) % 360).toFixed(1);
}

function bearingToCompass(deg) {
  const dirs = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ─── GREAT CIRCLE ARC ─────────────────────────────────────────────────────────
function drawArc(from, to) {
  if (arcLine) map.removeLayer(arcLine);
  const points = [];
  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;
    points.push([lat, lng]);
  }
  arcLine = L.polyline(points, {
    color: "#e94560",
    weight: 2.5,
    dashArray: "8, 6",
    opacity: 0.85,
  }).addTo(map);
  map.fitBounds(arcLine.getBounds(), { padding: [60, 60] });
}

// ─── CALCULATE ────────────────────────────────────────────────────────────────
function calculate() {
  if (!fromCoords || !toCoords) return;

  const km    = haversine(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
  const miles = km * 0.621371;
  const nm    = km * 0.539957;
  const deg   = parseFloat(bearing(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng));
  const compass = bearingToCompass(deg);

  // Flight time ~900 km/h cruising
  const flightHrs = km / 900;
  const flightStr = flightHrs < 1
    ? `${Math.round(flightHrs * 60)} Min`
    : `${Math.floor(flightHrs)}h ${Math.round((flightHrs % 1) * 60)}min`;

  // Drive ~80 km/h average (rough estimate ×1.4 road factor)
  const driveHrs = (km * 1.4) / 80;
  const driveStr = driveHrs < 1
    ? `${Math.round(driveHrs * 60)} Min`
    : `${Math.floor(driveHrs)}h ${Math.round((driveHrs % 1) * 60)}min`;

  // Timezone diff estimate (15° longitude = 1h)
  const tzDiff = Math.abs((toCoords.lng - fromCoords.lng) / 15);
  const tzStr  = tzDiff < 0.5 ? "~0h" : `~${tzDiff.toFixed(1)}h`;

  // Result box
  document.getElementById("result-box").innerHTML = `
    <div>
      <div class="result-distance">${km < 1 ? (km * 1000).toFixed(0) + " m" : km.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</div>
      ${km >= 1 ? '<span class="result-unit">KILOMETER</span>' : ''}
      ${km >= 1 ? `<div class="result-miles">${miles.toFixed(0)} mi · ${nm.toFixed(0)} nm</div>` : ''}
      <div class="result-from-to">
        📍 ${fromName}<br>✈ ${toName}
      </div>
    </div>
  `;

  document.getElementById("flight-time").textContent = flightStr;
  document.getElementById("drive-time").textContent  = driveStr;
  document.getElementById("bearing").textContent     = `${deg}° ${compass}`;
  document.getElementById("tz-diff").textContent     = tzStr;
  document.getElementById("info-grid").style.display = "grid";

  drawArc(fromCoords, toCoords);
  document.getElementById("map-hint").style.display = "none";
}

// ─── BUTTONS ──────────────────────────────────────────────────────────────────
document.getElementById("calc-btn").addEventListener("click", calculate);

document.getElementById("swap-btn").addEventListener("click", () => {
  [fromCoords, toCoords] = [toCoords, fromCoords];
  [fromName, toName] = [toName, fromName];
  document.getElementById("from-input").value = fromName;
  document.getElementById("to-input").value   = toName;
  document.getElementById("from-coords").textContent = fromCoords
    ? `${fromCoords.lat.toFixed(5)}, ${fromCoords.lng.toFixed(5)}` : "—";
  document.getElementById("to-coords").textContent = toCoords
    ? `${toCoords.lat.toFixed(5)}, ${toCoords.lng.toFixed(5)}` : "—";
  if (fromCoords && toCoords) calculate();
});

document.getElementById("locate-from").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const name = await reverseGeocode(lat, lng);
    setFrom(lat, lng, name);
    document.getElementById("from-input").value = name;
    if (fromCoords && toCoords) calculate();
  }, () => alert("Standortzugriff verweigert."));
});
EOF
