python3 << 'PYEOF'
f = open("src/js/app.js", "w")
f.write("""
// Luftlinie — Entfernungsrechner
// Nominatim (OpenStreetMap) + Haversine formula — No API key needed!

var fromCoords = null, toCoords = null;
var fromName = "", toName = "";
var markerA = null, markerB = null;
var arcLine = null;

// MAP INIT
var map = L.map("map", { center: [30, 15], zoom: 3, zoomControl: true });
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18, attribution: "© OpenStreetMap"
}).addTo(map);

// Click on map to set points
var nextClick = "from";
map.on("click", function(e) {
  var lat = e.latlng.lat;
  var lng = e.latlng.lng;
  reverseGeocode(lat, lng, function(name) {
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
});

// MARKERS
function makeIcon(type) {
  return L.divIcon({
    html: '<div class="marker-' + type + '"><span>' + type.toUpperCase() + '</span></div>',
    className: "", iconSize: [28,28], iconAnchor: [14,28],
  });
}

function setFrom(lat, lng, name) {
  fromCoords = { lat: lat, lng: lng };
  fromName = name;
  document.getElementById("from-coords").textContent = lat.toFixed(5) + ", " + lng.toFixed(5);
  if (markerA) map.removeLayer(markerA);
  markerA = L.marker([lat, lng], { icon: makeIcon("a") }).addTo(map).bindPopup("A: " + name);
}

function setTo(lat, lng, name) {
  toCoords = { lat: lat, lng: lng };
  toName = name;
  document.getElementById("to-coords").textContent = lat.toFixed(5) + ", " + lng.toFixed(5);
  if (markerB) map.removeLayer(markerB);
  markerB = L.marker([lat, lng], { icon: makeIcon("b") }).addTo(map).bindPopup("B: " + name);
}

// GEOCODING
function geocode(query, callback) {
  var url = "https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(query) + "&format=json&limit=5";
  fetch(url, { headers: { "Accept-Language": "de,en" } })
    .then(function(r) { return r.json(); })
    .then(function(data) { callback(data); })
    .catch(function() { callback([]); });
}

function reverseGeocode(lat, lng, callback) {
  var url = "https://nominatim.openstreetmap.org/reverse?lat=" + lat + "&lon=" + lng + "&format=json";
  fetch(url, { headers: { "Accept-Language": "de,en" } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var name = data.display_name ? data.display_name.split(",").slice(0,2).join(", ") : lat.toFixed(3) + ", " + lng.toFixed(3);
      callback(name);
    })
    .catch(function() { callback(lat.toFixed(3) + ", " + lng.toFixed(3)); });
}

// AUTOCOMPLETE
function setupAutocomplete(inputId, suggestionsId, type) {
  var input = document.getElementById(inputId);
  var list  = document.getElementById(suggestionsId);
  var timer;

  input.addEventListener("input", function() {
    clearTimeout(timer);
    var q = input.value.trim();
    if (q.length < 2) { list.innerHTML = ""; return; }
    timer = setTimeout(function() {
      geocode(q, function(results) {
        list.innerHTML = "";
        results.forEach(function(r) {
          var li = document.createElement("li");
          li.textContent = r.display_name.split(",").slice(0,3).join(", ");
          li.addEventListener("click", function() {
            var lat = parseFloat(r.lat), lng = parseFloat(r.lon);
            var name = r.display_name.split(",").slice(0,2).join(", ");
            input.value = name;
            list.innerHTML = "";
            if (type === "from") setFrom(lat, lng, name);
            else setTo(lat, lng, name);
            if (fromCoords && toCoords) calculate();
          });
          list.appendChild(li);
        });
      });
    }, 400);
  });

  document.addEventListener("click", function(e) {
    if (!input.contains(e.target)) list.innerHTML = "";
  });
}

setupAutocomplete("from-input", "from-suggestions", "from");
setupAutocomplete("to-input",   "to-suggestions",   "to");

// HAVERSINE
function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getBearing(lat1, lon1, lat2, lon2) {
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI/180);
  var x = Math.cos(lat1 * Math.PI/180) * Math.sin(lat2 * Math.PI/180) -
          Math.sin(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.cos(dLon);
  var b = Math.atan2(y, x) * 180 / Math.PI;
  return ((b + 360) % 360).toFixed(1);
}

function bearingToCompass(deg) {
  var dirs = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// DRAW LINE
function drawArc(from, to) {
  if (arcLine) map.removeLayer(arcLine);
  var points = [];
  for (var i = 0; i <= 100; i++) {
    var t = i / 100;
    points.push([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
  }
  arcLine = L.polyline(points, { color: "#e94560", weight: 2.5, dashArray: "8,6", opacity: 0.85 }).addTo(map);
  map.fitBounds(arcLine.getBounds(), { padding: [60,60] });
}

// CALCULATE
function calculate() {
  if (!fromCoords || !toCoords) return;
  var km    = haversine(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
  var miles = (km * 0.621371).toFixed(0);
  var nm    = (km * 0.539957).toFixed(0);
  var deg   = parseFloat(getBearing(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng));
  var compass = bearingToCompass(deg);

  var flightHrs = km / 900;
  var flightStr = flightHrs < 1
    ? Math.round(flightHrs * 60) + " Min"
    : Math.floor(flightHrs) + "h " + Math.round((flightHrs % 1) * 60) + "min";

  var driveHrs = (km * 1.4) / 80;
  var driveStr = driveHrs < 1
    ? Math.round(driveHrs * 60) + " Min"
    : Math.floor(driveHrs) + "h " + Math.round((driveHrs % 1) * 60) + "min";

  var tzDiff = Math.abs((toCoords.lng - fromCoords.lng) / 15);
  var tzStr  = tzDiff < 0.5 ? "~0h" : "~" + tzDiff.toFixed(1) + "h";

  var kmDisplay = km < 1
    ? Math.round(km * 1000) + " m"
    : Math.round(km).toLocaleString();

  var html = '<div>';
  html += '<div class="result-distance">' + kmDisplay + '</div>';
  if (km >= 1) html += '<span class="result-unit">KILOMETER</span>';
  if (km >= 1) html += '<div class="result-miles">' + miles + ' mi · ' + nm + ' nm</div>';
  html += '<div class="result-from-to">📍 ' + fromName + '<br>✈ ' + toName + '</div>';
  html += '</div>';
  document.getElementById("result-box").innerHTML = html;

  document.getElementById("flight-time").textContent = flightStr;
  document.getElementById("drive-time").textContent  = driveStr;
  document.getElementById("bearing").textContent     = deg + "° " + compass;
  document.getElementById("tz-diff").textContent     = tzStr;
  document.getElementById("info-grid").style.display = "grid";

  drawArc(fromCoords, toCoords);
  document.getElementById("map-hint").style.display = "none";
}

// BUTTONS
document.getElementById("calc-btn").addEventListener("click", calculate);

document.getElementById("swap-btn").addEventListener("click", function() {
  var tmpCoords = fromCoords; fromCoords = toCoords; toCoords = tmpCoords;
  var tmpName = fromName; fromName = toName; toName = tmpName;
  document.getElementById("from-input").value = fromName;
  document.getElementById("to-input").value   = toName;
  document.getElementById("from-coords").textContent = fromCoords ? fromCoords.lat.toFixed(5) + ", " + fromCoords.lng.toFixed(5) : "—";
  document.getElementById("to-coords").textContent   = toCoords   ? toCoords.lat.toFixed(5)   + ", " + toCoords.lng.toFixed(5)   : "—";
  if (fromCoords && toCoords) calculate();
});

document.getElementById("locate-from").addEventListener("click", function() {
  navigator.geolocation.getCurrentPosition(function(pos) {
    var lat = pos.coords.latitude, lng = pos.coords.longitude;
    reverseGeocode(lat, lng, function(name) {
      setFrom(lat, lng, name);
      document.getElementById("from-input").value = name;
      if (fromCoords && toCoords) calculate();
    });
  }, function() { alert("Standortzugriff verweigert."); });
});
""")
f.close()
print("app.js fixed!")
PYEOF
