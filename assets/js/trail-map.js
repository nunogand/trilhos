/**
 * trail-map.js
 *
 * Requisitos na página:
 * - Leaflet 1.9.4 carregado antes deste ficheiro
 * - Chart.js 4.4.1 carregado antes deste ficheiro
 * - <div id="map" data-gpx="/caminho/percurso.gpx"></div>
 * - <canvas id="elevationChart"></canvas>
 *
 * O script:
 * - lê o GPX indicado em #map[data-gpx]
 * - desenha o percurso no Leaflet
 * - calcula estatísticas
 * - desenha o perfil de elevação no Chart.js
 * - move um marcador no mapa ao passar o rato sobre o perfil
 */
(() => {
  "use strict";

  const MAX_CHART_POINTS = 400;
  const EARTH_RADIUS_METERS = 6_371_000;

  let map = null;
  let elevationChart = null;
  let elevationMarker = null;
  let trackPoints = [];

  const byId = id => document.getElementById(id);

  const setText = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = value;
  };

  const xmlText = (parent, tagName) => {
    const element = parent?.getElementsByTagName(tagName)?.[0];
    return element ? element.textContent.trim() : null;
  };

  const toRadians = degrees => degrees * Math.PI / 180;

  const haversineDistance = (first, second) => {
    const latitude1 = toRadians(first.lat);
    const latitude2 = toRadians(second.lat);
    const latitudeDelta = toRadians(second.lat - first.lat);
    const longitudeDelta = toRadians(second.lon - first.lon);

    const value =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(latitude1) *
        Math.cos(latitude2) *
        Math.sin(longitudeDelta / 2) ** 2;

    return (
      EARTH_RADIUS_METERS *
      2 *
      Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
    );
  };

  const formatDuration = milliseconds => {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "N/D";

    const totalMinutes = Math.round(milliseconds / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return hours > 0
      ? `${hours}h ${String(minutes).padStart(2, "0")}m`
      : `${minutes} min`;
  };

  /**
   * Reduz apenas os pontos apresentados no gráfico.
   * Os pontos completos permanecem em trackPoints para localizar
   * com precisão a coordenada correspondente à distância ativa.
   */
  const downsample = (data, maximum = MAX_CHART_POINTS) => {
    if (data.length <= maximum) return data;

    const step = Math.ceil(data.length / maximum);
    const sampled = data.filter((_, index) => index % step === 0);
    const last = data[data.length - 1];

    if (sampled[sampled.length - 1] !== last) sampled.push(last);
    return sampled;
  };

  /**
   * Pesquisa binária do ponto GPX completo mais próximo da distância.
   * trackPoints encontra-se ordenado por distanceFromStart.
   */
  const nearestTrackPoint = distanceMeters => {
    let low = 0;
    let high = trackPoints.length - 1;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (trackPoints[middle].distanceFromStart < distanceMeters) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    const current = trackPoints[low];
    const previous = low > 0 ? trackPoints[low - 1] : null;

    if (!previous) return current;

    return Math.abs(previous.distanceFromStart - distanceMeters) <=
      Math.abs(current.distanceFromStart - distanceMeters)
      ? previous
      : current;
  };

  const updateMapMarker = point => {
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
      return;
    }

    const position = [point.lat, point.lon];

    if (!elevationMarker) {
      elevationMarker = L.circleMarker(position, {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#8b4513",
        fillOpacity: 1,
        opacity: 1,
        interactive: false
      }).addTo(map);
    } else {
      elevationMarker.setLatLng(position);
    }

    elevationMarker.bringToFront();
  };

  const removeMapMarker = () => {
    if (!elevationMarker) return;
    map.removeLayer(elevationMarker);
    elevationMarker = null;
  };

  const parseGpx = xml => {
    let segmentNodes = [...xml.getElementsByTagName("trkseg")];
    let pointTag = "trkpt";

    if (!segmentNodes.length) {
      segmentNodes = [...xml.getElementsByTagName("rte")];
      pointTag = "rtept";
    }

    if (!segmentNodes.length) {
      const trackNodes = [...xml.getElementsByTagName("trkpt")];
      const routeNodes = [...xml.getElementsByTagName("rtept")];
      const fallbackNodes = trackNodes.length ? trackNodes : routeNodes;

      if (!fallbackNodes.length) {
        throw new Error("O GPX não contém pontos de percurso.");
      }

      return [[...fallbackNodes].map(parsePoint).filter(Boolean)];
    }

    return segmentNodes
      .map(segment =>
        [...segment.getElementsByTagName(pointTag)]
          .map(parsePoint)
          .filter(Boolean)
      )
      .filter(segment => segment.length);
  };

  const parsePoint = node => {
    const lat = Number.parseFloat(node.getAttribute("lat"));
    const lon = Number.parseFloat(node.getAttribute("lon"));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const rawElevation = Number.parseFloat(xmlText(node, "ele"));
    const rawTime = xmlText(node, "time");
    const time = rawTime ? new Date(rawTime) : null;

    return {
      lat,
      lon,
      elevation: Number.isFinite(rawElevation) ? rawElevation : null,
      time: time && !Number.isNaN(time.getTime()) ? time : null,
      distanceFromStart: 0
    };
  };

  const buildTrackData = segments => {
    let totalDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    const elevationData = [];
    const allPoints = [];

    segments.forEach(segment => {
      segment.forEach((point, index) => {
        if (index > 0) {
          const previous = segment[index - 1];
          totalDistance += haversineDistance(previous, point);

          if (
            Number.isFinite(point.elevation) &&
            Number.isFinite(previous.elevation)
          ) {
            const difference = point.elevation - previous.elevation;
            if (difference > 0) elevationGain += difference;
            else elevationLoss += Math.abs(difference);
          }
        }

        point.distanceFromStart = totalDistance;
        allPoints.push(point);

        if (Number.isFinite(point.elevation)) {
          elevationData.push({
            distanceKm: totalDistance / 1000,
            elevation: point.elevation
          });
        }
      });
    });

    return {
      allPoints,
      elevationData,
      totalDistance,
      elevationGain,
      elevationLoss
    };
  };

  const renderTrack = segments => {
    const lines = segments.map(segment =>
      L.polyline(
        segment.map(point => [point.lat, point.lon]),
        {
          color: "#2d5016",
          weight: 4,
          opacity: 0.9,
          lineJoin: "round",
          lineCap: "round"
        }
      )
    );

    const group = L.featureGroup(lines).addTo(map);
    const bounds = group.getBounds();

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });

    const first = trackPoints[0];
    const last = trackPoints[trackPoints.length - 1];

    L.marker([first.lat, first.lon]).addTo(map).bindPopup("Início");
    L.marker([last.lat, last.lon]).addTo(map).bindPopup("Fim");
  };

  const updateStats = stats => {
    const elevations = trackPoints
      .map(point => point.elevation)
      .filter(Number.isFinite);

    const timedPoints = trackPoints.filter(point => point.time instanceof Date);
    const duration = timedPoints.length >= 2
      ? timedPoints[timedPoints.length - 1].time - timedPoints[0].time
      : null;

    setText("distance", `${(stats.totalDistance / 1000).toFixed(2)} km`);
    setText("elevationGain", `${Math.round(stats.elevationGain)} m`);
    setText("elevationLoss", `${Math.round(stats.elevationLoss)} m`);
    setText("duration", formatDuration(duration));
    setText("points", trackPoints.length.toLocaleString("pt-PT"));
    setText(
      "minElevation",
      elevations.length ? `${Math.round(Math.min(...elevations))} m` : "N/D"
    );
    setText(
      "maxElevation",
      elevations.length ? `${Math.round(Math.max(...elevations))} m` : "N/D"
    );
    setText("status", "Dados carregados com sucesso.");
  };

  const renderElevationChart = elevationData => {
    if (typeof Chart === "undefined") {
      throw new Error("Chart.js não foi carregado.");
    }

    const canvas = byId("elevationChart");
    if (!canvas) throw new Error("Não foi encontrado #elevationChart.");

    const sampledData = downsample(elevationData);
    const previousChart = Chart.getChart(canvas);
    if (previousChart) previousChart.destroy();

    elevationChart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: sampledData.map(point => point.distanceKm.toFixed(2)),
        datasets: [
          {
            label: "Elevação",
            data: sampledData.map(point => point.elevation),
            borderColor: "#2d5016",
            backgroundColor: "rgba(45, 80, 22, 0.20)",
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 14,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "#8b4513",
            pointHoverBorderColor: "#ffffff",
            pointHoverBorderWidth: 2,
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          intersect: false,
          mode: "index"
        },
        onHover: (_event, elements) => {
          if (!elements.length) {
            removeMapMarker();
            return;
          }

          const sampledPoint = sampledData[elements[0].index];
          if (!sampledPoint) return;

          const exactPoint = nearestTrackPoint(sampledPoint.distanceKm * 1000);
          updateMapMarker(exactPoint);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            displayColors: false,
            backgroundColor: "rgba(31, 61, 43, 0.95)",
            callbacks: {
              title: items => {
                const point = sampledData[items[0]?.dataIndex];
                return point ? `${point.distanceKm.toFixed(2)} km` : "";
              },
              label: context => `${Math.round(context.raw)} m`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: "km" },
            grid: { display: false },
            ticks: { maxTicksLimit: 5 }
          },
          y: {
            title: { display: true, text: "m" },
            ticks: { maxTicksLimit: 4 }
          }
        }
      }
    });

    canvas.addEventListener("mouseleave", removeMapMarker);
    canvas.addEventListener("touchend", removeMapMarker, { passive: true });
  };

  const initialise = async () => {
    const mapElement = byId("map");
    const status = byId("status");

    if (!mapElement) return;

    if (typeof L === "undefined") {
      if (status) status.textContent = "Leaflet não foi carregado.";
      return;
    }

    const gpxUrl = mapElement.dataset.gpx;
    if (!gpxUrl) {
      if (status) status.textContent = "O elemento #map não define data-gpx.";
      return;
    }

    map = L.map(mapElement, { preferCanvas: false }).setView([41.2, -8.3], 12);

    const layers = {
      Rua: L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, attribution: "&copy; OpenStreetMap" }
      ),
      Satélite: L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "&copy; Esri" }
      ),
      Topográfico: L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        { maxZoom: 17, attribution: "&copy; OpenTopoMap" }
      )
    };

    layers.Rua.addTo(map);
    L.control.layers(layers, null, { position: "bottomleft" }).addTo(map);

    try {
      const response = await fetch(gpxUrl);
      if (!response.ok) {
        throw new Error(`GPX não encontrado: HTTP ${response.status}`);
      }

      const xml = new DOMParser().parseFromString(
        await response.text(),
        "application/xml"
      );

      if (xml.querySelector("parsererror")) {
        throw new Error("O ficheiro GPX não contém XML válido.");
      }

      const segments = parseGpx(xml);
      const trackData = buildTrackData(segments);
      trackPoints = trackData.allPoints;

      if (trackPoints.length < 2) {
        throw new Error("O GPX não contém pontos suficientes.");
      }

      renderTrack(segments);
      updateStats(trackData);

      if (trackData.elevationData.length > 1) {
        renderElevationChart(trackData.elevationData);
      } else {
        const chartContainer = byId("pip-chart-container");
        if (chartContainer) chartContainer.hidden = true;
      }

      window.setTimeout(() => map.invalidateSize(), 100);
    } catch (error) {
      console.error("Erro ao carregar o percurso:", error);
      if (status) {
        status.textContent = `Não foi possível carregar o GPX: ${error.message}`;
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
