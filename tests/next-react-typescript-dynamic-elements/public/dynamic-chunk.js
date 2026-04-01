// Simulates a Turbopack-style chunk that gets loaded via createElement("script")
(function () {
  window.__DYNAMIC_CHUNK_LOADED__ = true;
  var el = document.getElementById("chunk-status");
  if (el) {
    el.textContent = "dynamic-chunk.js loaded!";
    el.style.color = "green";
  }
})();
