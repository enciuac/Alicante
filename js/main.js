(function () {
  "use strict";

  /* Almacenamiento seguro: si localStorage no está disponible
     (navegación privada, sandbox...), la web sigue funcionando. */
  var mem = {};
  var store = {
    get: function (k) {
      try { return window.localStorage.getItem(k); } catch (e) { return mem[k] || null; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, v); } catch (e) { mem[k] = v; }
    }
  };

  function safe(fn, name) {
    try { fn(); } catch (err) { console.error("Error en " + name, err); }
  }

  /* ---------- INDEX: revelar tarjetas al hacer scroll ---------- */
  function initReveal() {
    var cards = document.querySelectorAll(".card");
    if (!cards.length) return;
    if (!("IntersectionObserver" in window)) {
      cards.forEach(function (c) { c.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.05 });
    cards.forEach(function (c, i) {
      c.style.transitionDelay = (i % 3) * 80 + "ms";
      io.observe(c);
    });
    /* Red de seguridad: nada queda oculto pase lo que pase. */
    setTimeout(function () {
      cards.forEach(function (c) { c.classList.add("in"); });
    }, 6000);
  }

  /* ---------- INDEX: pestaña de día activa ---------- */
  function initNav() {
    var links = document.querySelectorAll(".daynav a");
    var secs = document.querySelectorAll(".day");
    if (!links.length || !secs.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) {
            l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id);
          });
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    secs.forEach(function (s) { io.observe(s); });
  }

  /* ---------- INDEX: pintar selecciones guardadas + resumen ---------- */
  function initSelections() {
    var groups = document.querySelectorAll(".options");
    if (!groups.length) return;
    groups.forEach(function (group) {
      var day = group.getAttribute("data-day");
      var savedSlug = store.get("plan-dia-" + day);
      group.querySelectorAll(".card").forEach(function (card) {
        if (savedSlug && card.getAttribute("data-slug") === savedSlug) {
          card.classList.add("selected");
          var row = document.getElementById("sum" + day);
          if (row) {
            row.classList.remove("empty");
            row.querySelector(".sv").textContent = card.getAttribute("data-value");
          }
        }
      });
    });
  }

  /* ---------- PÁGINA DE PLAN: botón "elegir este plan" ---------- */
  function initChoose() {
    var btn = document.getElementById("choosePlan");
    if (!btn) return;
    var bar = document.getElementById("chooseBar");
    var day = btn.getAttribute("data-day");
    var slug = btn.getAttribute("data-slug");
    if (store.get("plan-dia-" + day) === slug && bar) bar.classList.add("done");
    btn.addEventListener("click", function () {
      store.set("plan-dia-" + day, slug);
      if (bar) bar.classList.add("done");
    });
  }

  /* ---------- PÁGINA DE PLAN: mini galería con lightbox ---------- */
  function initGallery() {
    var gallery = document.querySelector(".gallery");
    if (!gallery) return;
    var figs = Array.prototype.slice.call(gallery.querySelectorAll("figure"));
    if (!figs.length) return;

    var box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML =
      '<button class="lb-close" aria-label="Cerrar">&times;</button>' +
      '<button class="lb-nav lb-prev" aria-label="Anterior">&#8249;</button>' +
      '<img alt="">' +
      '<button class="lb-nav lb-next" aria-label="Siguiente">&#8250;</button>' +
      '<div class="lb-cap"></div>';
    document.body.appendChild(box);

    var lbImg = box.querySelector("img");
    var lbCap = box.querySelector(".lb-cap");
    var current = 0;

    var items = figs.map(function (f) {
      var img = f.querySelector("img");
      var cap = f.querySelector("figcaption");
      return { src: img ? img.getAttribute("src") : "", cap: cap ? cap.textContent : "" };
    });

    function show(i) {
      current = (i + items.length) % items.length;
      lbImg.src = items[current].src;
      lbCap.textContent = items[current].cap;
    }
    function open(i) { show(i); box.classList.add("open"); }
    function close() { box.classList.remove("open"); }

    figs.forEach(function (f, i) {
      f.addEventListener("click", function () { open(i); });
    });
    box.querySelector(".lb-close").addEventListener("click", close);
    box.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); show(current - 1); });
    box.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); show(current + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") show(current + 1);
      else if (e.key === "ArrowLeft") show(current - 1);
    });
  }

  safe(initReveal, "reveal");
  safe(initNav, "nav");
  safe(initSelections, "selections");
  safe(initChoose, "choose");
  safe(initGallery, "gallery");
})();
