(function () {
  "use strict";

  var TIER = {
    pe:    { label: "PE-backed",   short: "PE",      glyph: "$" },
    corp:  { label: "Corp & VC",   short: "Corp/VC", glyph: "C" },
    indie: { label: "Independent", short: "Indie",   glyph: "I" }
  };
  var HOME = { center: [40.7148, -73.9560], zoom: 15 };

  var state = { tier: "", area: "", cuisine: "", q: "", activeId: null, alts: [] };
  var places = [];
  var markers = {};
  var map, altLayer;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  fetch("data/restaurants.json")
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function (err) {
      $("list").innerHTML = '<li class="empty">Could not load data. ' + esc(err.message) + "</li>";
    });

  function init(data) {
    places = spreadDuplicates(data.places);
    $("reviewed").textContent = data.lastReviewed;

    var ratio = "";
    ["pe", "indie", "corp"].forEach(function (t) {
      var n = places.filter(function (p) { return p.tier === t; }).length;
      $("count-" + t).textContent = n;
      ratio += '<span class="' + t + '" style="flex:' + n + '"></span>';
    });
    $("ratio").innerHTML = ratio;

    fillSelect("area", uniq(places.map(function (p) { return p.area; })));
    fillSelect("cuisine", uniq(places.map(function (p) { return p.cuisine; })));

    buildMap();
    bindControls();

    var fromHash = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (fromHash && places.some(function (p) { return p.id === fromHash; })) {
      select(fromHash, true, true);
    }
    render();
  }

  // Shops at the same address would stack exactly; fan them out a few metres.
  function spreadDuplicates(list) {
    var seen = {};
    return list.map(function (p) {
      var key = p.lat.toFixed(5) + "," + p.lng.toFixed(5);
      var n = seen[key] = (seen[key] || 0) + 1;
      if (n === 1) return p;
      var angle = n * 2.1;
      return Object.assign({}, p, {
        lat: p.lat + Math.sin(angle) * 0.00011,
        lng: p.lng + Math.cos(angle) * 0.00015
      });
    });
  }

  function uniq(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; }).sort();
  }

  function fillSelect(id, values) {
    var el = $(id);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v; o.textContent = v;
      el.appendChild(o);
    });
  }

  function buildMap() {
    map = L.map("map", { zoomControl: true, scrollWheelZoom: true, attributionControl: true })
      .setView(HOME.center, HOME.zoom);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      className: "street-tiles",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    var Reset = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var wrap = L.DomUtil.create("div", "leaflet-bar");
        var a = L.DomUtil.create("a", "reset-btn", wrap);
        a.href = "#"; a.title = "Reset view"; a.setAttribute("role", "button"); a.innerHTML = "&#8634;";
        L.DomEvent.on(a, "click", function (e) {
          L.DomEvent.preventDefault(e);
          clearSelection();
          map.fitBounds(HOME.bounds);
        });
        return wrap;
      }
    });
    map.addControl(new Reset());
    altLayer = L.layerGroup().addTo(map);
    HOME.bounds = null;

    places.forEach(function (p) {
      var icon = L.divIcon({
        className: "",
        html: '<div class="pin ' + p.tier + '" data-id="' + esc(p.id) + '"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      var m = L.marker([p.lat, p.lng], { icon: icon, title: p.name + " (" + TIER[p.tier].label + ")", riseOnHover: true })
        .addTo(map)
        .on("click", function () { select(p.id, true); });
      markers[p.id] = m;
    });
    HOME.bounds = L.latLngBounds(places.map(function (p) { return [p.lat, p.lng]; })).pad(0.08);
    map.fitBounds(HOME.bounds);
  }

  function bindControls() {
    document.querySelectorAll(".stat").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var t = btn.getAttribute("data-tier");
        state.tier = state.tier === t ? "" : t;
        render();
      });
    });
    $("area").addEventListener("change", function (e) { state.area = e.target.value; render(); });
    $("cuisine").addEventListener("change", function (e) { state.cuisine = e.target.value; render(); });
    $("q").addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); render(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") clearSelection(); });
  }

  function matches(p) {
    if (state.tier && p.tier !== state.tier) return false;
    if (state.area && p.area !== state.area) return false;
    if (state.cuisine && p.cuisine !== state.cuisine) return false;
    if (state.q) {
      var hay = [p.name, p.address, p.owner, p.cuisine, p.area, (p.chain || []).join(" ")].join(" ").toLowerCase();
      if (hay.indexOf(state.q) === -1) return false;
    }
    return true;
  }

  function render() {
    document.querySelectorAll(".stat").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-tier") === state.tier));
    });

    var order = { pe: 0, indie: 1, corp: 2 };
    var shown = places.filter(matches).sort(function (a, b) {
      return order[a.tier] - order[b.tier] || a.name.localeCompare(b.name);
    });

    places.forEach(function (p) {
      var el = markers[p.id] && markers[p.id].getElement();
      if (!el) return;
      var pin = el.querySelector(".pin");
      var on = matches(p);
      pin.classList.toggle("dim", !on && state.alts.indexOf(p.id) === -1);
      pin.classList.toggle("active", p.id === state.activeId);
      pin.classList.toggle("alt", state.alts.indexOf(p.id) !== -1);
      markers[p.id].setZIndexOffset(p.id === state.activeId ? 1000 : on ? 100 : 0);
    });

    $("result-count").textContent = shown.length + " of " + places.length + " places";

    var list = $("list");
    if (!shown.length) {
      list.innerHTML = '<li class="empty">Nothing matches. Loosen a filter.</li>';
      return;
    }
    var html = "", lastTier = null;
    shown.forEach(function (p) {
      if (p.tier !== lastTier) {
        var n = shown.filter(function (o) { return o.tier === p.tier; }).length;
        html += '<li class="group" aria-hidden="true"><span>' + TIER[p.tier].label + "</span><span>" + n + "</span></li>";
        lastTier = p.tier;
      }
      html += '<li class="row' + (p.id === state.activeId ? " active" : "") + '" tabindex="0" data-id="' + esc(p.id) + '">' +
        '<i class="mk ' + p.tier + '"></i>' +
        '<div><div class="name">' + esc(p.name) + "</div>" +
        '<div class="meta">' + esc(p.cuisine) + " · " + esc(p.address) + "</div></div></li>";
    });
    list.innerHTML = html;

    list.querySelectorAll(".row").forEach(function (row) {
      var id = row.getAttribute("data-id");
      row.addEventListener("click", function () { select(id, true); });
      row.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(id, true); }
      });
    });
  }

  function byId(id) {
    for (var i = 0; i < places.length; i++) if (places[i].id === id) return places[i];
    return null;
  }

  function select(id, fly, quiet) {
    var p = byId(id);
    if (!p) return;
    state.activeId = id;
    if (history.replaceState) history.replaceState(null, "", "#" + id);
    state.alts = [];
    showDetail(p, !quiet);
    drawAltLines(p);
    render();
    if (fly && map) {
      var pts = [[p.lat, p.lng]].concat(state.alts.map(function (id) { var o = byId(id); return [o.lat, o.lng]; }));
      var wide = window.matchMedia("(min-width: 861px)").matches;
      var pad = wide ? { paddingTopLeft: [60, 60], paddingBottomRight: [460, 60] } : { paddingTopLeft: [30, 30], paddingBottomRight: [30, 30] };
      if (pts.length > 1) map.flyToBounds(pts, Object.assign({ maxZoom: 17, duration: 0.6 }, pad));
      else map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    }
  }

  function clearSelection() {
    state.activeId = null;
    state.alts = [];
    if (altLayer) altLayer.clearLayers();
    $("detail").hidden = true;
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    render();
  }

  // Haversine distance in metres
  function dist(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function nearbyIndies(p) {
    return places
      .filter(function (o) { return o.tier === "indie" && o.id !== p.id; })
      .map(function (o) {
        // Same type of food gets a bump so a coffee chain suggests coffee first.
        var d = dist(p, o);
        return { p: o, d: d, score: d * (o.cuisine === p.cuisine ? 0.45 : 1) };
      })
      .sort(function (a, b) { return a.score - b.score; })
      .slice(0, 3);
  }

  function walkLabel(m) {
    var mins = Math.max(1, Math.round(m / 80));
    return mins <= 20 ? mins + " min walk" : (m / 1000).toFixed(1) + " km";
  }

  function altsHtml(p) {
    if (p.tier === "indie") return "";
    var alts = nearbyIndies(p);
    state.alts = alts.map(function (a) { return a.p.id; });
    return '<section class="alts-box"><h3>Independent nearby</h3><ul class="alts">' + alts.map(function (a) {
      return '<li><button data-id="' + esc(a.p.id) + '">' +
        '<span class="alt-text"><span class="alt-name">' + esc(a.p.name) + "</span>" +
        '<span class="alt-meta">' + esc(a.p.cuisine) + (a.p.cuisine === p.cuisine ? " · same kind of food" : "") + "</span></span>" +
        '<span class="walk">' + walkLabel(a.d) + "</span></button></li>";
    }).join("") + "</ul></section>";
  }

  function drawAltLines(p) {
    altLayer.clearLayers();
    if (!p || p.tier === "indie") return;
    state.alts.forEach(function (id) {
      var o = byId(id);
      L.polyline([[p.lat, p.lng], [o.lat, o.lng]], { color: "#1d7a46", weight: 2, opacity: .8, dashArray: "4 6", interactive: false }).addTo(altLayer);
    });
  }

  function showDetail(p, scroll) {
    var el = $("detail");
    var t = TIER[p.tier];
    var html = '<button class="close" aria-label="Close">&times;</button>' +
      '<span class="stamp ' + p.tier + '"><i class="mk ' + p.tier + '"></i>' + t.label + "</span>" +
      "<h2>" + esc(p.name) + "</h2>" +
      '<p class="addr">' + esc(p.address) + " · " + esc(p.area) + " · " + esc(p.cuisine) + "</p>" +
      '<p class="owner"><span>Owned by</span><span>' + esc(p.owner) + "</span></p>" +
      '<p class="note">' + esc(p.note) + "</p>" +
      altsHtml(p) +
      "<h3>Follow the money</h3>" +
      '<ol class="money">' + (p.chain || []).map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ol>" +
      "<h3>Sources</h3>" +
      '<ol class="sources">' + p.sources.map(function (s) {
        return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a></li>";
      }).join("") + "</ol>" +
      '<p class="conf">Confidence: ' + esc(p.confidence) + "</p>";

    el.innerHTML = html;
    el.hidden = false;
    el.querySelector(".close").addEventListener("click", clearSelection);
    el.querySelectorAll(".alts button").forEach(function (b) {
      b.addEventListener("click", function () { select(b.getAttribute("data-id"), true); });
    });

    if (scroll && window.matchMedia("(max-width: 860px)").matches) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
})();
