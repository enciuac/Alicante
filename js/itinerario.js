import { DAYS, PLANS } from "./plans-data.js";
import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
const FIREBASE_FIRESTORE_URL = "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const statusEl = document.getElementById("syncStatus");
const saveStatusEl = document.getElementById("saveStatus");
const nameInput = document.getElementById("proposalName");
const saveBtn = document.getElementById("saveProposalBtn");
const proposalsListEl = document.getElementById("proposalsList");

let state = { day1: [], day2: [], day3: [], day4: [], day5: [] };
let firebaseReady = false;
let db = null;
let boardDocRef = null;
let persistTimer = null;
let dragInfo = null;
let dirty = false;
let proposals = []; // [{id, name, itinerary, votes, createdAt}]

const VOTER_KEY = "itin-voter-id";
const NAME_KEY = "itin-your-name";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyState() {
  return { day1: [], day2: [], day3: [], day4: [], day5: [] };
}

function getVoterId() {
  let id = localStorage.getItem(VOTER_KEY);
  if (!id) {
    id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : uid();
    localStorage.setItem(VOTER_KEY, id);
  }
  return id;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/* ---------- Tablero: render ---------- */

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

/* ---------- Banco de planes: mismas cards que la home ---------- */

function renderBank() {
  if (!proposalsListEl && !document.getElementById("bankGroups")) return;
  const container = document.getElementById("bankGroups");
  if (!container) return;
  container.innerHTML = "";
  for (const { day, label, sub } of DAYS) {
    const title = document.createElement("h3");
    title.className = "bank-day-title";
    title.textContent = "Día " + day + " · " + label + " · " + sub;
    container.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "options";
    PLANS.filter((p) => p.day === day).forEach((plan) => {
      const article = document.createElement("article");
      article.className = "card bank-plan-card in" + (plan.tagClass === "epic" ? " epic-card" : "");
      article.draggable = true;
      article.dataset.slug = plan.slug;
      article.innerHTML =
        '<div class="card-top"><span class="tag' + (plan.tagClass ? " " + plan.tagClass : "") + '">' + plan.tag + "</span>" +
        '<span class="intensity">' + plan.intensity + "</span></div>" +
        "<h3>" + plan.title + "</h3>" +
        "<p>" + plan.description + "</p>" +
        '<ul class="facts">' + plan.facts.map((f) => "<li>" + f + "</li>").join("") + "</ul>" +
        '<div class="card-bottom"><a class="btn btn-primary" href="' + plan.href + '" target="_blank" rel="noopener">Ver plan detallado →</a></div>';
      grid.appendChild(article);
    });
    container.appendChild(grid);
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
    const bankCard = e.target.closest(".bank-plan-card");
    const itinItem = e.target.closest(".itin-item");
    if (bankCard) {
      dragInfo = { slug: bankCard.dataset.slug, from: "bank" };
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
      persistBoard();
      render();
    });
  });

  document.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      const li = removeBtn.closest(".itin-item");
      const day = Number(li.dataset.day);
      const id = li.dataset.id;
      state["day" + day] = (state["day" + day] || []).filter((it) => it.id !== id);
      persistBoard();
      render();
      return;
    }
    const voteBtn = e.target.closest("[data-vote]");
    if (voteBtn) {
      const card = voteBtn.closest(".proposal-card");
      vote(card.dataset.id, voteBtn.dataset.vote);
    }
  });
}

/* ---------- Firebase (compartido entre tablero y propuestas) ---------- */

let firebaseInitPromise = null;

function initFirebase() {
  if (firebaseInitPromise) return firebaseInitPromise;
  firebaseInitPromise = (async () => {
    const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
    if (!isConfigured) {
      statusEl.textContent = "⚙️ Firebase sin configurar — de momento el orden solo se guarda en este navegador. Ver js/firebase-config.js.";
      return null;
    }
    try {
      const { initializeApp } = await import(FIREBASE_APP_URL);
      const firestoreMod = await import(FIREBASE_FIRESTORE_URL);
      const app = initializeApp(firebaseConfig);
      db = firestoreMod.getFirestore(app);
      firebaseReady = true;
      return firestoreMod;
    } catch (err) {
      console.error("Error inicializando Firebase", err);
      statusEl.textContent = "⚠️ Error cargando Firebase — revisad js/firebase-config.js";
      return null;
    }
  })();
  return firebaseInitPromise;
}

/* ---------- Tablero compartido: persistencia ---------- */

function persistBoard() {
  /* dirty se marca YA, antes de saber si Firebase está listo: si no,
     una edición local hecha mientras Firebase todavía está cargando
     podría perderse en cuanto llegue el primer snapshot remoto. */
  dirty = true;
  clearTimeout(persistTimer);
  const pending = state;
  persistTimer = setTimeout(async () => {
    try {
      const firestoreMod = await initFirebase();
      if (!firestoreMod) return; // Firebase sin configurar: solo local
      if (!boardDocRef) boardDocRef = firestoreMod.doc(db, "itinerario", "plan");
      await firestoreMod.setDoc(boardDocRef, pending);
      if (state === pending) dirty = false;
    } catch (err) {
      console.error("Error guardando itinerario en Firebase", err);
      statusEl.textContent = "⚠️ No se pudo guardar — revisad la conexión";
    }
  }, 250);
}

async function subscribeBoard() {
  const firestoreMod = await initFirebase();
  if (!firestoreMod) return;
  boardDocRef = firestoreMod.doc(db, "itinerario", "plan");
  firestoreMod.onSnapshot(
    boardDocRef,
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
}

/* ---------- Propuestas: guardar, listar y votar ---------- */

function proposalDayItems(itinerary, day) {
  const items = (itinerary && itinerary["day" + day]) || [];
  return items
    .map((it) => PLANS.find((p) => p.slug === it.slug))
    .filter(Boolean);
}

function formatDate(ts) {
  if (!ts || typeof ts.toDate !== "function") return "justo ahora";
  const d = ts.toDate();
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function renderProposals() {
  if (!proposalsListEl) return;
  proposalsListEl.innerHTML = "";
  if (!proposals.length) {
    const empty = document.createElement("p");
    empty.className = "proposals-empty";
    empty.textContent = "Todavía no hay propuestas guardadas. ¡Sé el primero!";
    proposalsListEl.appendChild(empty);
    return;
  }
  const voterId = getVoterId();
  const sorted = [...proposals].sort((a, b) => {
    const scoreA = countVotes(a.votes, "like") - countVotes(a.votes, "dislike");
    const scoreB = countVotes(b.votes, "like") - countVotes(b.votes, "dislike");
    return scoreB - scoreA;
  });

  sorted.forEach((p) => {
    const card = document.createElement("div");
    card.className = "proposal-card";
    card.dataset.id = p.id;
    const myVote = p.votes ? p.votes[voterId] : undefined;
    const likeCount = countVotes(p.votes, "like");
    const dislikeCount = countVotes(p.votes, "dislike");

    const daysHtml = DAYS.map(({ day, label }) => {
      const plans = proposalDayItems(p.itinerary, day);
      const list = plans.length
        ? plans.map((pl) => "<li>" + escapeHtml(pl.title) + "</li>").join("")
        : '<li class="pd-empty">—</li>';
      return '<div class="proposal-day"><span class="pd-label">' + label + '</span><ul>' + list + "</ul></div>";
    }).join("");

    card.innerHTML =
      '<div class="proposal-head"><h3>' + escapeHtml(p.name) + '</h3><span class="proposal-date">' + formatDate(p.createdAt) + "</span></div>" +
      '<div class="proposal-days">' + daysHtml + "</div>" +
      '<div class="vote-row">' +
      '<button class="vote-btn like' + (myVote === "like" ? " active" : "") + '" data-vote="like">👍 <span>' + likeCount + "</span></button>" +
      '<button class="vote-btn dislike' + (myVote === "dislike" ? " active" : "") + '" data-vote="dislike">👎 <span>' + dislikeCount + "</span></button>" +
      "</div>";
    proposalsListEl.appendChild(card);
  });
}

function countVotes(votes, choice) {
  if (!votes) return 0;
  return Object.values(votes).filter((v) => v === choice).length;
}

async function vote(proposalId, choice) {
  const firestoreMod = await initFirebase();
  if (!firestoreMod || !db) return;
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!proposal) return;
  const voterId = getVoterId();
  const current = proposal.votes ? proposal.votes[voterId] : undefined;
  const ref = firestoreMod.doc(db, "propuestas", proposalId);
  const field = "votes." + voterId;
  try {
    if (current === choice) {
      await firestoreMod.updateDoc(ref, { [field]: firestoreMod.deleteField() });
    } else {
      await firestoreMod.updateDoc(ref, { [field]: choice });
    }
  } catch (err) {
    console.error("Error al votar", err);
  }
}

async function subscribeProposals() {
  const firestoreMod = await initFirebase();
  if (!firestoreMod) return;
  const col = firestoreMod.collection(db, "propuestas");
  firestoreMod.onSnapshot(
    col,
    (snap) => {
      proposals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderProposals();
    },
    (err) => {
      console.error("Error cargando propuestas", err);
    }
  );
}

async function saveProposal() {
  const name = nameInput.value.trim();
  if (!name) {
    saveStatusEl.textContent = "Escribe tu nombre antes de guardar.";
    nameInput.focus();
    return;
  }
  localStorage.setItem(NAME_KEY, name);
  const firestoreMod = await initFirebase();
  if (!firestoreMod || !db) {
    saveStatusEl.textContent = "⚠️ Firebase sin configurar — no se puede guardar la propuesta todavía.";
    return;
  }
  saveBtn.disabled = true;
  saveStatusEl.textContent = "Guardando…";
  try {
    await firestoreMod.addDoc(firestoreMod.collection(db, "propuestas"), {
      name,
      itinerary: state,
      votes: {},
      createdAt: firestoreMod.serverTimestamp()
    });
    saveStatusEl.textContent = "✓ Propuesta guardada como \"" + name + "\"";
  } catch (err) {
    console.error("Error guardando la propuesta", err);
    saveStatusEl.textContent = "⚠️ No se pudo guardar la propuesta — revisad la conexión";
  } finally {
    saveBtn.disabled = false;
  }
}

function initProposalUI() {
  if (!saveBtn) return;
  const savedName = localStorage.getItem(NAME_KEY);
  if (savedName) nameInput.value = savedName;
  saveBtn.addEventListener("click", saveProposal);
}

/* El banco y el tablero se pintan de inmediato con el estado local
   (vacío) para que la página nunca se quede en blanco esperando a
   Firebase; los onSnapshot los repintan en cuanto llega el estado real. */
render();
renderProposals();
initDragEvents();
initProposalUI();
subscribeBoard();
subscribeProposals();
