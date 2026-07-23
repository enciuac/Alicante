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
let dragInfo = null;
let proposals = []; // [{id, name, itinerary, votes, comments, createdAt}]
let customPlans = []; // [{id, title, author, details, createdAt}]
let expandedComments = new Set(); // ids de propuestas con el panel de comentarios abierto

const NAME_KEY = "itin-your-name";
const BOARD_KEY = "itin-board-state";

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
      renderPlanRanking();
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
    if (!confirm("¿Vaciar tu tablero? Solo afecta a lo que ves tú en este navegador y no se puede deshacer (las propuestas ya guardadas no se tocan).")) return;
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
    const commentsToggleBtn = e.target.closest("[data-comments-toggle]");
    if (commentsToggleBtn) {
      const card = commentsToggleBtn.closest(".proposal-card");
      const id = card.dataset.id;
      if (expandedComments.has(id)) expandedComments.delete(id);
      else expandedComments.add(id);
      renderProposals();
      return;
    }
    const addCommentBtn = e.target.closest("[data-add-comment]");
    if (addCommentBtn) {
      const card = addCommentBtn.closest(".proposal-card");
      addComment(card);
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
      statusEl.textContent = "⚙️ Firebase sin configurar — no se podrán guardar ni votar propuestas todavía. Ver js/firebase-config.js.";
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

/* ---------- Tablero: es privado, solo tuyo en este navegador ----------
   Vive en localStorage, no en Firebase: lo que arrastras aquí no lo ve
   nadie más hasta que pulses "Guardar esta propuesta", que es lo que
   sí se comparte con el grupo (colección propuestas). */

function persistBoard() {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Error guardando el tablero en este navegador", err);
  }
}

function loadBoard() {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (err) {
    console.error("Error leyendo el tablero guardado", err);
  }
}

/* ---------- Propuestas: guardar, listar y votar ---------- */

function proposalPeriodItems(itinerary, day, period) {
  const dayState = itinerary && itinerary["day" + day];
  const items = getPeriodItems(dayState, period);
  return items.map((it) => findPlan(it.slug)).filter(Boolean);
}

/* ---------- Ranking: planes más repetidos entre todas las propuestas ---------- */

const planRankingEl = document.getElementById("planRanking");

function renderPlanRanking() {
  if (!planRankingEl) return;
  planRankingEl.innerHTML = "";
  if (!proposals.length) {
    planRankingEl.innerHTML = '<p class="proposals-empty">Todavía no hay propuestas guardadas para calcular un ranking.</p>';
    return;
  }

  const counts = new Map(); // slug -> nº de apariciones
  proposals.forEach((p) => {
    DAYS.forEach(({ day }) => {
      PERIODS.forEach(({ key: period }) => {
        const dayState = p.itinerary && p.itinerary["day" + day];
        getPeriodItems(dayState, period).forEach((it) => {
          counts.set(it.slug, (counts.get(it.slug) || 0) + 1);
        });
      });
    });
  });

  const ranked = [...counts.entries()]
    .map(([slug, count]) => ({ plan: findPlan(slug), count }))
    .filter((r) => r.plan)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (!ranked.length) {
    planRankingEl.innerHTML = '<p class="proposals-empty">Ninguna propuesta guardada tiene planes asignados todavía.</p>';
    return;
  }

  const maxCount = ranked[0].count;
  planRankingEl.innerHTML = ranked.map(({ plan, count }, i) => {
    const pct = Math.round((count / maxCount) * 100);
    return (
      '<div class="rank-row">' +
      '<span class="rank-pos">' + (i + 1) + "</span>" +
      '<div class="rank-info">' +
      '<div class="rank-top">' +
      '<span class="rank-title' + (plan.isCustom ? " proposed" : "") + '">' + escapeHtml(plan.title) + "</span>" +
      '<span class="rank-count">' + count + (count === 1 ? " propuesta" : " propuestas") + "</span>" +
      "</div>" +
      '<div class="rank-bar"><div class="rank-bar-fill" style="width:' + pct + '%"></div></div>' +
      "</div>" +
      "</div>"
    );
  }).join("");
}

function formatDate(ts) {
  if (!ts || typeof ts.toDate !== "function") return "justo ahora";
  const d = ts.toDate();
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function voteNames(votes, choice) {
  if (!votes) return [];
  return Object.values(votes)
    .filter((v) => v && v.choice === choice)
    .map((v) => v.name);
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
  const myNameKey = normalizeName(localStorage.getItem(NAME_KEY) || "");
  const score = (p) => voteNames(p.votes, "like").length - voteNames(p.votes, "dislike").length;
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
    const myVote = myNameKey && p.votes ? p.votes[myNameKey] : undefined;
    const likeNames = voteNames(p.votes, "like");
    const dislikeNames = voteNames(p.votes, "dislike");

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

    const comments = Array.isArray(p.comments) ? p.comments : [];
    const commentsOpen = expandedComments.has(p.id);

    card.innerHTML =
      (hasLeader && i === 0 ? '<span class="featured-badge">🏆 Más votada</span>' : "") +
      '<div class="proposal-head"><h3>' + escapeHtml(p.name) + '</h3><span class="proposal-date">' + formatDate(p.createdAt) +
      '</span><button class="delete-btn" data-delete-proposal="1" title="Borrar propuesta" aria-label="Borrar">✕</button></div>' +
      '<div class="proposal-days">' + daysHtml + "</div>" +
      '<div class="vote-row">' +
      '<button class="vote-btn like' + (myVote && myVote.choice === "like" ? " active" : "") + '" data-vote="like">👍 <span>' + likeNames.length + "</span></button>" +
      '<button class="vote-btn dislike' + (myVote && myVote.choice === "dislike" ? " active" : "") + '" data-vote="dislike">👎 <span>' + dislikeNames.length + "</span></button>" +
      '<button class="comments-toggle' + (commentsOpen ? " active" : "") + '" data-comments-toggle="1">💬 Comentarios <span>(' + comments.length + ")</span></button>" +
      "</div>" +
      (likeNames.length ? '<p class="vote-names">👍 ' + likeNames.map(escapeHtml).join(", ") + "</p>" : "") +
      (dislikeNames.length ? '<p class="vote-names dislike">👎 ' + dislikeNames.map(escapeHtml).join(", ") + "</p>" : "") +
      (commentsOpen ? renderCommentsPanel(comments) : "") +
      '<a class="btn btn-ghost view-proposal-btn" href="propuesta.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">Ver propuesta →</a>';
    proposalsListEl.appendChild(card);
  });
}

function formatCommentDate(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function renderCommentsPanel(comments) {
  const sorted = [...comments].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const list = sorted.length
    ? sorted.map((c) =>
        '<li class="comment-item"><div class="comment-top"><span class="comment-name">' + escapeHtml(c.name) +
        '</span><span class="comment-date">' + formatCommentDate(c.createdAt) + "</span></div>" +
        '<p class="comment-text">' + escapeHtml(c.text) + "</p></li>"
      ).join("")
    : '<li class="comment-empty">Todavía no hay comentarios. ¡Sé el primero!</li>';
  const savedName = localStorage.getItem(NAME_KEY) || "";
  return (
    '<div class="comments-panel">' +
    '<ul class="comments-list">' + list + "</ul>" +
    '<div class="comment-form">' +
    '<input type="text" class="comment-name-input" placeholder="Tu nombre" maxlength="40" value="' + escapeHtml(savedName) + '">' +
    '<input type="text" class="comment-text-input" placeholder="Escribe un comentario…" maxlength="300">' +
    '<button class="btn btn-primary comment-send-btn" data-add-comment="1">Comentar</button>' +
    "</div>" +
    "</div>"
  );
}

async function addComment(card) {
  const proposalId = card.dataset.id;
  const nameInput = card.querySelector(".comment-name-input");
  const textInput = card.querySelector(".comment-text-input");
  const name = nameInput.value.trim();
  const text = textInput.value.trim();
  if (!name || !text) {
    alert("Escribe tu nombre y el comentario antes de enviarlo.");
    (name ? textInput : nameInput).focus();
    return;
  }
  const firestoreMod = await initFirebase();
  if (!firestoreMod || !db) return;
  localStorage.setItem(NAME_KEY, name);
  try {
    await firestoreMod.updateDoc(
      firestoreMod.doc(db, "propuestas", proposalId),
      { comments: firestoreMod.arrayUnion({ name, text, createdAt: Date.now() }) }
    );
  } catch (err) {
    console.error("Error al comentar", err);
  }
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

function normalizeName(s) {
  return s.trim().toLowerCase();
}

/* Pide el nombre de quien vota (obligatorio, prellenado con el último
   usado) para poder identificar a la persona por nombre y no por
   dispositivo — así no cuela votar varias veces desde el móvil, la
   tablet y el portátil. Devuelve null si cancela o no escribe nada. */
function promptVoterName() {
  const savedName = localStorage.getItem(NAME_KEY) || "";
  const input = prompt("Tu nombre para votar (obligatorio):", savedName);
  if (input === null) return null; // cancelado
  const displayName = input.trim();
  if (!displayName) {
    alert("Hace falta un nombre para votar.");
    return null;
  }
  localStorage.setItem(NAME_KEY, displayName);
  return displayName;
}

/* El 👍 es un recurso único por persona: solo puede tener una
   propuesta con "like" a la vez (para dificultar los empates). El 👎
   es libre: se puede votar negativo en tantas propuestas como se
   quiera, independientemente unas de otras. Ambos exigen nombre,
   guardado por nombre normalizado para que cuente como la misma
   persona en cualquier dispositivo. */
async function vote(proposalId, choice) {
  const firestoreMod = await initFirebase();
  if (!firestoreMod || !db) return;
  const proposal = proposals.find((p) => p.id === proposalId);
  if (!proposal) return;

  const displayName = promptVoterName();
  if (!displayName) return;
  const key = normalizeName(displayName);
  const field = "votes." + key;
  const current = proposal.votes && proposal.votes[key];

  try {
    if (current && current.choice === choice) {
      // ya tenía este mismo voto puesto aquí: lo quita (toggle off)
      await firestoreMod.updateDoc(firestoreMod.doc(db, "propuestas", proposalId), { [field]: firestoreMod.deleteField() });
      return;
    }
    if (choice === "like") {
      const otherLiked = proposals.find(
        (p) => p.id !== proposalId && p.votes && p.votes[key] && p.votes[key].choice === "like"
      );
      if (otherLiked) {
        await firestoreMod.updateDoc(firestoreMod.doc(db, "propuestas", otherLiked.id), { [field]: firestoreMod.deleteField() });
      }
    }
    await firestoreMod.updateDoc(firestoreMod.doc(db, "propuestas", proposalId), { [field]: { choice, name: displayName } });
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
      renderPlanRanking();
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

/* El tablero es privado (localStorage, se carga al momento). El banco
   de planes, las propuestas del grupo y los planes propuestos sí son
   compartidos y se pintan vacíos primero para que la página nunca se
   quede en blanco esperando a Firebase; los onSnapshot los repintan en
   cuanto llega el estado real. */
loadBoard();
statusEl.textContent = "💾 Este tablero es solo tuyo, se guarda en este navegador";
dayPopover = buildDayPopover();
render();
renderProposals();
renderPlanRanking();
initDragEvents();
initProposalUI();
initCustomUI();
initBankSearch();
initBoardToolbar();
subscribeProposals();
subscribeCustomPlans();
