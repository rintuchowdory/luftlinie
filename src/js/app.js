var fromCoords=null,toCoords=null,fromName="",toName="",markerA=null,markerB=null,arcLine=null;
var map=L.map("map",{center:[30,15],zoom:3,zoomControl:true});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map);

var nextClick="from";
map.on("click",function(e){
  var lat=e.latlng.lat,lng=e.latlng.lng;
  reverseGeocode(lat,lng,function(name){
    if(nextClick==="from"){setFrom(lat,lng,name);document.getElementById("from-input").value=name;nextClick="to";}
    else{setTo(lat,lng,name);document.getElementById("to-input").value=name;nextClick="from";}
    if(fromCoords&&toCoords)calculate();
  });
});

function makeIcon(t){
  return L.divIcon({html:'<div class="marker-'+t+'"><span>'+t.toUpperCase()+'</span></div>',className:"",iconSize:[28,28],iconAnchor:[14,28]});
}
function setFrom(lat,lng,name){
  fromCoords={lat:lat,lng:lng};fromName=name;
  document.getElementById("from-coords").textContent=lat.toFixed(5)+", "+lng.toFixed(5);
  if(markerA)map.removeLayer(markerA);
  markerA=L.marker([lat,lng],{icon:makeIcon("a")}).addTo(map).bindPopup("A: "+name);
}
function setTo(lat,lng,name){
  toCoords={lat:lat,lng:lng};toName=name;
  document.getElementById("to-coords").textContent=lat.toFixed(5)+", "+lng.toFixed(5);
  if(markerB)map.removeLayer(markerB);
  markerB=L.marker([lat,lng],{icon:makeIcon("b")}).addTo(map).bindPopup("B: "+name);
}
function geocode(q,cb){
  fetch("https://nominatim.openstreetmap.org/search?q="+encodeURIComponent(q)+"&format=json&limit=5",{headers:{"Accept-Language":"de,en"}})
    .then(function(r){return r.json();}).then(cb).catch(function(){cb([]);});
}
function reverseGeocode(lat,lng,cb){
  fetch("https://nominatim.openstreetmap.org/reverse?lat="+lat+"&lon="+lng+"&format=json",{headers:{"Accept-Language":"de,en"}})
    .then(function(r){return r.json();})
    .then(function(d){cb(d.display_name?d.display_name.split(",").slice(0,2).join(", "):lat.toFixed(3)+", "+lng.toFixed(3));})
    .catch(function(){cb(lat.toFixed(3)+", "+lng.toFixed(3));});
}
function setupAC(inId,sugId,type){
  var inp=document.getElementById(inId),sug=document.getElementById(sugId),timer;
  inp.addEventListener("input",function(){
    clearTimeout(timer);var q=inp.value.trim();
    if(q.length<2){sug.innerHTML="";return;}
    timer=setTimeout(function(){
      geocode(q,function(res){
        sug.innerHTML="";
        res.forEach(function(r){
          var li=document.createElement("li");
          li.textContent=r.display_name.split(",").slice(0,3).join(", ");
          li.addEventListener("click",function(){
            var lat=parseFloat(r.lat),lng=parseFloat(r.lon);
            var name=r.display_name.split(",").slice(0,2).join(", ");
            inp.value=name;sug.innerHTML="";
            if(type==="from")setFrom(lat,lng,name);else setTo(lat,lng,name);
            if(fromCoords&&toCoords)calculate();
          });
          sug.appendChild(li);
        });
      });
    },400);
  });
  document.addEventListener("click",function(e){if(!inp.contains(e.target))sug.innerHTML="";});
}
setupAC("from-input","from-suggestions","from");
setupAC("to-input","to-suggestions","to");

function haversine(la1,lo1,la2,lo2){
  var R=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
  var a=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function getBearing(la1,lo1,la2,lo2){
  var dLo=(lo2-lo1)*Math.PI/180;
  var y=Math.sin(dLo)*Math.cos(la2*Math.PI/180);
  var x=Math.cos(la1*Math.PI/180)*Math.sin(la2*Math.PI/180)-Math.sin(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.cos(dLo);
  return(((Math.atan2(y,x)*180/Math.PI)+360)%360).toFixed(1);
}
function toCompass(d){
  var dirs=["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(d/22.5)%16];
}
function calculate(){
  if(!fromCoords||!toCoords)return;
  var km=haversine(fromCoords.lat,fromCoords.lng,toCoords.lat,toCoords.lng);
  var miles=(km*0.621371).toFixed(0),nm=(km*0.539957).toFixed(0);
  var deg=parseFloat(getBearing(fromCoords.lat,fromCoords.lng,toCoords.lat,toCoords.lng));
  var fh=km/900,dh=(km*1.4)/80;
  var fStr=fh<1?Math.round(fh*60)+" Min":Math.floor(fh)+"h "+Math.round((fh%1)*60)+"min";
  var dStr=dh<1?Math.round(dh*60)+" Min":Math.floor(dh)+"h "+Math.round((dh%1)*60)+"min";
  var tz=Math.abs((toCoords.lng-fromCoords.lng)/15);
  var kmD=km<1?Math.round(km*1000)+" m":Math.round(km).toLocaleString();
  var html='<div><div class="result-distance">'+kmD+'</div>';
  if(km>=1)html+='<span class="result-unit">KILOMETER</span><div class="result-miles">'+miles+' mi - '+nm+' nm</div>';
  html+='<div class="result-from-to">Von: '+fromName+'<br>Nach: '+toName+'</div></div>';
  document.getElementById("result-box").innerHTML=html;
  document.getElementById("flight-time").textContent=fStr;
  document.getElementById("drive-time").textContent=dStr;
  document.getElementById("bearing").textContent=deg+"° "+toCompass(deg);
  document.getElementById("tz-diff").textContent=tz<0.5?"~0h":"~"+tz.toFixed(1)+"h";
  document.getElementById("info-grid").style.display="grid";
  if(arcLine)map.removeLayer(arcLine);
  var pts=[];for(var i=0;i<=100;i++)pts.push([fromCoords.lat+(toCoords.lat-fromCoords.lat)*i/100,fromCoords.lng+(toCoords.lng-fromCoords.lng)*i/100]);
  arcLine=L.polyline(pts,{color:"#e94560",weight:2.5,dashArray:"8,6",opacity:.85}).addTo(map);
  map.fitBounds(arcLine.getBounds(),{padding:[60,60]});
  document.getElementById("map-hint").style.display="none";
}
document.getElementById("calc-btn").addEventListener("click",calculate);
document.getElementById("swap-btn").addEventListener("click",function(){
  var tc=fromCoords;fromCoords=toCoords;toCoords=tc;
  var tn=fromName;fromName=toName;toName=tn;
  document.getElementById("from-input").value=fromName;
  document.getElementById("to-input").value=toName;
  document.getElementById("from-coords").textContent=fromCoords?fromCoords.lat.toFixed(5)+", "+fromCoords.lng.toFixed(5):"—";
  document.getElementById("to-coords").textContent=toCoords?toCoords.lat.toFixed(5)+", "+toCoords.lng.toFixed(5):"—";
  if(fromCoords&&toCoords)calculate();
});
document.getElementById("locate-from").addEventListener("click",function(){
  navigator.geolocation.getCurrentPosition(function(p){
    reverseGeocode(p.coords.latitude,p.coords.longitude,function(name){
      setFrom(p.coords.latitude,p.coords.longitude,name);
      document.getElementById("from-input").value=name;
      if(fromCoords&&toCoords)calculate();
    });
  },function(){alert("Standortzugriff verweigert.");});
});