import { DAYS, PLANS } from "./plans-data.js";
import { firebaseConfig } from "./firebase-config.js";

const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
const FIREBASE_FIRESTORE_URL = "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const PERIODS = [
  { key: "manana", label: "🌅 Mañana" },
  { key: "tarde", label: "🌇 Tarde" }
];

const eyebrowEl = document.getElementById("propEyebrow");
const titleEl = document.getElementById("propTitle");
const ledeEl = document.getElementById("propLede");
const bodyEl = document.getElementById("propBody");

let customPlans = [];

/* Lee los items de una franja soportando el formato antiguo (un array
   plano por día, de antes de separar mañana/tarde): esos planes se
   muestran en "Tarde" para no perderlos. */
function getPeriodItems(dayState, period) {
  if (Array.isArray(dayState)) return period === "tarde" ? dayState : [];
  return (dayState && dayState[period]) || [];
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

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
    photo: null,
    description: custom.details
  };
}

function countVotes(votes, choice) {
  if (!votes) return 0;
  return Object.values(votes).filter((v) => v === choice).length;
}

function formatDate(ts) {
  if (!ts || typeof ts.toDate !== "function") return "";
  const d = ts.toDate();
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) + " a las " +
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function showMessage(text) {
  bodyEl.innerHTML = '<p class="prop-loading">' + escapeHtml(text) + "</p>";
}

function renderProposal(proposal) {
  const name = proposal.name || "Sin nombre";
  const likeCount = countVotes(proposal.votes, "like");
  const dislikeCount = countVotes(proposal.votes, "dislike");
  const dateStr = formatDate(proposal.createdAt);

  document.title = "Propuesta de " + name + " · Costa Blanca 12–16 agosto";
  titleEl.textContent = "Propuesta de " + name;
  eyebrowEl.textContent = (dateStr ? "Guardada el " + dateStr + " · " : "") + "👍 " + likeCount + " · 👎 " + dislikeCount;
  ledeEl.textContent = "Así queda el viaje día a día con los planes que eligió " + name + ".";

  bodyEl.innerHTML = "";
  DAYS.forEach(({ day, label, sub }) => {
    const dayState = proposal.itinerary && proposal.itinerary["day" + day];

    const section = document.createElement("section");
    section.className = "plan-section";

    const h2 = document.createElement("h2");
    h2.textContent = label + " · " + sub;
    section.appendChild(h2);

    PERIODS.forEach(({ key: period, label: periodLabel }) => {
      const items = getPeriodItems(dayState, period);
      const plans = items.map((it) => findPlan(it.slug)).filter(Boolean);

      const periodWrap = document.createElement("div");
      periodWrap.className = "prop-period";
      const h3 = document.createElement("h3");
      h3.className = "prop-period-title";
      h3.textContent = periodLabel;
      periodWrap.appendChild(h3);

      if (!plans.length) {
        const empty = document.createElement("p");
        empty.className = "prop-day-empty";
        empty.textContent = "Sin plan asignado.";
        periodWrap.appendChild(empty);
      } else {
        const wrap = document.createElement("div");
        wrap.className = "prop-day-plans";
        plans.forEach((plan) => {
          const card = document.createElement("div");
          card.className = "prop-plan-card" + (!plan.href ? " proposed-plan-card" : "");
          card.innerHTML =
            (plan.photo
              ? '<img class="prop-plan-photo" src="' + plan.photo + '" alt="' + escapeHtml(plan.title) + '" loading="lazy">'
              : '<div class="prop-plan-photo prop-plan-photo-empty">📝</div>') +
            '<div class="prop-plan-info">' +
            '<span class="tag' + (plan.tagClass ? " " + plan.tagClass : "") + '">' + escapeHtml(plan.tag) + "</span>" +
            "<h3>" + escapeHtml(plan.title) + (plan.intensity ? " " + plan.intensity : "") + "</h3>" +
            "<p>" + escapeHtml(plan.description) + "</p>" +
            (plan.href ? '<a class="btn btn-primary" href="' + plan.href + '" target="_blank" rel="noopener">Ver plan detallado →</a>' : "") +
            "</div>";
          wrap.appendChild(card);
        });
        periodWrap.appendChild(wrap);
      }
      section.appendChild(periodWrap);
    });
    bodyEl.appendChild(section);
  });
}

async function init() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) {
    showMessage("Falta el identificador de la propuesta en el enlace.");
    return;
  }

  const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
  if (!isConfigured) {
    showMessage("Firebase sin configurar — no se puede cargar la propuesta.");
    return;
  }

  try {
    const { initializeApp } = await import(FIREBASE_APP_URL);
    const firestoreMod = await import(FIREBASE_FIRESTORE_URL);
    const app = initializeApp(firebaseConfig);
    const db = firestoreMod.getFirestore(app);

    firestoreMod.onSnapshot(firestoreMod.collection(db, "planes-propuestos"), (snap) => {
      customPlans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    });

    firestoreMod.onSnapshot(
      firestoreMod.doc(db, "propuestas", id),
      (snap) => {
        if (!snap.exists()) {
          showMessage("Esta propuesta ya no existe (puede que se haya borrado).");
          return;
        }
        renderProposal(snap.data());
      },
      (err) => {
        console.error("Error cargando la propuesta", err);
        showMessage("No se pudo cargar la propuesta — revisad la conexión.");
      }
    );
  } catch (err) {
    console.error("Error inicializando Firebase", err);
    showMessage("Error cargando Firebase — revisad js/firebase-config.js.");
  }
}

init();
