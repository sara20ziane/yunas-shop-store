import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, db, firebaseReady } from "./firebase";

const requestCollection = () =>
  collection(
    db,
    "artifacts",
    "yunas-shop-crm",
    "public",
    "data",
    "linkRequests",
  );

function formatDate(value) {
  if (!value?.toDate) return "À l’instant";
  return new Intl.DateTimeFormat("fr-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Algiers",
  }).format(value.toDate());
}

function whatsappMessage(item) {
  const message =
    item.locale === "ar"
      ? `السلام عليكم، استلمنا طلبك ${item.reference} على Yuna’s Shop. تحققنا من الروابط وسنرسل لك التفاصيل هنا.`
      : `Bonjour, nous avons bien reçu votre demande ${item.reference} sur Yuna’s Shop. Nous avons vérifié vos liens et voici les détails :`;
  return `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(message)}`;
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
        <a className="brand" href="/">Yuna’s Shop <span className="brand-leaf">❧</span></a>
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

function Dashboard({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const requestsQuery = query(
      requestCollection(),
      orderBy("createdAt", "desc"),
      limit(200),
    );
    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        setItems(snapshot.docs.map((requestDoc) => ({
          id: requestDoc.id,
          ...requestDoc.data(),
        })));
        setError("");
        setLoading(false);
      },
      () => {
        setError("Impossible de charger les demandes. Vérifiez les règles Firestore.");
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  async function toggleStatus(item) {
    const nextStatus = item.status === "handled" ? "new" : "handled";
    try {
      await updateDoc(doc(requestCollection(), item.id), {
        status: nextStatus,
        updatedAt: new Date(),
      });
    } catch {
      setError("La modification n’a pas été enregistrée.");
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p>Yuna’s Shop</p>
          <h1>Demandes de prix</h1>
          <span>{user.email}</span>
        </div>
        <div className="admin-header-actions">
          <a href="/">Voir le formulaire</a>
          <button type="button" onClick={() => signOut(auth)}>Déconnexion</button>
        </div>
      </header>

      {loading ? <p className="admin-state">Chargement…</p> : null}
      {error ? <p className="admin-error">{error}</p> : null}
      {!loading && !items.length ? (
        <div className="admin-empty">
          <span>♡</span>
          <h2>Aucune demande pour le moment</h2>
          <p>Les nouveaux liens apparaîtront ici automatiquement.</p>
        </div>
      ) : null}

      <section className="request-grid">
        {items.map((item) => (
          <article className={`request-card ${item.status === "handled" ? "is-handled" : ""}`} key={item.id}>
            <div className="request-topline">
              <div>
                <strong>{item.reference}</strong>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              <span className={`status-pill ${item.status}`}>
                {item.status === "handled" ? "Traitée" : "Nouvelle"}
              </span>
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

            <div className="request-actions">
              <a className="whatsapp-button" href={whatsappMessage(item)} target="_blank" rel="noreferrer">
                Répondre sur WhatsApp
              </a>
              <button className="handled-button" type="button" onClick={() => toggleStatus(item)}>
                {item.status === "handled" ? "Remettre en attente" : "Marquer comme traitée"}
              </button>
            </div>
          </article>
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
