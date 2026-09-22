/* ============================================================
   Rotta | Flight Tracker
   Sorgente dati: AeroDataBox (RapidAPI) oppure un proxy tuo.
   Senza chiave la pagina resta in modalità dimostrativa.
   ============================================================ */
(function () {
  "use strict";

  /* ══════════ CONFIGURAZIONE ══════════
     Due modi per collegare i dati reali.

     A. Chiave RapidAPI direttamente qui sotto.
        Attenzione: il codice è pubblico, chiunque apra la pagina legge la chiave.
        Va bene per prove e uso personale, non per una pagina molto visitata.

     B. Proxy (consigliato): un endpoint tuo che tiene la chiave lato server.
        Lascia RAPIDAPI_KEY vuota e scrivi qui l'indirizzo del proxy.
        Rotta chiamerà PROXY_URL + codice volo.
  */
  var RAPIDAPI_KEY = "";
  var RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";
  var PROXY_URL = "https://rotta-api.giorgio-riva.workers.dev/volo/";

  /* ══════════ ANAGRAFICA AEROPORTI ══════════
     Serve solo come riserva: quando l'API risponde, le coordinate
     e i nomi arrivano da lei. */
  var AP = {
    FCO:[41.800,12.239,"Roma Fiumicino"], MXP:[45.630,8.723,"Milano Malpensa"],
    LIN:[45.445,9.277,"Milano Linate"],   BGY:[45.674,9.704,"Milano Bergamo"],
    VCE:[45.505,12.352,"Venezia"],        NAP:[40.886,14.291,"Napoli"],
    BLQ:[44.535,11.288,"Bologna"],        TRN:[45.201,7.650,"Torino"],
    CTA:[37.467,15.066,"Catania"],        PMO:[38.176,13.091,"Palermo"],
    CAG:[39.251,9.054,"Cagliari"],        BRI:[41.139,16.760,"Bari"],
    LHR:[51.470,-0.454,"Londra Heathrow"],LGW:[51.148,-0.190,"Londra Gatwick"],
    CDG:[49.010,2.548,"Parigi Charles de Gaulle"], ORY:[48.726,2.365,"Parigi Orly"],
    AMS:[52.309,4.764,"Amsterdam"],       FRA:[50.038,8.562,"Francoforte"],
    MUC:[48.354,11.786,"Monaco di Baviera"], ZRH:[47.458,8.548,"Zurigo"],
    VIE:[48.110,16.570,"Vienna"],         MAD:[40.472,-3.561,"Madrid"],
    BCN:[41.297,2.078,"Barcellona"],      LIS:[38.774,-9.134,"Lisbona"],
    BRU:[50.901,4.484,"Bruxelles"],       CPH:[55.618,12.656,"Copenaghen"],
    ARN:[59.652,17.919,"Stoccolma"],      OSL:[60.194,11.100,"Oslo"],
    HEL:[60.317,24.963,"Helsinki"],       DUB:[53.421,-6.270,"Dublino"],
    ATH:[37.936,23.947,"Atene"],          IST:[41.262,28.742,"Istanbul"],
    WAW:[52.166,20.967,"Varsavia"],       PRG:[50.101,14.260,"Praga"],
    JFK:[40.640,-73.779,"New York JFK"],  EWR:[40.692,-74.169,"New York Newark"],
    BOS:[42.363,-71.006,"Boston"],        ORD:[41.978,-87.905,"Chicago O'Hare"],
    LAX:[33.942,-118.408,"Los Angeles"],  SFO:[37.619,-122.375,"San Francisco"],
    MIA:[25.795,-80.287,"Miami"],         YYZ:[43.677,-79.630,"Toronto"],
    GRU:[-23.435,-46.473,"San Paolo"],    EZE:[-34.822,-58.536,"Buenos Aires"],
    DXB:[25.253,55.365,"Dubai"],          DOH:[25.273,51.608,"Doha"],
    AUH:[24.433,54.651,"Abu Dhabi"],      TLV:[32.011,34.887,"Tel Aviv"],
    CAI:[30.112,31.400,"Il Cairo"],       JNB:[-26.139,28.246,"Johannesburg"],
    NRT:[35.765,140.386,"Tokyo Narita"],  HND:[35.549,139.780,"Tokyo Haneda"],
    KIX:[34.427,135.244,"Osaka Kansai"],  ICN:[37.469,126.451,"Seul Incheon"],
    PEK:[40.080,116.585,"Pechino"],       PVG:[31.143,121.805,"Shanghai Pudong"],
    HKG:[22.308,113.918,"Hong Kong"],     SIN:[1.364,103.991,"Singapore"],
    BKK:[13.690,100.750,"Bangkok"],       DEL:[28.556,77.100,"Delhi"],
    BOM:[19.089,72.868,"Mumbai"],         SYD:[-33.947,151.179,"Sydney"],
    MEL:[-37.669,144.841,"Melbourne"],    AKL:[-37.008,174.792,"Auckland"]
  };

  /* ══════════ UTILITÀ ══════════ */
  var $ = function (id) { return document.getElementById(id); };
  var clean = function (s) { return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); };
  var pad2 = function (n) { return String(n).padStart(2, "0"); };
  var nfmt = function (n) {
    return n == null ? null : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
  };

  function toISO(s) {
    if (!s) return null;
    var t = String(s).trim().replace(" ", "T");
    t = t.replace(/T(\d{2}):(\d{2})(?=([+\-]\d{2}:?\d{2}|Z)?$)/, "T$1:$2:00");
    return t;
  }
  function hhmm(s) {
    if (!s) return null;
    var m = String(s).match(/[T ](\d{2}):(\d{2})/);
    return m ? m[1] + ":" + m[2] : null;
  }
  function ms(s) {
    if (!s) return null;
    var d = new Date(toISO(s));
    return isNaN(d) ? null : d.getTime();
  }
  function durTxt(a, b) {
    if (a == null || b == null || b <= a) return null;
    var t = Math.round((b - a) / 60000);
    return Math.floor(t / 60) + "h " + pad2(t % 60) + "m";
  }
  function haversine(a, b, c, d) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (c - a) * r, dLon = (d - b) * r;
    var h = Math.pow(Math.sin(dLat / 2), 2) +
            Math.cos(a * r) * Math.cos(c * r) * Math.pow(Math.sin(dLon / 2), 2);
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }

  var STATUS = {
    active:    ["in volo", "s-air", true],
    scheduled: ["programmato", "s-idle", false],
    delayed:   ["in ritardo", "s-late", false],
    landed:    ["atterrato", "s-ok", false],
    cancelled: ["cancellato", "s-stop", false],
    diverted:  ["dirottato", "s-late", false],
    unknown:   ["non disponibile", "s-idle", false]
  };

  /* ══════════ ADATTATORE AeroDataBox → modello interno ══════════ */
  var ADB_STATUS = {
    enroute: "active", approaching: "active", departed: "active",
    expected: "scheduled", checkin: "scheduled", boarding: "scheduled",
    gateclosed: "scheduled", scheduled: "scheduled",
    delayed: "delayed", arrived: "landed",
    canceled: "cancelled", cancelled: "cancelled", canceleduncertain: "cancelled",
    diverted: "diverted", unknown: "unknown"
  };

  function side(m) {
    m = m || {};
    var a = m.airport || {};
    var loc = a.location || {};
    var iata = a.iata || a.iataCode || null;
    var fb = iata && AP[iata] ? AP[iata] : null;
    var sched = m.scheduledTime || {};
    var rev = m.revisedTime || m.predictedTime || m.runwayTime || {};
    return {
      iata: iata,
      city: a.municipalityName || a.shortName || a.name || (fb ? fb[2] : null),
      lat: loc.lat != null ? loc.lat : (fb ? fb[0] : null),
      lon: loc.lon != null ? loc.lon : (fb ? fb[1] : null),
      terminal: m.terminal || null,
      gate: m.gate || null,
      sched: sched.local || null,
      schedUtc: sched.utc || null,
      revised: rev.local || null,
      revisedUtc: rev.utc || null
    };
  }

  function fromADB(f) {
    var d = side(f.departure), a = side(f.arrival);
    var st = ADB_STATUS[String(f.status || "unknown").toLowerCase()] || "unknown";
    var loc = f.location || null;
    var km = f.greatCircleDistance && f.greatCircleDistance.km
      ? Math.round(f.greatCircleDistance.km)
      : (d.lat != null && a.lat != null ? haversine(d.lat, d.lon, a.lat, a.lon) : null);
    return {
      code: (f.number || "").replace(/\s+/g, ""),
      airline: (f.airline && f.airline.name) || null,
      status: st,
      dep: d,
      arr: a,
      aircraft: {
        model: (f.aircraft && f.aircraft.model) || null,
        reg: (f.aircraft && f.aircraft.reg) || null
      },
      live: loc ? {
        lat: loc.lat, lon: loc.lon,
        altM: loc.altitude && loc.altitude.meter != null ? Math.round(loc.altitude.meter) : null,
        spdKmh: loc.groundSpeed && loc.groundSpeed.kmPerHour != null
          ? Math.round(loc.groundSpeed.kmPerHour) : null
      } : null,
      km: km
    };
  }

  /* ══════════ DATI DIMOSTRATIVI ══════════ */
  function stamp(min, tz) {
    var d = new Date(Date.now() + min * 60000);
    var sign = tz[0] === "-" ? -1 : 1;
    var off = (parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(4, 6), 10)) * sign;
    var l = new Date(d.getTime() + off * 60000);
    return l.getUTCFullYear() + "-" + pad2(l.getUTCMonth() + 1) + "-" + pad2(l.getUTCDate()) +
      " " + pad2(l.getUTCHours()) + ":" + pad2(l.getUTCMinutes()) + tz;
  }
  function pt(iata, tz, terminal, gate, schedMin, revMin) {
    var fb = AP[iata];
    return {
      iata: iata, city: fb[2], lat: fb[0], lon: fb[1],
      terminal: terminal, gate: gate,
      sched: stamp(schedMin, tz), schedUtc: stamp(schedMin, "+00:00"),
      revised: revMin == null ? null : stamp(revMin, tz),
      revisedUtc: revMin == null ? null : stamp(revMin, "+00:00")
    };
  }
  function demo() {
    return {
      AZ610: {
        code: "AZ610", airline: "ITA Airways", status: "active",
        dep: pt("FCO", "+02:00", "1", "E42", -192, -180),
        arr: pt("JFK", "-04:00", "1", "B24", 378, 384),
        aircraft: { model: "Airbus A330-900neo", reg: "EI-EJL" },
        live: { lat: 48.6, lon: -26.4, altM: 11278, spdKmh: 872 }, km: null
      },
      LH1922: {
        code: "LH1922", airline: "Lufthansa", status: "delayed",
        dep: pt("MXP", "+02:00", "1", "A17", 74, 108),
        arr: pt("MUC", "+02:00", "2", "G31", 146, 178),
        aircraft: { model: "Airbus A320neo", reg: "D-AINL" },
        live: null, km: null
      },
      NH209: {
        code: "NH209", airline: "All Nippon Airways", status: "landed",
        dep: pt("HND", "+09:00", "3", "110", -880, -874),
        arr: pt("MXP", "+02:00", "1", "B09", -92, -104),
        aircraft: { model: "Boeing 787-9", reg: "JA936A" },
        live: null, km: null
      },
      FR8623: {
        code: "FR8623", airline: "Ryanair", status: "active",
        dep: pt("BGY", "+02:00", "1", "12", -58, -41),
        arr: pt("CTA", "+02:00", "A", "6", 50, 64),
        aircraft: { model: "Boeing 737 MAX 8", reg: "EI-HAT" },
        live: { lat: 42.1, lon: 13.4, altM: 10668, spdKmh: 814 }, km: null
      },
      SQ355: {
        code: "SQ355", airline: "Singapore Airlines", status: "active",
        dep: pt("SIN", "+08:00", "3", "A11", -410, -404),
        arr: pt("MXP", "+02:00", "1", "B21", 320, 326),
        aircraft: { model: "Boeing 777-300ER", reg: "9V-SWR" },
        live: { lat: 27.4, lon: 62.8, altM: 11582, spdKmh: 903 }, km: null
      },
      VY6412: {
        code: "VY6412", airline: "Vueling", status: "cancelled",
        dep: pt("BCN", "+02:00", "1", null, 212, null),
        arr: pt("FCO", "+02:00", "3", null, 320, null),
        aircraft: { model: "Airbus A320neo", reg: "EC-NDD" },
        live: null, km: null
      }
    };
  }

  /* ══════════ PLANISFERO ══════════ */
  var PLANE = "M20,0L6,4L0,4L-3,15L-8,15L-5,4L-15,3L-17,8L-21,8L-18,0L-21,-8L-17,-8L-15,-3L-5,-4L-8,-15L-3,-15L0,-4L6,-4Z";
  var NS = "http://www.w3.org/2000/svg";
  var raf = null;

  var PX = function (lon) { return (lon + 180) / 360 * 1000; };
  var PY = function (lat) { return (90 - lat) / 180 * 500; };

  function greatCircle(la1, lo1, la2, lo2, n) {
    var r = Math.PI / 180, out = [];
    var p1 = la1 * r, l1 = lo1 * r, p2 = la2 * r, l2 = lo2 * r;
    var dd = 2 * Math.asin(Math.sqrt(
      Math.pow(Math.sin((p2 - p1) / 2), 2) +
      Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin((l2 - l1) / 2), 2)));
    for (var i = 0; i <= n; i++) {
      var f = i / n;
      if (dd === 0) { out.push([la1, lo1]); continue; }
      var A = Math.sin((1 - f) * dd) / Math.sin(dd), B = Math.sin(f * dd) / Math.sin(dd);
      var x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
      var y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
      var z = A * Math.sin(p1) + B * Math.sin(p2);
      out.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / r, Math.atan2(y, x) / r]);
    }
    return out;
  }

  // longitudini continue: evita il salto sull'antimeridiano
  function unwrap(pts) {
    var prev = null;
    return pts.map(function (p) {
      var lon = p[1];
      if (prev !== null) {
        while (lon - prev > 180) lon -= 360;
        while (prev - lon > 180) lon += 360;
      }
      prev = lon;
      return [p[0], lon];
    });
  }

  function buildMap(m, progress) {
    var box = $("mapbox");
    if (!box) return;
    var pw = box.clientWidth || 900, ph = box.clientHeight || 300;
    var A = pw / ph;

    var hasGeo = m.dep.lat != null && m.arr.lat != null;
    var pts = hasGeo
      ? unwrap(greatCircle(m.dep.lat, m.dep.lon, m.arr.lat, m.arr.lon, 128))
      : [];
    var xy = pts.map(function (p) { return [PX(p[1]), PY(p[0])]; });

    // riquadro sulla rotta
    var vb;
    if (xy.length) {
      var xs = xy.map(function (p) { return p[0]; }), ys = xy.map(function (p) { return p[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      var w = Math.max((x1 - x0) * 1.7, 96), h = Math.max((y1 - y0) * 2.6, 48);
      if (w / h < A) w = h * A; else h = w / A;
      if (w > 1000) { w = 1000; h = w / A; }
      var vx = cx - w / 2, vy = cy - h / 2;
      if (vy < -30) vy = -30;
      if (vy + h > 530) vy = 530 - h;
      vb = [vx, vy, w, h];
    } else {
      vb = [0, 0, 1000, 1000 / A];
    }
    var k = vb[2] / pw; // unità di viewBox per pixel

    // reticolo geografico: disegnato una volta sola, esteso ai tre giri di mappa
    var grat = "";
    for (var g = -1; g <= 1; g++) {
      for (var lo = -180; lo < 180; lo += 30) grat += "M" + (PX(lo) + g * 1000) + ",0V500";
    }
    for (var la = -60; la <= 60; la += 30) grat += "M-1000," + PY(la) + "H2000";

    var svg = '<svg viewBox="' + vb.join(" ") + '" xmlns="' + NS + '" aria-hidden="true">' +
      '<defs><g id="atlas"><path class="ln" d="' + (window.WORLD || "") + '"/></g></defs>' +
      '<use href="#atlas" x="-1000"/><use href="#atlas"/><use href="#atlas" x="1000"/>' +
      '<path class="grat" d="' + grat + '"/>';

    if (xy.length) {
      var d = "M" + xy.map(function (p) {
        return p[0].toFixed(2) + "," + p[1].toFixed(2);
      }).join("L");
      svg += '<path class="todo" d="' + d + '" stroke-width="' + (1.6 * k) +
             '" stroke-dasharray="' + (1.1 * k) + ' ' + (5 * k) + '"/>' +
             '<path class="done" id="mp-done" d="' + d + '" stroke-width="' + (2.7 * k) + '"/>';
      [xy[0], xy[xy.length - 1]].forEach(function (p) {
        svg += '<circle class="node" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (5.5 * k) + '"/>';
      });
      svg += '<g id="mp-plane" opacity="0">' +
             '<circle class="halo" r="' + (15 * k) + '"/>' +
             '<path class="plane" d="' + PLANE + '" transform="scale(' + (0.54 * k) + ')"/></g>';
    }
    svg += "</svg>";
    box.innerHTML = svg;

    if (!xy.length || progress == null) return;

    var done = $("mp-done");
    var plane = $("mp-plane");
    var L = done.getTotalLength();
    done.style.strokeDasharray = L;
    done.style.strokeDashoffset = L;

    // se c'è la posizione reale, l'avanzamento segue quella
    var target = Math.max(0, Math.min(1, progress));
    if (m.live && m.live.lat != null) {
      var lx = PX(m.live.lon), ly = PY(m.live.lat);
      // riporta la longitudine nello stesso giro della rotta
      while (lx - xy[0][0] > 500) lx -= 1000;
      while (xy[0][0] - lx > 500) lx += 1000;
      var best = 0, bd = Infinity;
      for (var i = 0; i <= 200; i++) {
        var q = done.getPointAtLength(L * i / 200);
        var dist = Math.pow(q.x - lx, 2) + Math.pow(q.y - ly, 2);
        if (dist < bd) { bd = dist; best = i / 200; }
      }
      target = best;
    }

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var T = reduce ? 0 : 1200;
    var t0 = performance.now();
    if (raf) cancelAnimationFrame(raf);

    function place(p) {
      done.style.strokeDashoffset = L * (1 - p);
      var l = Math.max(0.5, L * p);
      var a = done.getPointAtLength(l);
      var b = done.getPointAtLength(Math.min(L, l + Math.max(0.6, L * 0.004)));
      var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      plane.setAttribute("transform", "translate(" + a.x + " " + a.y + ") rotate(" + ang + ")");
      plane.setAttribute("opacity", p > 0.004 ? "1" : "0");
    }
    if (T === 0) { place(target); return; }
    raf = requestAnimationFrame(function step(now) {
      var t = Math.min(1, (now - t0) / T);
      place(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    });
  }

  /* ══════════ RESA ══════════ */
  var current = null;

  function progressOf(m) {
    if (m.status === "cancelled") return null;
    if (m.status === "landed") return 1;
    var t0 = ms(m.dep.revisedUtc || m.dep.schedUtc || m.dep.revised || m.dep.sched);
    var t1 = ms(m.arr.revisedUtc || m.arr.schedUtc || m.arr.revised || m.arr.sched);
    if (m.status === "scheduled" || m.status === "delayed") return 0;
    if (t0 == null || t1 == null || t1 <= t0) return null;
    return (Date.now() - t0) / (t1 - t0);
  }

  function paintSide(pfx, o) {
    var sched = hhmm(o.sched), real = hhmm(o.revised);
    var moved = real && real !== sched;
    var s = $(pfx + "-sched"), r = $(pfx + "-real");
    s.textContent = sched || "—";
    s.className = "t-sched" + (moved ? " moved" : "");
    if (moved) { r.hidden = false; r.textContent = real; } else { r.hidden = true; }

    var bits = [];
    if (o.terminal) bits.push("term " + o.terminal);
    if (o.gate) bits.push("gate " + o.gate);
    var ds = ms(o.schedUtc || o.sched), dr = ms(o.revisedUtc || o.revised);
    if (ds != null && dr != null) {
      var delay = Math.round((dr - ds) / 60000);
      if (delay > 0) bits.push("+" + delay + " min");
      else if (delay < 0) bits.push(delay + " min");
    }
    $(pfx + "-note").textContent = bits.join(" · ");
  }

  function render(m, source) {
    current = { m: m, source: source };
    var st = STATUS[m.status] || STATUS.unknown;

    $("r-code").textContent = m.code || "—";
    $("r-sub").textContent = [m.airline, m.aircraft.model].filter(Boolean).join(" · ") || "—";
    $("r-status").className = "status " + st[1] + (st[2] ? " live" : "");
    $("r-status-t").textContent = st[0];

    $("dep-iata").textContent = m.dep.iata || "—";
    $("arr-iata").textContent = m.arr.iata || "—";
    $("dep-city").textContent = m.dep.city || "—";
    $("arr-city").textContent = m.arr.city || "—";
    paintSide("dep", m.dep);
    paintSide("arr", m.arr);

    var t0 = ms(m.dep.revisedUtc || m.dep.schedUtc || m.dep.revised || m.dep.sched);
    var t1 = ms(m.arr.revisedUtc || m.arr.schedUtc || m.arr.revised || m.arr.sched);
    var km = m.km || (m.dep.lat != null && m.arr.lat != null
      ? haversine(m.dep.lat, m.dep.lon, m.arr.lat, m.arr.lon) : null);

    function cell(id, val) {
      var el = $(id);
      el.textContent = val || "—";
      el.className = "v" + (val ? "" : " dim");
    }
    cell("d-dur", durTxt(t0, t1));
    cell("d-dist", km ? nfmt(km) + " km" : null);
    cell("d-spd", m.live && m.live.spdKmh ? nfmt(m.live.spdKmh) + " km/h" : null);
    cell("d-alt", m.live && m.live.altM ? nfmt(m.live.altM) + " m" : null);
    cell("d-craft", m.aircraft.model);
    cell("d-reg", m.aircraft.reg);

    var p = progressOf(m);

    // barra di avanzamento
    var rl = $("rail-l"), rr = $("rail-r"), fill = $("rail-fill"), dot = $("rail-dot");
    if (p == null) {
      rl.textContent = "volo cancellato";
      rr.textContent = "";
      fill.style.width = "0%"; dot.style.left = "0%";
    } else {
      var now = Date.now();
      rl.textContent = t0 && now > t0 ? "in volo da " + durTxt(t0, now) : "decollo previsto";
      rr.textContent = m.status === "landed" ? "arrivato"
        : (t1 && t1 > now ? "arrivo tra " + durTxt(now, t1) : "in arrivo");
      var pc = Math.max(0, Math.min(1, p)) * 100;
      setTimeout(function () {
        fill.style.width = pc + "%";
        dot.style.left = pc + "%";
      }, 60);
    }

    var lab = $("maplab");
    if (lab) {
      lab.textContent = [
        km ? nfmt(km) + " km" : null,
        durTxt(t0, t1),
        m.live && m.live.lat != null ? "posizione reale" : null
      ].filter(Boolean).join("  ·  ");
    }

    show("strip");
    $("strip").classList.add("in");
    requestAnimationFrame(function () { buildMap(m, p); });

    // solo le ricerche andate a buon fine entrano tra le recenti
    remember(lastQuery || clean(m.code), m);

    var d = new Date();
    $("r-updated").textContent = "aggiornato alle " + pad2(d.getHours()) + ":" +
      pad2(d.getMinutes()) + ":" + pad2(d.getSeconds()) + " · " +
      (source === "live" ? "aerodatabox" : "dati dimostrativi");
  }

  function show(which) {
    ["loading", "note", "strip"].forEach(function (id) {
      var el = $(id);
      if (el) el.hidden = (id !== which);
    });
    if (which !== "strip") $("strip").classList.remove("in");
  }
  function say(title, body) {
    $("note-title").textContent = title;
    $("note-body").innerHTML = body;
    show("note");
  }

  /* ══════════ RICERCHE RECENTI ══════════
     Restano solo nel browser di chi visita (localStorage),
     non vengono inviate a nessun server. */
  var K_RECENT = "rotta:recenti";
  var MAX_RECENT = 6;
  var lastQuery = null;

  function readRecent() {
    try {
      var v = JSON.parse(window.localStorage.getItem(K_RECENT) || "[]");
      return Array.isArray(v) ? v.filter(function (r) {
        return r && /^[A-Z0-9]{3,8}$/.test(r.c);
      }) : [];
    } catch (e) { return []; }
  }
  function writeRecent(list) {
    try { window.localStorage.setItem(K_RECENT, JSON.stringify(list)); } catch (e) {}
  }
  function remember(code, m) {
    var iata = function (s) { return /^[A-Z0-9]{3}$/.test(s || "") ? s : null; };
    var voce = { c: code, d: iata(m.dep.iata), a: iata(m.arr.iata) };
    var list = readRecent().filter(function (r) { return r.c !== code; });
    list.unshift(voce);
    writeRecent(list.slice(0, MAX_RECENT));
    drawRecent();
  }
  function drawRecent() {
    var box = $("examples");
    if (!box) return;
    var list = readRecent();
    box.innerHTML = "";
    box.hidden = !list.length;
    if (!list.length) return;

    var lab = document.createElement("span");
    lab.className = "lab";
    lab.textContent = "recenti";
    box.appendChild(lab);

    list.forEach(function (r) {
      var b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      var code = document.createElement("span");
      code.textContent = r.c;
      b.appendChild(code);
      if (r.d && r.a) {
        var rt = document.createElement("small");
        rt.textContent = r.d + " → " + r.a;
        b.appendChild(rt);
        b.setAttribute("aria-label", r.c + ", da " + r.d + " a " + r.a);
      }
      b.addEventListener("click", function () { $("q").value = r.c; lookup(r.c); });
      box.appendChild(b);
    });

    var x = document.createElement("button");
    x.className = "chip-x";
    x.type = "button";
    x.textContent = "cancella";
    x.setAttribute("aria-label", "Cancella le ricerche recenti");
    x.addEventListener("click", function () {
      try { window.localStorage.removeItem(K_RECENT); } catch (e) {}
      drawRecent();
    });
    box.appendChild(x);
  }

  /* ══════════ RICERCA ══════════ */
  function pickBest(rows) {
    var rank = { EnRoute: 0, Approaching: 0, Departed: 1, Boarding: 2, Expected: 3,
                 Delayed: 3, CheckIn: 4, Arrived: 5, Diverted: 6, Canceled: 7 };
    return rows.slice().sort(function (a, b) {
      var ra = rank[a.status] == null ? 9 : rank[a.status];
      var rb = rank[b.status] == null ? 9 : rank[b.status];
      return ra - rb;
    })[0];
  }

  function lookup(code) {
    var c = clean(code);
    if (c.length < 3) {
      say("codice troppo corto",
        "Serve il codice IATA del volo: due lettere della compagnia più il numero, per esempio <code>AZ610</code>.");
      return;
    }
    lastQuery = c;
    $("q").value = c;
    show("loading");

    if (!RAPIDAPI_KEY && !PROXY_URL) {
      var set = demo();
      setTimeout(function () {
        if (set[c]) render(set[c], "demo");
        else say("volo non presente in demo",
          "Senza chiave la pagina lavora su sei voli simulati: <code>AZ610</code>, <code>LH1922</code>, " +
          "<code>NH209</code>, <code>FR8623</code>, <code>SQ355</code>, <code>VY6412</code>. " +
          "Collega AeroDataBox per interrogare i voli reali.");
      }, 420);
      return;
    }

    var url, opts = {};
    if (PROXY_URL) {
      url = PROXY_URL + encodeURIComponent(c);
    } else {
      url = "https://" + RAPIDAPI_HOST + "/flights/number/" + encodeURIComponent(c) +
            "?withAircraftImage=false&withLocation=true";
      opts.headers = { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": RAPIDAPI_HOST };
    }

    fetch(url, opts).then(function (res) {
      if (res.status === 204 || res.status === 404) return [];
      if (!res.ok) {
        return res.text().then(function (txt) {
          var dett = "";
          try {
            var j = JSON.parse(txt);
            dett = j.message || j.error || j.detail || "";
          } catch (e) {
            dett = String(txt).slice(0, 180);
          }
          var base;
          if (res.status === 401 || res.status === 403) {
            base = "Chiave rifiutata, oppure non risulti iscritto ad AeroDataBox su RapidAPI.";
          } else if (res.status === 429) {
            base = "Quota mensile esaurita oppure troppe richieste ravvicinate.";
          } else {
            base = "Il servizio ha risposto con codice " + res.status + ".";
          }
          var e = new Error(base + (dett ? "<br><br>Risposta del server: <code>" + dett + "</code>" : ""));
          e.dalServer = true;
          throw e;
        });
      }
      return res.json();
    }).then(function (data) {
      var rows = Array.isArray(data) ? data : (data && data.data) || [];
      if (!rows.length) {
        say("nessun risultato",
          "Nessun volo <code>" + c + "</code> in programma oggi. Controlla il codice, " +
          "oppure prova il numero operativo invece di quello in codeshare.");
        return;
      }
      render(fromADB(pickBest(rows)), "live");
    }).catch(function (err) {
      var testo = (err && err.message) ? err.message : "Il servizio non ha risposto.";
      if (!(err && err.dalServer) && !PROXY_URL) {
        testo += " Se il browser segnala un problema di CORS, il rimedio è passare da un proxy.";
      }
      say("richiesta non riuscita", testo);
    });
  }

  /* ══════════ EVENTI ══════════ */
  var q = $("q");
  if (!q) return;

  q.addEventListener("focus", function () { $("field").classList.add("field-on"); });
  q.addEventListener("blur", function () { $("field").classList.remove("field-on"); });
  q.addEventListener("input", function () { q.value = q.value.toUpperCase(); });
  q.addEventListener("keydown", function (e) { if (e.key === "Enter") lookup(q.value); });
  $("go").addEventListener("click", function () { lookup(q.value); });
  $("refresh").addEventListener("click", function () {
    lookup(q.value || $("r-code").textContent);
  });

  drawRecent();

  var kt = $("keytoggle");
  if (kt && (RAPIDAPI_KEY || PROXY_URL)) {
    // sorgente dati già configurata: il pannello non serve più
    var kb = document.querySelector(".keybox");
    if (kb) kb.hidden = true;
  } else if (kt) {
    kt.addEventListener("click", function () {
      var p = $("keypanel");
      p.hidden = !p.hidden;
      if (!p.hidden) $("key").focus();
    });
    $("keysave").addEventListener("click", function () {
      RAPIDAPI_KEY = $("key").value.trim();
      $("mode").textContent = RAPIDAPI_KEY ? "dati aerodatabox" : "modalità dimostrativa";
      $("keypanel").hidden = true;
      if (q.value) lookup(q.value);
    });
    $("key").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("keysave").click();
    });
  }

  // il planisfero si ridisegna al ridimensionamento della finestra
  var rt;
  function redraw() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (current && !$("strip").hidden) buildMap(current.m, progressOf(current.m));
    }, 180);
  }
  window.addEventListener("resize", redraw);

  $("mode").textContent = (RAPIDAPI_KEY || PROXY_URL) ? "dati aerodatabox" : "modalità dimostrativa";
  if (window.innerWidth > 720) q.focus();
})();
