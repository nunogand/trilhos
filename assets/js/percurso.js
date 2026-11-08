document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.querySelector("#map");

  if (mapElement && window.TrilhosMap) {
    window.TrilhosMap.init({
      title: mapElement.dataset.title,
      folder: mapElement.dataset.folder,
      gpxUrl: mapElement.dataset.gpx
    });
  }

  window.TrilhosGallery?.init();
});
