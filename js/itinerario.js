import { DAYS, PLANS } from "./plans-data.js";
import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
const FIREBASE_FIRESTORE_URL = "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const statusEl = document.getElementById("syncStatus");
const saveStatusEl = document.getElementById("saveStatus");
const nameInput = document.getElementById("proposalName");
const saveBtn = document.getElementById("saveProposalBtn");
const proposalsListEl = document.getElementById("proposalsList");
const customTitleInput = document.getElementById("customTitle");
const customAuthorInput = document.getElementById("customAuthor");
const customDetailsInput = document.getElementById("customDetails");
const saveCustomBtn = document.getElementById("saveCustomBtn");
const customStatusEl = document.getElementById("customStatus");
const customPlansGridEl = document.getElementById("customPlansGrid");

let state = { day1: [], day2: [], day3: [], day4: [], day5: [] };
let firebaseReady = false;
let db = null;
let boardDocRef = null;
let persistTimer = null;
let dragInfo = null;
let dirty = false;
let proposals = []; // [{id, name, itinerary, votes, createdAt}]
let customPlans = []; // [{id, title, author, details, createdAt}]

const VOTER_KEY = "itin-voter-id";
const NAME_KEY = "itin-your-name";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function emptyState() {
  return { day1: [], day2: [], day3: [], day4: [], day5: [] };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Orden fijo y mezclado del banco: es un planificador, no hay que
   respetar el día original de cada plan. Se baraja una sola vez al
   cargar para que el orden no salte con cada re-render. */
const BANK_ORDER = shuffle(PLANS);

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

/* Busca un plan tanto entre los 20 oficiales como entre las propuestas
   de plan guardadas por el grupo, para que un item del tablero (o de
   una propuesta de itinerario) pueda referenciar cualquiera de los dos. */
function findPlan(slug) {
  const official = PLANS.find((p) => p.slug === slug);
  if (official) return official;
  const custom = customPlans.find((p) => p.id === slug);
  if (!custom) return null;
  return {
    slug: custom.id,
    title: custom.title,
    tag: "Propuesta de " + custom.author,
    tagClass: "proposed",
    intensity: "",
    href: null,
    description: custom.details,
    facts: [],
    isCustom: true
  };
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
      const plan = findPlan(item.slug);
      if (!plan) return;
      const li = document.createElement("li");
      li.className = "itin-item" + (plan.isCustom ? " proposed-item" : "");
      li.draggable = true;
      li.dataset.id = item.id;
      li.dataset.day = day;
      li.dataset.index = idx;
      const titleHtml = plan.href
        ? '<a class="item-title" href="' + plan.href + '" target="_blank" rel="noopener">' + escapeHtml(plan.title) + "</a>"
        : '<span class="item-title">' + escapeHtml(plan.title) + "</span>";
      li.innerHTML =
        '<div class="row">' +
        '<span class="tag-mini' + (plan.tagClass ? " " + plan.tagClass : "") + '">' + escapeHtml(plan.tag) + "</span>" +
        '<button class="remove-btn" data-remove="1" title="Quitar del día" aria-label="Quitar">✕</button>' +
        "</div>" +
        titleHtml +
        (plan.intensity ? '<span class="item-int">' + plan.intensity + "</span>" : "");
      list.appendChild(li);
    });
  }
  renderBank();
  renderCustomPlans();
}

/* ---------- Banco de planes: mismas cards que la home ---------- */

function renderBank() {
  const container = document.getElementById("bankGroups");
  if (!container) return;
  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "options";
  BANK_ORDER.forEach((plan) => {
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
      '<div class="card-bottom">' +
      '<a class="btn btn-primary" href="' + plan.href + '" target="_blank" rel="noopener">Ver plan detallado →</a>' +
      '<button class="btn btn-ghost add-day-btn" type="button" data-slug="' + plan.slug + '">📅 Añadir a un día</button>' +
      "</div>";
    grid.appendChild(article);
  });
  container.appendChild(grid);
}

/* ---------- Propón un plan: cards de la misma familia, en otro color ---------- */

function renderCustomPlans() {
  if (!customPlansGridEl) return;
  customPlansGridEl.innerHTML = "";
  if (!customPlans.length) {
    const empty = document.createElement("p");
    empty.className = "custom-empty";
    empty.textContent = "Todavía no hay planes propuestos por el grupo.";
    customPlansGridEl.appendChild(empty);
    return;
  }
  customPlans.forEach((plan) => {
    const article = document.createElement("article");
    article.className = "card bank-plan-card proposed-plan-card in";
    article.draggable = true;
    article.dataset.slug = plan.id;
    article.innerHTML =
      '<div class="card-top"><span class="tag proposed">Propuesta de ' + escapeHtml(plan.author) + "</span></div>" +
      "<h3>" + escapeHtml(plan.title) + "</h3>" +
      "<p>" + escapeHtml(plan.details) + "</p>" +
      '<div class="card-bottom">' +
      '<button class="btn btn-ghost add-day-btn" type="button" data-slug="' + plan.id + '">📅 Añadir a un día</button>' +
      "</div>";
    customPlansGridEl.appendChild(article);
  });
}

async function saveCustomPlan() {
  const title = customTitleInput.value.trim();
  const author = customAuthorInput.value.trim();
  const details = customDetailsInput.value.trim();
  if (!title || !author || !details) {
    customStatusEl.textContent = "Rellena nombre del plan, tu nombre y los detalles.";
    return;
  }
  localStorage.setItem(NAME_KEY, author);
  const firestoreMod = await initFirebase();
  if (!firestoreMod || !db) {
    customStatusEl.textContent = "⚠️ Firebase sin configurar — no se puede guardar todavía.";
    return;
  }
  saveCustomBtn.disabled = true;
  customStatusEl.textContent = "Guardando…";
  try {
    await firestoreMod.addDoc(firestoreMod.collection(db, "planes-propuestos"), {
      title,
      author,
      details,
      createdAt: firestoreMod.serverTimestamp()
    });
    customStatusEl.textContent = "✓ Plan propuesto guardado";
    customTitleInput.value = "";
    customDetailsInput.value = "";
  } catch (err) {
    console.error("Error guardando el plan propuesto", err);
    customStatusEl.textContent = "⚠️ No se pudo guardar — revisad la conexión";
  } finally {
    saveCustomBtn.disabled = false;
  }
}

async function subscribeCustomPlans() {
  const firestoreMod = await initFirebase();
  if (!firestoreMod) return;
  const col = firestoreMod.collection(db, "planes-propuestos");
  firestoreMod.onSnapshot(
    col,
    (snap) => {
      customPlans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error("Error cargando planes propuestos", err);
    }
  );
}

function initCustomUI() {
  if (!saveCustomBtn) return;
  const savedName = localStorage.getItem(NAME_KEY);
  if (savedName) customAuthorInput.value = savedName;
  saveCustomBtn.addEventListener("click", saveCustomPlan);
}

/* ---------- Botón "Añadir a un día" (alternativa a arrastrar) ---------- */

let dayPopover = null;
let popoverTargetSlug = null;

function buildDayPopover() {
  const pop = document.createElement("div");
  pop.className = "day-popover";
  pop.hidden = true;
  pop.innerHTML =
    '<p class="day-popover-title">¿Qué día?</p>' +
    '<div class="day-popover-options">' +
    DAYS.map(({ day, label, sub }) =>
      '<button type="button" data-day="' + day + '">' + label + " · " + sub + "</button>"
    ).join("") +
    "</div>";
  document.body.appendChild(pop);
  return pop;
}

function openDayPopover(button, slug) {
  popoverTargetSlug = slug;
  dayPopover.hidden = false;
  const btnRect = button.getBoundingClientRect();
  const popRect = dayPopover.getBoundingClientRect();
  let top = btnRect.bottom + 8;
  let left = btnRect.left;
  if (left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
  if (left < 12) left = 12;
  if (top + popRect.height > window.innerHeight - 12) top = btnRect.top - popRect.height - 8;
  dayPopover.style.top = top + "px";
  dayPopover.style.left = left + "px";
}

function closeDayPopover() {
  if (!dayPopover) return;
  dayPopover.hidden = true;
  popoverTargetSlug = null;
}

function addPlanToDay(slug, day) {
  const newItem = { id: uid(), slug };
  state["day" + day] = state["day" + day] || [];
  state["day" + day].push(newItem);
  persistBoard();
  render();
  const board = document.querySelector(".itin-board");
  if (board) board.scrollIntoView({ behavior: "smooth", block: "start" });
  const newLi = document.querySelector('.itin-item[data-id="' + newItem.id + '"]');
  if (newLi) {
    newLi.classList.add("just-added");
    setTimeout(() => newLi.classList.remove("just-added"), 1500);
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
      return;
    }
    const addBtn = e.target.closest(".add-day-btn");
    if (addBtn) {
      e.stopPropagation();
      const slug = addBtn.dataset.slug;
      if (!dayPopover.hidden && popoverTargetSlug === slug) {
        closeDayPopover();
      } else {
        openDayPopover(addBtn, slug);
      }
      return;
    }
    const dayChoice = e.target.closest(".day-popover-options button");
    if (dayChoice) {
      if (popoverTargetSlug) addPlanToDay(popoverTargetSlug, Number(dayChoice.dataset.day));
      closeDayPopover();
      return;
    }
    if (dayPopover && !dayPopover.hidden) closeDayPopover();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDayPopover();
  });
  window.addEventListener("scroll", closeDayPopover, true);
  window.addEventListener("resize", closeDayPopover);
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
  return items.map((it) => findPlan(it.slug)).filter(Boolean);
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
dayPopover = buildDayPopover();
render();
renderProposals();
initDragEvents();
initProposalUI();
initCustomUI();
subscribeBoard();
subscribeProposals();
subscribeCustomPlans();
