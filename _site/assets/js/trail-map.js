window.TrilhosMap = {
  async init(config) {
    const status = document.querySelector("#status");
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };

    if (typeof L === "undefined") {
      if (status) status.textContent = "Leaflet não foi carregado.";
      return;
    }

    const map = L.map("map").setView([41.2, -8.3], 12);
    const layers = {
      Rua: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }),
      Satélite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "&copy; Esri"
      }),
      Topográfico: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        attribution: "&copy; OpenTopoMap"
      })
    };
    layers.Rua.addTo(map);
    L.control.layers(layers).addTo(map);

    const nodeText = (node, tag) => node?.getElementsByTagName(tag)[0]?.textContent?.trim() || null;
    const haversine = (a, b) => {
      const radius = 6371000;
      const radians = value => value * Math.PI / 180;
      const lat = radians(b.lat - a.lat);
      const lon = radians(b.lon - a.lon);
      const value = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lon / 2) ** 2;
      return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    };

    try {
      const response = await fetch(config.gpxUrl);
      if (!response.ok) throw new Error(`GPX não encontrado: HTTP ${response.status}`);
      const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
      if (xml.querySelector("parsererror")) throw new Error("O ficheiro GPX não contém XML válido.");

      let sourceSegments = [...xml.getElementsByTagName("trkseg")];
      if (!sourceSegments.length) sourceSegments = [...xml.getElementsByTagName("rte")];
      if (!sourceSegments.length) throw new Error("O GPX não contém segmentos ou rotas.");

      const segments = sourceSegments.map(segment => {
        let nodes = [...segment.getElementsByTagName("trkpt")];
        if (!nodes.length) nodes = [...segment.getElementsByTagName("rtept")];
        return nodes.map(node => {
          const rawElevation = nodeText(node, "ele");
          const elevation = Number.parseFloat(rawElevation);
          const rawTime = nodeText(node, "time");
          return {
            lat: Number.parseFloat(node.getAttribute("lat")),
            lon: Number.parseFloat(node.getAttribute("lon")),
            ele: Number.isFinite(elevation) ? elevation : null,
            time: rawTime ? new Date(rawTime) : null
          };
        }).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
      }).filter(segment => segment.length);

      const points = segments.flat();
      if (points.length < 2) throw new Error("O GPX não contém pontos suficientes.");

      let total = 0;
      let gain = 0;
      let loss = 0;
      const elevationProfile = [];

      segments.forEach(segment => {
        segment.forEach((point, index) => {
          if (index > 0) {
            const previous = segment[index - 1];
            total += haversine(previous, point);
            if (Number.isFinite(point.ele) && Number.isFinite(previous.ele)) {
              const delta = point.ele - previous.ele;
              if (delta > 0) gain += delta;
              else loss += Math.abs(delta);
            }
          }
          point.distance = total;
          if (Number.isFinite(point.ele)) elevationProfile.push({ x: total / 1000, y: point.ele });
        });
      });

      const lineGroup = L.featureGroup(
        segments.map(segment => L.polyline(segment.map(point => [point.lat, point.lon]), {
          color: "#2d5016", weight: 4, opacity: 0.9
        }))
      ).addTo(map);
      L.marker([points[0].lat, points[0].lon]).addTo(map).bindPopup("Início");
      L.marker([points.at(-1).lat, points.at(-1).lon]).addTo(map).bindPopup("Fim");
      map.fitBounds(lineGroup.getBounds(), { padding: [40, 40] });

      const elevations = points.map(point => point.ele).filter(Number.isFinite);
      const timedPoints = points.filter(point => point.time && !Number.isNaN(point.time.getTime()));

      setText("distance", `${(total / 1000).toFixed(2)} km`);
      setText("elevationGain", `${Math.round(gain)} m`);
      setText("elevationLoss", `${Math.round(loss)} m`);
      setText("points", points.length.toLocaleString("pt-PT"));
      setText("minElevation", elevations.length ? `${Math.round(Math.min(...elevations))} m` : "N/D");
      setText("maxElevation", elevations.length ? `${Math.round(Math.max(...elevations))} m` : "N/D");

      if (timedPoints.length > 1) {
        const minutes = Math.round((timedPoints.at(-1).time - timedPoints[0].time) / 60000);
        setText("duration", `${Math.floor(minutes / 60)}h ${minutes % 60}m`);
      } else {
        setText("duration", "N/D");
      }

      if (status) status.textContent = "Dados carregados com sucesso.";

      if (elevationProfile.length > 1 && typeof Chart !== "undefined") {
        new Chart(document.querySelector("#elevationChart"), {
          type: "line",
          data: { datasets: [{ data: elevationProfile, borderColor: "#2d5016", backgroundColor: "rgba(45,80,22,.2)", fill: true, pointRadius: 0, tension: 0.25 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { type: "linear", title: { display: true, text: "km" } },
              y: { title: { display: true, text: "m" } }
            }
          }
        });
      }
    } catch (error) {
      if (status) status.textContent = `Não foi possível carregar o GPX: ${error.message}`;
    }
  }
};
