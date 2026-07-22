import { DAYS, PLANS } from "./plans-data.js";
import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
const FIREBASE_FIRESTORE_URL = "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
const PERIODS = [
  { key: "manana", label: "🌅 Mañana" },
  { key: "tarde", label: "🌇 Tarde" }
];

const statusEl = document.getElementById("syncStatus");
const saveStatusEl = document.getElementById("saveStatus");
const nameInput = document.getElementById("proposalName");
const passwordInput = document.getElementById("proposalPassword");
const saveBtn = document.getElementById("saveProposalBtn");
const proposalsListEl = document.getElementById("proposalsList");
const customTitleInput = document.getElementById("customTitle");
const customAuthorInput = document.getElementById("customAuthor");
const customDetailsInput = document.getElementById("customDetails");
const customPasswordInput = document.getElementById("customPassword");
const saveCustomBtn = document.getElementById("saveCustomBtn");
const customStatusEl = document.getElementById("customStatus");
const customPlansGridEl = document.getElementById("customPlansGrid");
const bankSearchInput = document.getElementById("bankSearch");
const clearBoardBtn = document.getElementById("clearBoardBtn");

let bankFilter = "";
let state = emptyState();
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
  return {
    day1: { manana: [], tarde: [] },
    day2: { manana: [], tarde: [] },
    day3: { manana: [], tarde: [] },
    day4: { manana: [], tarde: [] },
    day5: { manana: [], tarde: [] }
  };
}

/* Lee los items de una franja soportando el formato antiguo (un array
   plano por día, de antes de separar mañana/tarde): esos planes se
   muestran en "Tarde" para no perderlos. */
function getPeriodItems(dayState, period) {
  if (Array.isArray(dayState)) return period === "tarde" ? dayState : [];
  return (dayState && dayState[period]) || [];
}

/* Igual que getPeriodItems, pero devuelve el array real para poder
   mutarlo, subiendo de formato antiguo a {manana,tarde} si hace falta. */
function ensurePeriodArray(day, period) {
  const key = "day" + day;
  if (Array.isArray(state[key])) {
    state[key] = { manana: [], tarde: state[key] };
  }
  if (!state[key]) state[key] = { manana: [], tarde: [] };
  if (!state[key][period]) state[key][period] = [];
  return state[key][period];
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

/* Hash simple (SHA-256) para no guardar la contraseña en texto plano.
   Es solo protección anti-despiste entre el grupo, no seguridad real:
   las reglas de Firestore siguen abiertas y esto se comprueba en el
   propio navegador, no en un servidor. */
async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

function renderItinItem(item, day, period, idx) {
  const plan = findPlan(item.slug);
  if (!plan) return null;
  const li = document.createElement("li");
  li.className = "itin-item" + (plan.isCustom ? " proposed-item" : "");
  li.draggable = true;
  li.dataset.id = item.id;
  li.dataset.day = day;
  li.dataset.period = period;
  li.dataset.index = idx;
  const titleHtml = plan.href
    ? '<a class="item-title" href="' + plan.href + '" target="_blank" rel="noopener">' + escapeHtml(plan.title) + "</a>"
    : '<span class="item-title">' + escapeHtml(plan.title) + "</span>";
  li.innerHTML =
    '<div class="row">' +
    '<span class="tag-mini' + (plan.tagClass ? " " + plan.tagClass : "") + '">' + escapeHtml(plan.tag) + "</span>" +
    '<button class="remove-btn" data-remove="1" title="Quitar" aria-label="Quitar">✕</button>' +
    "</div>" +
    titleHtml +
    (plan.intensity ? '<span class="item-int">' + plan.intensity + "</span>" : "");
  return li;
}

function render() {
  for (const { day } of DAYS) {
    const dayState = state["day" + day];
    for (const { key: period } of PERIODS) {
      const list = document.getElementById("list-" + day + "-" + period);
      if (!list) continue;
      list.innerHTML = "";
      const items = getPeriodItems(dayState, period);
      if (!items.length) {
        const empty = document.createElement("li");
        empty.className = "itin-empty";
        empty.textContent = "Arrastra aquí un plan";
        list.appendChild(empty);
      }
      items.forEach((item, idx) => {
        const li = renderItinItem(item, day, period, idx);
        if (li) list.appendChild(li);
      });
    }
  }
  renderBank();
  renderCustomPlans();
}

/* ---------- Banco de planes: mismas cards que la home ---------- */

function renderBank() {
  const container = document.getElementById("bankGroups");
  if (!container) return;
  container.innerHTML = "";

  const q = bankFilter.trim().toLowerCase();
  const filtered = !q
    ? BANK_ORDER
    : BANK_ORDER.filter((plan) =>
        plan.title.toLowerCase().includes(q) ||
        plan.tag.toLowerCase().includes(q) ||
        plan.description.toLowerCase().includes(q)
      );

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "custom-empty";
    empty.textContent = "Ningún plan coincide con «" + bankFilter.trim() + "».";
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "options";
  filtered.forEach((plan) => {
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
      '<div class="card-top"><span class="tag proposed">Propuesta de ' + escapeHtml(plan.author) + "</span>" +
      '<button class="delete-btn" data-delete-custom="1" data-id="' + plan.id + '" title="Borrar propuesta de plan" aria-label="Borrar">✕</button></div>' +
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
  const password = customPasswordInput.value;
  if (!title || !author || !details || !password) {
    customStatusEl.textContent = "Rellena nombre del plan, tu nombre, los detalles y una contraseña.";
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
    const passwordHash = await hashPassword(password);
    await firestoreMod.addDoc(firestoreMod.collection(db, "planes-propuestos"), {
      title,
      author,
      details,
      passwordHash,
      createdAt: firestoreMod.serverTimestamp()
    });
    customStatusEl.textContent = "✓ Plan propuesto guardado";
    customTitleInput.value = "";
    customDetailsInput.value = "";
    customPasswordInput.value = "";
  } catch (err) {
    console.error("Error guardando el plan propuesto", err);
    customStatusEl.textContent = "⚠️ No se pudo guardar — revisad la conexión";
  } finally {
    saveCustomBtn.disabled = false;
  }
}

async function deleteCustomPlan(planId) {
  const plan = customPlans.find((p) => p.id === planId);
  if (!plan) return;
  if (!plan.passwordHash) {
    // Guardada antes de añadir la protección por contraseña: no se puede exigir.
    if (!confirm("Esta propuesta de plan no tiene contraseña (se guardó antes de añadir esa protección). ¿Borrarla de todas formas?")) return;
  } else {
    const pw = prompt("Contraseña para borrar la propuesta de plan \"" + plan.title + "\":");
    if (pw === null) return; // cancelado
    const hash = await hashPassword(pw);
    if (hash !== plan.passwordHash) {
      alert("Contraseña incorrecta. No se ha borrado el plan propuesto.");
      return;
    }
  }
  const firestoreMod = await initFirebase();
  if (!firestoreMod || !db) return;
  try {
    await firestoreMod.deleteDoc(firestoreMod.doc(db, "planes-propuestos", planId));
  } catch (err) {
    console.error("Error borrando el plan propuesto", err);
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
      /* Las propuestas de itinerario guardadas también pueden referenciar
         un plan propuesto: si esta lista llega después de haberlas
         pintado, hay que repintarlas para que dejen de mostrar "—". */
      renderProposals();
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

function initBankSearch() {
  if (!bankSearchInput) return;
  bankSearchInput.addEventListener("input", () => {
    bankFilter = bankSearchInput.value;
    renderBank();
  });
}

function initBoardToolbar() {
  if (!clearBoardBtn) return;
  clearBoardBtn.addEventListener("click", () => {
    if (!confirm("¿Vaciar todo el tablero? Esto afecta a lo que ven los 4 y no se puede deshacer (las propuestas ya guardadas no se tocan).")) return;
    state = emptyState();
    persistBoard();
    render();
  });
}

/* ---------- Botón "Añadir a un día" (alternativa a arrastrar) ---------- */

let dayPopover = null;
let popoverTargetSlug = null;

function buildDayPopover() {
  const pop = document.createElement("div");
  pop.className = "day-popover";
  pop.hidden = true;
  pop.innerHTML =
    '<p class="day-popover-title">¿Qué día y qué franja?</p>' +
    '<div class="day-popover-options">' +
    DAYS.map(({ day, label, sub }) =>
      '<div class="day-popover-row">' +
      '<span class="day-popover-daylabel">' + label + " · " + sub + "</span>" +
      '<button type="button" data-day="' + day + '" data-period="manana" title="Mañana">🌅</button>' +
      '<button type="button" data-day="' + day + '" data-period="tarde" title="Tarde">🌇</button>' +
      "</div>"
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

function addPlanToDay(slug, day, period) {
  const newItem = { id: uid(), slug };
  ensurePeriodArray(day, period).push(newItem);
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
      dragInfo = {
        id: itinItem.dataset.id,
        from: "day",
        fromDay: Number(itinItem.dataset.day),
        fromPeriod: itinItem.dataset.period
      };
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
      const period = list.dataset.period;
      const targetArr = ensurePeriodArray(day, period);
      const afterEl = getDragAfterElement(list, e.clientY);
      const insertIndex = afterEl ? Number(afterEl.dataset.index) : targetArr.length;

      if (dragInfo.from === "bank") {
        targetArr.splice(insertIndex, 0, { id: uid(), slug: dragInfo.slug });
      } else if (dragInfo.from === "day") {
        const fromArr = ensurePeriodArray(dragInfo.fromDay, dragInfo.fromPeriod);
        const srcIdx = fromArr.findIndex((it) => it.id === dragInfo.id);
        if (srcIdx === -1) return;
        const [moved] = fromArr.splice(srcIdx, 1);
        let idx = insertIndex;
        if (dragInfo.fromDay === day && dragInfo.fromPeriod === period && srcIdx < idx) idx -= 1;
        targetArr.splice(idx, 0, moved);
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
      const period = li.dataset.period;
      const id = li.dataset.id;
      const arr = ensurePeriodArray(day, period);
      const idx = arr.findIndex((it) => it.id === id);
      if (idx !== -1) arr.splice(idx, 1);
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
    const deleteProposalBtn = e.target.closest("[data-delete-proposal]");
    if (deleteProposalBtn) {
      const card = deleteProposalBtn.closest(".proposal-card");
      deleteProposal(card.dataset.id);
      return;
    }
    const deleteCustomBtn = e.target.closest("[data-delete-custom]");
    if (deleteCustomBtn) {
      deleteCustomPlan(deleteCustomBtn.dataset.id);
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
      if (popoverTargetSlug) addPlanToDay(popoverTargetSlug, Number(dayChoice.dataset.day), dayChoice.dataset.period);
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

function proposalPeriodItems(itinerary, day, period) {
  const dayState = itinerary && itinerary["day" + day];
  const items = getPeriodItems(dayState, period);
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
  const score = (p) => countVotes(p.votes, "like") - countVotes(p.votes, "dislike");
  const sorted = [...proposals].sort((a, b) => score(b) - score(a));

  /* Solo se destaca cuando hay un líder claro (puntúa más que la
     segunda y por encima de 0): con empate, nadie se corona. */
  const topScore = sorted.length ? score(sorted[0]) : 0;
  const secondScore = sorted.length > 1 ? score(sorted[1]) : -Infinity;
  const hasLeader = sorted.length > 0 && topScore > 0 && topScore > secondScore;

  sorted.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "proposal-card" + (hasLeader && i === 0 ? " featured" : "");
    card.dataset.id = p.id;
    const myVote = p.votes ? p.votes[voterId] : undefined;
    const likeCount = countVotes(p.votes, "like");
    const dislikeCount = countVotes(p.votes, "dislike");

    const daysHtml = DAYS.map(({ day, label }) => {
      const periodsHtml = PERIODS.map(({ key: period, label: periodLabel }) => {
        const plans = proposalPeriodItems(p.itinerary, day, period);
        const list = plans.length
          ? plans.map((pl) => "<li>" + escapeHtml(pl.title) + "</li>").join("")
          : '<li class="pd-empty">—</li>';
        return '<div class="pd-period"><span class="pd-period-label">' + periodLabel + '</span><ul>' + list + "</ul></div>";
      }).join("");
      return '<div class="proposal-day"><span class="pd-label">' + label + "</span>" + periodsHtml + "</div>";
    }).join("");

    card.innerHTML =
      (hasLeader && i === 0 ? '<span class="featured-badge">🏆 Más votada</span>' : "") +
      '<div class="proposal-head"><h3>' + escapeHtml(p.name) + '</h3><span class="proposal-date">' + formatDate(p.createdAt) +
      '</span><button class="delete-btn" data-delete-proposal="1" title="Borrar propuesta" aria-label="Borrar">✕</button></div>' +
      '<div class="proposal-days">' + daysHtml + "</div>" +
      '<div class="vote-row">' +
      '<button class="vote-btn like' + (myVote === "like" ? " active" : "") + '" data-vote="like">👍 <span>' + likeCount + "</span></button>" +
      '<button class="vote-btn dislike' + (myVote === "dislike" ? " active" : "") + '" data-vote="dislike">👎 <span>' + dislikeCount + "</span></button>" +
      "</div>" +
      '<a class="btn btn-ghost view-proposal-btn" href="propuesta.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">Ver propuesta →</a>';
    proposalsListEl.appendChild(card);
  });
}

function countVotes(votes, choice) {
  if (!votes) return 0;
  return Object.values(votes).filter((v) => v === choice).length;
}

async function deleteProposal(proposalId) {
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!proposal) return;
  if (!proposal.passwordHash) {
    // Guardada antes de añadir la protección por contraseña: no se puede exigir.
    if (!confirm("Esta propuesta no tiene contraseña (se guardó antes de añadir esa protección). ¿Borrarla de todas formas?")) return;
  } else {
    const pw = prompt("Contraseña para borrar la propuesta \"" + proposal.name + "\":");
    if (pw === null) return; // cancelado
    const hash = await hashPassword(pw);
    if (hash !== proposal.passwordHash) {
      alert("Contraseña incorrecta. No se ha borrado la propuesta.");
      return;
    }
  }
  const firestoreMod = await initFirebase();
  if (!firestoreMod || !db) return;
  try {
    await firestoreMod.deleteDoc(firestoreMod.doc(db, "propuestas", proposalId));
  } catch (err) {
    console.error("Error borrando la propuesta", err);
  }
}

/* El 👍 es un recurso único por persona: solo puede tener una
   propuesta con "like" a la vez (para dificultar los empates). El 👎
   es libre: se puede votar negativo en tantas propuestas como se
   quiera, independientemente unas de otras. */
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
      return;
    }
    if (choice === "like") {
      const otherLiked = proposals.find((p) => p.id !== proposalId && p.votes && p.votes[voterId] === "like");
      if (otherLiked) {
        await firestoreMod.updateDoc(firestoreMod.doc(db, "propuestas", otherLiked.id), { [field]: firestoreMod.deleteField() });
      }
    }
    await firestoreMod.updateDoc(ref, { [field]: choice });
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
  const password = passwordInput.value;
  if (!name || !password) {
    saveStatusEl.textContent = "Escribe tu nombre y una contraseña antes de guardar.";
    (name ? passwordInput : nameInput).focus();
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
    const passwordHash = await hashPassword(password);
    await firestoreMod.addDoc(firestoreMod.collection(db, "propuestas"), {
      name,
      itinerary: state,
      votes: {},
      passwordHash,
      createdAt: firestoreMod.serverTimestamp()
    });
    saveStatusEl.textContent = "✓ Propuesta guardada como \"" + name + "\"";
    passwordInput.value = "";
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
initBankSearch();
initBoardToolbar();
subscribeBoard();
subscribeProposals();
subscribeCustomPlans();
