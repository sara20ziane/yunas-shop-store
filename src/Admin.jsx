import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db, firebaseReady } from "./firebase";

const STATUS_OPTIONS = [
  { value: "new", label: "Nouvelle" },
  { value: "checking", label: "Vérification" },
  { value: "quoted", label: "Prix envoyé" },
  { value: "confirmed", label: "Confirmée" },
  { value: "declined", label: "Refusée" },
  { value: "archived", label: "Archivée" },
];

const requestCollection = () =>
  collection(
    db,
    "artifacts",
    "yunas-shop-crm",
    "public",
    "data",
    "linkRequests",
  );

function normalizeStatus(status) {
  return status === "handled" ? "quoted" : status || "new";
}

function formatDate(value) {
  if (!value?.toDate) return "À l’instant";
  return new Intl.DateTimeFormat("fr-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Algiers",
  }).format(value.toDate());
}

function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("fr-DZ").format(amount);
}

function whatsappMessage(item, details) {
  const total = formatAmount(details.totalDa);
  const deposit = formatAmount(details.depositDa);
  const delay = details.estimatedDelay?.trim();
  const lines =
    item.locale === "ar"
      ? [
          `السلام عليكم، هذا عرض سعر طلبك ${item.reference} من Yuna’s Shop:`,
          total ? `المبلغ الإجمالي: ${total} دج` : "",
          deposit ? `التسبيق: ${deposit} دج` : "",
          delay ? `المدة التقريبية: ${delay}` : "",
          "إذا وافقتِ على الطلب، أكّدي لنا هنا من فضلك 🤍",
        ]
      : [
          `Bonjour, voici le devis de votre demande ${item.reference} chez Yuna’s Shop :`,
          total ? `Montant total : ${total} DA` : "",
          deposit ? `Acompte : ${deposit} DA` : "",
          delay ? `Délai estimé : ${delay}` : "",
          "Si le devis vous convient, confirmez-nous ici s’il vous plaît 🤍",
        ];
  return `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
}

function Brand() {
  return (
    <a className="brand brand-with-logo" href="/" aria-label="Yuna’s Shop">
      <img src="/logo-yunas-shop.jpg" alt="" />
      <span>Yuna’s Shop</span>
    </a>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!auth) return;
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError("Adresse e-mail ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <Brand />
        <p>Espace privé</p>
        <h1>Connexion administratrice</h1>
        {!firebaseReady ? (
          <div className="admin-error">Firebase n’est pas encore configuré.</div>
        ) : null}
        <label htmlFor="email">Adresse e-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={loading || !firebaseReady}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}

function RequestCard({ item, onError }) {
  const [totalDa, setTotalDa] = useState(item.totalDa || "");
  const [depositDa, setDepositDa] = useState(item.depositDa || "");
  const [estimatedDelay, setEstimatedDelay] = useState(item.estimatedDelay || "");
  const [privateNote, setPrivateNote] = useState(item.privateNote || "");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const status = normalizeStatus(item.status);
  const details = { totalDa, depositDa, estimatedDelay, privateNote };

  async function updateRequest(fields, successMessage = false) {
    try {
      await updateDoc(doc(requestCollection(), item.id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
      if (successMessage) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2200);
      }
      onError("");
    } catch {
      onError("La modification n’a pas été enregistrée. Réessayez.");
    }
  }

  function saveDetails(extra = {}, successMessage = true) {
    return updateRequest(
      {
        totalDa: totalDa ? Number(totalDa) : null,
        depositDa: depositDa ? Number(depositDa) : null,
        estimatedDelay: estimatedDelay.trim(),
        privateNote: privateNote.trim(),
        ...extra,
      },
      successMessage,
    );
  }

  function changeTotal(value) {
    setTotalDa(value);
    setDepositDa(value ? String(Math.round(Number(value) / 2)) : "");
  }

  async function copyLinks() {
    try {
      await navigator.clipboard.writeText((item.links || []).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onError("Impossible de copier les liens sur cet appareil.");
    }
  }

  return (
    <article className={`request-card status-${status}`}>
      <div className="request-topline">
        <div>
          <strong>{item.reference}</strong>
          <span>{formatDate(item.createdAt)} · +{item.whatsapp}</span>
        </div>
        <select
          className={`status-select ${status}`}
          value={status}
          aria-label={`Statut de ${item.reference}`}
          onChange={(event) => updateRequest({ status: event.target.value })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="request-links-heading">
        <span>{(item.links || []).length} lien{(item.links || []).length > 1 ? "s" : ""}</span>
        <button type="button" onClick={copyLinks}>{copied ? "Liens copiés ✓" : "Copier tous les liens"}</button>
      </div>
      <div className="request-links">
        {(item.links || []).map((link, index) => (
          <a href={link} target="_blank" rel="noreferrer" key={`${item.id}-${index}`}>
            <span>{index + 1}</span>
            <span>{link}</span>
            <b aria-hidden="true">↗</b>
          </a>
        ))}
      </div>

      <div className="quote-fields">
        <label>
          <span>Total (DA)</span>
          <input
            type="number"
            min="0"
            step="100"
            inputMode="numeric"
            value={totalDa}
            onChange={(event) => changeTotal(event.target.value)}
            placeholder="Ex. 12 500"
          />
        </label>
        <label>
          <span>Acompte (DA)</span>
          <input
            type="number"
            min="0"
            step="100"
            inputMode="numeric"
            value={depositDa}
            onChange={(event) => setDepositDa(event.target.value)}
            placeholder="Calculé à 50 %"
          />
        </label>
        <label>
          <span>Délai estimé</span>
          <input
            value={estimatedDelay}
            onChange={(event) => setEstimatedDelay(event.target.value)}
            placeholder="Ex. 15 à 30 jours"
          />
        </label>
      </div>

      <label className="private-note">
        <span>Note privée</span>
        <textarea
          rows="2"
          value={privateNote}
          onChange={(event) => setPrivateNote(event.target.value)}
          placeholder="Coupon, rupture, préférence cliente…"
        />
      </label>

      <div className="request-actions">
        <button className="save-button" type="button" onClick={() => saveDetails()}>
          {saved ? "Enregistré ✓" : "Enregistrer"}
        </button>
        <a
          className="whatsapp-button"
          href={whatsappMessage(item, details)}
          target="_blank"
          rel="noreferrer"
          onClick={() => saveDetails({ status: "quoted" }, false)}
        >
          Envoyer le devis sur WhatsApp
        </a>
        <button
          className="archive-button"
          type="button"
          onClick={() => updateRequest({ status: status === "archived" ? "new" : "archived" })}
        >
          {status === "archived" ? "Restaurer" : "Archiver"}
        </button>
      </div>
    </article>
  );
}

function Dashboard({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [dateFilter, setDateFilter] = useState("all");
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const firstSnapshot = useRef(true);

  useEffect(() => {
    const requestsQuery = query(
      requestCollection(),
      orderBy("createdAt", "desc"),
      limit(200),
    );
    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const nextItems = snapshot.docs.map((requestDoc) => ({
          id: requestDoc.id,
          ...requestDoc.data(),
        }));
        setItems(nextItems);
        setError("");
        setLoading(false);

        if (
          !firstSnapshot.current &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          snapshot.docChanges()
            .filter((change) => change.type === "added")
            .forEach((change) => {
              const request = change.doc.data();
              const notification = new Notification("Nouvelle demande Yuna’s Shop", {
                body: `${request.reference} · ${(request.links || []).length} lien(s)`,
                icon: "/logo-yunas-shop.jpg",
              });
              notification.onclick = () => window.focus();
            });
        }
        firstSnapshot.current = false;
      },
      () => {
        setError("Impossible de charger les demandes. Vérifiez les règles Firestore.");
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const counts = useMemo(() => {
    const active = items.filter((item) => normalizeStatus(item.status) !== "archived");
    return {
      active: active.length,
      new: active.filter((item) => normalizeStatus(item.status) === "new").length,
      checking: active.filter((item) => normalizeStatus(item.status) === "checking").length,
      quoted: active.filter((item) => normalizeStatus(item.status) === "quoted").length,
      confirmed: active.filter((item) => normalizeStatus(item.status) === "confirmed").length,
    };
  }, [items]);

  useEffect(() => {
    document.title = counts.new
      ? `(${counts.new}) Nouvelles demandes | Yuna’s Shop`
      : "Demandes | Yuna’s Shop";
    return () => {
      document.title = "Yuna’s Shop | Envoyez vos liens";
    };
  }, [counts.new]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase().replace(/\s/g, "");
    const now = Date.now();
    const dateLimit = {
      today: now - 24 * 60 * 60 * 1000,
      week: now - 7 * 24 * 60 * 60 * 1000,
      month: now - 30 * 24 * 60 * 60 * 1000,
    }[dateFilter];

    return items.filter((item) => {
      const status = normalizeStatus(item.status);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && status !== "archived") ||
        status === statusFilter;
      const searchable = [
        item.reference,
        item.whatsapp,
        ...(item.links || []),
      ].join(" ").toLowerCase().replace(/\s/g, "");
      const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
      const createdAt = item.createdAt?.toDate?.().getTime();
      const matchesDate = !dateLimit || (createdAt && createdAt >= dateLimit);
      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [items, search, statusFilter, dateFilter]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <Brand />
          <h1>Demandes de prix</h1>
          <span>{user.email}</span>
        </div>
        <div className="admin-header-actions">
          {notificationPermission === "default" ? (
            <button type="button" onClick={enableNotifications}>Activer les notifications</button>
          ) : null}
          <a href="/">Voir le formulaire</a>
          <button type="button" onClick={() => signOut(auth)}>Déconnexion</button>
        </div>
      </header>

      <section className="admin-stats" aria-label="Résumé des demandes">
        <button type="button" onClick={() => setStatusFilter("active")}>
          <span>Demandes actives</span><strong>{counts.active}</strong>
        </button>
        <button type="button" onClick={() => setStatusFilter("new")}>
          <span>Nouvelles</span><strong>{counts.new}</strong>
        </button>
        <button type="button" onClick={() => setStatusFilter("checking")}>
          <span>À vérifier</span><strong>{counts.checking}</strong>
        </button>
        <button type="button" onClick={() => setStatusFilter("quoted")}>
          <span>Prix envoyés</span><strong>{counts.quoted}</strong>
        </button>
        <button type="button" onClick={() => setStatusFilter("confirmed")}>
          <span>Confirmées</span><strong>{counts.confirmed}</strong>
        </button>
      </section>

      <section className="admin-toolbar" aria-label="Recherche et filtres">
        <label className="admin-search">
          <span>Rechercher</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Référence, téléphone ou lien"
          />
        </label>
        <label>
          <span>Statut</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="active">Toutes les actives</option>
            <option value="all">Toutes, archives incluses</option>
            {STATUS_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Date</span>
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            <option value="all">Toutes les dates</option>
            <option value="today">Dernières 24 h</option>
            <option value="week">7 derniers jours</option>
            <option value="month">30 derniers jours</option>
          </select>
        </label>
      </section>

      {loading ? <p className="admin-state">Chargement…</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
      {!loading && !filteredItems.length ? (
        <div className="admin-empty">
          <span>♡</span>
          <h2>{items.length ? "Aucune demande ne correspond aux filtres" : "Aucune demande pour le moment"}</h2>
          <p>{items.length ? "Modifiez la recherche ou les filtres." : "Les nouveaux liens apparaîtront ici automatiquement."}</p>
        </div>
      ) : null}

      <section className="request-grid">
        {filteredItems.map((item) => (
          <RequestCard item={item} onError={setError} key={item.id} />
        ))}
      </section>
    </main>
  );
}

export default function Admin() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      return undefined;
    }
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (user === undefined) {
    return <main className="admin-shell"><p>Chargement…</p></main>;
  }
  return user ? <Dashboard user={user} /> : <Login />;
}
