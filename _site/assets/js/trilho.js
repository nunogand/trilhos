/**
 * TRILHO — lógica específica da página (mapa, GPX, gráfico, galeria, lightbox).
 * A navegação e o botão "voltar ao topo" estão em assets/js/script.js (partilhado).
 *
 * Os dados vêm do HTML gerado pelo Jekyll (_layouts/trilho.html):
 *   <main id="conteudo" data-gpx="/fotos/post_x/ficheiro.gpx" data-folder="/fotos/post_x/">
 *   <button class="gallery-item" data-full="..." data-caption="...">   (uma por fotografia)
 */
const trailRoot = document.getElementById("conteudo");
const GPX_URL = trailRoot.dataset.gpx || "";
const TRAIL_FOLDER = trailRoot.dataset.folder || "";

/**
 * MAP SETUP
 */
const map = L.map("map").setView([41.2, -8.3], 12);
const tileLayers = {
  "Rua": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }),
  "Satélite": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "&copy; Esri" }),
  "Topográfico": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "&copy; OpenTopoMap" })
};
tileLayers["Rua"].addTo(map);
L.control.layers(tileLayers, null, { position: "bottomleft" }).addTo(map);

let elevationChart, elevationMarker = null, trackPoints = [], chartDataPoints = [];

const createIcon = (color) => L.divIcon({
  className: 'custom-pin',
  html: `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
         </svg>`,
  iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -40]
});

function getXmlElements(parent, tagName) { return Array.from(parent.getElementsByTagName(tagName)); }
function getXmlText(parent, tagName) { const el = parent.getElementsByTagName(tagName)[0]; return el ? el.textContent.trim() : null; }
function haversineDistance(a, b) {
  const R = 6371000, lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const v = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1 - v));
}
function formatDuration(ms) {
  if (!ms || ms <= 0) return "N/A"; const m = Math.round(ms / 60000), h = Math.floor(m / 60), min = m % 60;
  return h === 0 ? `${min} min` : `${h}h ${min}m`;
}
function downsample(data, max = 300) { if (data.length <= max) return data; const s = Math.ceil(data.length / max); return data.filter((_, i) => i % s === 0); }

function hideLoader() { document.getElementById("page-loader").classList.add("is-hidden"); }

function setStatus(kind, message) {
  const el = document.getElementById("status");
  el.className = `trail-status is-${kind}`;
  el.textContent = message; // textContent: nunca interpreta HTML
}

function updateStats(stats) {
  document.getElementById("distance").textContent = `${stats.distanceKm.toFixed(2)} km`;
  document.getElementById("elevationGain").textContent = `${Math.round(stats.elevationGain)} m`;
  document.getElementById("elevationLoss").textContent = `${Math.round(stats.elevationLoss)} m`;
  document.getElementById("duration").textContent = formatDuration(stats.durationMs);
  document.getElementById("points").textContent = stats.pointsCount.toLocaleString();
  setStatus("ok", "✓ Dados carregados");
  setTimeout(() => { hideLoader(); }, 500);
}

function renderElevationChart(elevationData) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById("elevationChart"), container = canvas.parentElement;
  canvas.width = container.offsetWidth; canvas.height = container.offsetHeight;
  const ctx = canvas.getContext("2d"), sampledData = downsample(elevationData);
  chartDataPoints = sampledData;
  if (elevationChart) elevationChart.destroy();

  elevationChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: sampledData.map(i => i.distanceKm.toFixed(1)),
      datasets: [{ label: "Elevation", data: sampledData.map(i => i.elevation), borderColor: "#3f7d46", backgroundColor: "rgba(63, 125, 70, 0.25)", borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: "#fff", pointHoverBorderColor: "#1f3d2b", pointHoverBorderWidth: 2, fill: true, tension: 0.4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" },
      onHover: (e, elements) => {
        if (elements.length) {
          const p = sampledData[elements[0].index];
          const c = trackPoints.reduce((prev, curr) => Math.abs((curr.distanceFromStart / 1000) - p.distanceKm) < Math.abs((prev.distanceFromStart / 1000) - p.distanceKm) ? curr : prev);
          updateMapMarker(c.lat, c.lon);
        } else removeMapMarker();
      },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(31, 61, 43, 0.95)", titleFont: { size: 11 }, bodyFont: { size: 11, weight: 'bold' }, padding: 8, cornerRadius: 6, displayColors: false, callbacks: { title: () => '', label: (i) => `${Math.round(i.raw)} m` } } },
      scales: {
        x: { display: true, title: { display: true, text: "km", color: "#6d7c6d", font: { size: 10 } }, grid: { display: false }, ticks: { color: "#6d7c6d", font: { size: 9 }, maxTicksLimit: 4 }, border: { display: false } },
        y: { display: true, title: { display: true, text: "m", color: "#6d7c6d", font: { size: 10 } }, grid: { color: "rgba(31, 61, 43, 0.06)" }, ticks: { color: "#6d7c6d", font: { size: 9 }, maxTicksLimit: 3 }, border: { display: false } }
      }
    }
  });
}

function updateMapMarker(lat, lng) {
  if (!elevationMarker) elevationMarker = L.circleMarker([lat, lng], { radius: 8, color: "#ffffff", weight: 3, fillColor: "#3f7d46", fillOpacity: 1 }).addTo(map);
  else elevationMarker.setLatLng([lat, lng]);
  map.panTo([lat, lng], { animate: true, duration: 0.5 });
}
function removeMapMarker() { if (elevationMarker) { map.removeLayer(elevationMarker); elevationMarker = null; } }

async function loadGPX() {
  try {
    if (!GPX_URL) throw new Error(`Nenhum ficheiro .gpx encontrado em ${TRAIL_FOLDER || "(pasta não definida)"}`);
    const res = await fetch(GPX_URL);
    if (!res.ok) throw new Error(`Ficheiro GPX não encontrado (HTTP ${res.status})`);
    const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("GPX XML inválido");

    const pts = getXmlElements(xml, "trkpt");
    if (!pts.length) throw new Error("Sem pontos no GPX");

    trackPoints = pts.map(p => ({ lat: parseFloat(p.getAttribute("lat")), lon: parseFloat(p.getAttribute("lon")), elevation: parseFloat(getXmlText(p, "ele")) || null, time: new Date(getXmlText(p, "time")) || null })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (trackPoints.length < 2) throw new Error("Pontos insuficientes");

    let totalDist = 0, gain = 0, loss = 0; const eData = [];
    for (let i = 0; i < trackPoints.length; i++) {
      const c = trackPoints[i]; if (i > 0) { const p = trackPoints[i-1]; totalDist += haversineDistance(p, c); if (Number.isFinite(c.elevation) && Number.isFinite(p.elevation)) { const d = c.elevation - p.elevation; if (d > 0) gain += d; else loss += Math.abs(d); } }
      c.distanceFromStart = totalDist; if (Number.isFinite(c.elevation)) eData.push({ distanceKm: totalDist / 1000, elevation: c.elevation });
    }

    const validT = trackPoints.filter(p => p.time instanceof Date && !Number.isNaN(p.time));
    const dur = validT.length >= 2 ? validT[validT.length-1].time - validT[0].time : null;

    const ll = trackPoints.map(p => [p.lat, p.lon]);
    L.polyline(ll, { color: "#2f7d3b", weight: 4, opacity: 0.9, lineJoin: "round" }).addTo(map);
    L.marker(ll[0], { icon: createIcon('#3f7d46') }).addTo(map).bindPopup("Início");
    L.marker(ll[ll.length-1], { icon: createIcon('#1f3d2b') }).addTo(map).bindPopup("Fim");
    map.fitBounds(L.polyline(ll).getBounds(), { padding: [40, 40] });

    updateStats({ distanceKm: totalDist / 1000, elevationGain: gain, elevationLoss: loss, durationMs: dur, pointsCount: trackPoints.length });
    if (eData.length > 1) renderElevationChart(eData);
    else hideLoader();

  } catch (err) {
    console.error(err);
    setStatus("error", `Erro: ${err.message}`);
    hideLoader();
  }
}

/**
 * GALERIA / LIGHTBOX
 * As miniaturas (<picture>) já vêm no HTML, geradas pelo Jekyll Picture Tag. Cada botão leva
 * data-srcset com as várias larguras da fotografia ampliada; aqui só se liga o lightbox e se
 * diz ao browser que tamanho a imagem terá no ecrã (atributo sizes), para ele descarregar
 * apenas a versão necessária (ecrã pequeno → ficheiro pequeno).
 */
function initLightbox() {
  const MAX_W = 0.9;   // iguais ao CSS de .modal-content img (max-width: 90vw; max-height: 85vh)
  const MAX_H = 0.85;

  // Quanto se aceita esticar a melhor versão disponível (1 = nunca além dos píxeis reais do ecrã).
  // O Jekyll Picture Tag não amplia imagens: se a fonte for pequena, a maior versão gerada também é
  // pequena, e esticá-la até ao tamanho do ecrã só a deixa desfocada. Sobe para 1.25–1.5 se preferires
  // uma imagem maior e ligeiramente mais suave em vez de uma mais pequena e nítida.
  const MAX_UPSCALE = 1;

  const items = Array.from(document.querySelectorAll(".gallery-item"));
  const images = items.map(btn => {
    const img = btn.querySelector("img");
    const srcset = (btn.dataset.srcset || "").trim();
    const w = Number(img.getAttribute("width")), h = Number(img.getAttribute("height"));
    return {
      srcset,
      maxW: Math.max(0, ...Array.from(srcset.matchAll(/\s(\d+)w/g), m => Number(m[1]))),  // maior versão gerada (px)
      src: srcset.split(",")[0].trim().split(/\s+/)[0] || img.currentSrc || img.src, // recurso: 1.ª versão
      ratio: w && h ? w / h : 1.5,                                                // proporção da fotografia
      alt: img.alt,
      caption: btn.dataset.caption || img.alt
    };
  });
  if (!images.length) return;

  const modal = document.getElementById("modal");
  const mImg = document.getElementById("modalImg");
  const mCap = document.getElementById("modalCaption");
  let current = 0, lastFocus = null;

  // Largura (px CSS) a que a imagem fica no ecrã. O atributo sizes define também o tamanho com que o
  // browser a desenha, por isso é limitado por três coisas:
  //   1. a largura disponível (90vw)
  //   2. a altura disponível (85vh), dada a proporção da fotografia
  //   3. a resolução real da maior versão gerada (maxW px físicos ÷ densidade de píxeis do ecrã)
  const displayWidth = d => {
    const fit = Math.min(window.innerWidth * MAX_W, window.innerHeight * MAX_H * d.ratio);
    const sharp = d.maxW ? (d.maxW / (window.devicePixelRatio || 1)) * MAX_UPSCALE : Infinity;
    return Math.round(Math.min(fit, sharp));
  };

  function apply(target, d) {
    target.sizes = `${displayWidth(d)}px`;   // antes de srcset e src
    if (d.srcset) target.srcset = d.srcset;
    target.src = d.src;
  }

  function update() {
    const d = images[current];
    apply(mImg, d);
    const wanted = Math.round(Math.min(window.innerWidth * MAX_W, window.innerHeight * MAX_H * d.ratio) * (window.devicePixelRatio || 1));
    if (d.maxW && d.maxW < wanted && !d.warned) {
      d.warned = true;
      console.info(`Lightbox: esta fotografia só tem versões até ${d.maxW}px de largura e este ecrã pedia ~${wanted}px. ` +
                   `A imagem-fonte é pequena (o Jekyll Picture Tag não amplia), por isso é mostrada sem a esticar.`);
    }
    mImg.alt = d.alt;
    mCap.textContent = d.caption;
    if (images.length > 1) apply(new Image(), images[(current + 1) % images.length]); // pré-carrega a seguinte
  }

  function open(i) {
    lastFocus = document.activeElement;
    current = i; update();
    modal.classList.add("open"); document.body.classList.add("modal-open");
    document.getElementById("modalClose").focus();
  }
  function close() {
    modal.classList.remove("open"); document.body.classList.remove("modal-open");
    setTimeout(() => { mImg.removeAttribute("srcset"); mImg.removeAttribute("sizes"); mImg.removeAttribute("src"); }, 300);
    lastFocus?.focus();
  }
  function next(e) { if (e) e.stopPropagation(); current = (current + 1) % images.length; update(); }
  function prev(e) { if (e) e.stopPropagation(); current = (current - 1 + images.length) % images.length; update(); }

  items.forEach((btn, i) => btn.addEventListener("click", () => open(i)));
  document.getElementById("modalClose").addEventListener("click", close);
  document.getElementById("modalNext").addEventListener("click", next);
  document.getElementById("modalPrev").addEventListener("click", prev);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  document.addEventListener("keydown", e => {
    if (!modal.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });
  // Rodar o telemóvel ou redimensionar a janela com o modal aberto: recalcula o tamanho
  window.addEventListener("resize", () => {
    if (modal.classList.contains("open")) mImg.sizes = `${displayWidth(images[current])}px`;
  });
}

document.getElementById('pip-chart-container').addEventListener('mousedown', e => e.stopPropagation());
document.getElementById('pip-chart-container').addEventListener('touchstart', e => e.stopPropagation(), {passive: false});

initLightbox();
loadGPX();