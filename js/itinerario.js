import { DAYS, PLANS } from "./plans-data.js";
import { firebaseConfig } from "./firebase-config.js";

const statusEl = document.getElementById("syncStatus");

let state = { day1: [], day2: [], day3: [], day4: [], day5: [] };
let firebaseReady = false;
let docRef = null;
let persistTimer = null;
let dragInfo = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyState() {
  return { day1: [], day2: [], day3: [], day4: [], day5: [] };
}

/* ---------- Render ---------- */

function render() {
  for (const { day } of DAYS) {
    const list = document.getElementById("list-" + day);
    if (!list) continue;
    list.innerHTML = "";
    const items = state["day" + day] || [];
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "itin-empty";
      empty.textContent = "Arrastra aquí un plan";
      list.appendChild(empty);
    }
    items.forEach((item, idx) => {
      const plan = PLANS.find((p) => p.slug === item.slug);
      if (!plan) return;
      const li = document.createElement("li");
      li.className = "itin-item";
      li.draggable = true;
      li.dataset.id = item.id;
      li.dataset.day = day;
      li.dataset.index = idx;
      li.innerHTML =
        '<div class="row">' +
        '<span class="tag-mini' + (plan.tagClass ? " " + plan.tagClass : "") + '">' + plan.tag + "</span>" +
        '<button class="remove-btn" data-remove="1" title="Quitar del día" aria-label="Quitar">✕</button>' +
        "</div>" +
        '<a class="item-title" href="' + plan.href + '" target="_blank" rel="noopener">' + plan.title + "</a>" +
        '<span class="item-int">' + plan.intensity + "</span>";
      list.appendChild(li);
    });
  }
  renderBank();
}

function renderBank() {
  const container = document.getElementById("bankGroups");
  if (!container) return;
  container.innerHTML = "";
  for (const { day, label, sub } of DAYS) {
    const group = document.createElement("div");
    group.className = "bank-group";
    group.innerHTML = '<h3>Día ' + day + " · " + label + " · " + sub + "</h3>";
    const wrap = document.createElement("div");
    wrap.className = "bank-chips";
    PLANS.filter((p) => p.day === day).forEach((plan) => {
      const chip = document.createElement("div");
      chip.className = "bank-chip";
      chip.draggable = true;
      chip.dataset.slug = plan.slug;
      chip.innerHTML =
        '<span class="tag-mini' + (plan.tagClass ? " " + plan.tagClass : "") + '">' + plan.tag + "</span>" +
        '<span class="chip-title">' + plan.title + "</span>" +
        '<span class="item-int">' + plan.intensity + "</span>";
      wrap.appendChild(chip);
    });
    group.appendChild(wrap);
    container.appendChild(group);
  }
}

/* ---------- Drag & drop ---------- */

function getDragAfterElement(list, y) {
  const items = [...list.querySelectorAll(".itin-item:not(.dragging)")];
  return items.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: -Infinity, element: null }
  ).element;
}

function initDragEvents() {
  document.addEventListener("dragstart", (e) => {
    const bankChip = e.target.closest(".bank-chip");
    const itinItem = e.target.closest(".itin-item");
    if (bankChip) {
      dragInfo = { slug: bankChip.dataset.slug, from: "bank" };
    } else if (itinItem) {
      dragInfo = { id: itinItem.dataset.id, from: "day", fromDay: Number(itinItem.dataset.day) };
      itinItem.classList.add("dragging");
    } else {
      dragInfo = null;
      return;
    }
    e.dataTransfer.effectAllowed = "move";
  });

  document.addEventListener("dragend", () => {
    document.querySelectorAll(".itin-item.dragging").forEach((el) => el.classList.remove("dragging"));
    document.querySelectorAll(".itin-list.drag-over").forEach((el) => el.classList.remove("drag-over"));
    dragInfo = null;
  });

  document.querySelectorAll(".itin-list").forEach((list) => {
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      list.classList.add("drag-over");
    });
    list.addEventListener("dragleave", (e) => {
      if (e.target === list) list.classList.remove("drag-over");
    });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      list.classList.remove("drag-over");
      if (!dragInfo) return;
      const day = Number(list.dataset.day);
      const afterEl = getDragAfterElement(list, e.clientY);
      const insertIndex = afterEl ? Number(afterEl.dataset.index) : (state["day" + day] || []).length;

      if (dragInfo.from === "bank") {
        const newItem = { id: uid(), slug: dragInfo.slug };
        state["day" + day] = state["day" + day] || [];
        state["day" + day].splice(insertIndex, 0, newItem);
      } else if (dragInfo.from === "day") {
        const fromDay = dragInfo.fromDay;
        const fromArr = state["day" + fromDay] || [];
        const srcIdx = fromArr.findIndex((it) => it.id === dragInfo.id);
        if (srcIdx === -1) return;
        const [moved] = fromArr.splice(srcIdx, 1);
        let idx = insertIndex;
        if (fromDay === day && srcIdx < idx) idx -= 1;
        state["day" + day] = state["day" + day] || [];
        state["day" + day].splice(idx, 0, moved);
      }
      persist();
      render();
    });
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    const li = btn.closest(".itin-item");
    const day = Number(li.dataset.day);
    const id = li.dataset.id;
    state["day" + day] = (state["day" + day] || []).filter((it) => it.id !== id);
    persist();
    render();
  });
}

/* ---------- Firebase (opcional: sincroniza si hay config) ---------- */

/* Mientras haya un cambio local sin confirmar en Firestore, ignoramos
   los snapshots remotos entrantes: si no, un snapshot que aún no
   refleja nuestro último cambio (por ejemplo, el primero, con el
   documento todavía vacío) podría sobrescribir en pantalla — y luego
   en la propia base de datos — la edición que el usuario acaba de hacer. */
let dirty = false;

function persist() {
  if (!firebaseReady) return;
  dirty = true;
  clearTimeout(persistTimer);
  const pending = state;
  persistTimer = setTimeout(async () => {
    try {
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
      await setDoc(docRef, pending);
      if (state === pending) dirty = false;
    } catch (err) {
      console.error("Error guardando itinerario en Firebase", err);
      statusEl.textContent = "⚠️ No se pudo guardar — revisad la conexión";
    }
  }, 250);
}

async function initFirebase() {
  const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
  if (!isConfigured) {
    statusEl.textContent = "⚙️ Firebase sin configurar — de momento el orden solo se guarda en este navegador. Ver js/firebase-config.js.";
    return;
  }
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js");
    const { getFirestore, doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    docRef = doc(db, "itinerario", "plan");
    firebaseReady = true;
    onSnapshot(
      docRef,
      (snap) => {
        if (dirty) return; // hay una edición local sin confirmar: no la pisamos
        state = snap.exists() ? snap.data() : emptyState();
        render();
        statusEl.textContent = "✓ Sincronizado con el grupo";
      },
      (err) => {
        console.error("Error de Firestore", err);
        firebaseReady = false;
        statusEl.textContent = "⚠️ Sin conexión a la base de datos (revisad las reglas de Firestore) — de momento el orden solo se guarda en este navegador";
      }
    );
  } catch (err) {
    console.error("Error inicializando Firebase", err);
    statusEl.textContent = "⚠️ Error cargando Firebase — revisad js/firebase-config.js";
  }
}

/* El banco y el tablero se pintan de inmediato con el estado local
   (vacío) para que la página nunca se quede en blanco esperando a
   Firebase; onSnapshot los repinta en cuanto llega el estado real. */
render();
initDragEvents();
initFirebase();
