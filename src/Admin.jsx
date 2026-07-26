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

function getPriceCoefficient(priceEur) {
  const price = Number(priceEur) || 0;
  if (price >= 30) return 1.2;
  if (price >= 15) return 1.25;
  return 1.3;
}

function calculateSimulatedPrice(quoteItem) {
  const priceEur = Number(quoteItem.priceEur) || 0;
  const rate = Number(quoteItem.rate) || 0;
  const coefficient = getPriceCoefficient(priceEur);
  const purchaseDa = priceEur * rate;
  const logisticsDa =
    quoteItem.logMode === "weight"
      ? ((Number(quoteItem.weightG) || 0) / 1000) * 2200
      : Number(quoteItem.fixedLogisticsDa) || 0;
  const finalPrice = purchaseDa * coefficient + logisticsDa;
  const estimatedProfit = finalPrice - purchaseDa - logisticsDa;
  return { coefficient, purchaseDa, logisticsDa, finalPrice, estimatedProfit };
}

function roundToNearestHundred(value) {
  return Math.round((Number(value) || 0) / 100) * 100;
}

function getIdentifiers(quoteItem) {
  return [
    quoteItem.productId ? `ID: ${quoteItem.productId}` : "",
    quoteItem.sku ? `SKU: ${quoteItem.sku}` : "",
    quoteItem.productReference ? `Réf: ${quoteItem.productReference}` : "",
  ].filter(Boolean);
}

const IMAGE_DATABASE = "yunas-shop-quote-images";
const IMAGE_STORE = "captures";

function openImageDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE)) {
        request.result.createObjectStore(IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredImage(key) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readonly");
    const request = transaction.objectStore(IMAGE_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function storeImage(key, blob) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readwrite");
    transaction.objectStore(IMAGE_STORE).put(blob, key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function removeStoredImage(key) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readwrite");
    transaction.objectStore(IMAGE_STORE).delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      resolve(image);
    };
    image.onerror = reject;
    image.src = URL.createObjectURL(source);
  });
}

async function compressCapture(file) {
  const image = await loadImage(file);
  const maximumSide = 1400;
  const scale = Math.min(1, maximumSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image compression failed"))),
      "image/jpeg",
      0.84,
    );
  });
}

async function createPricedVisual(capture, quoteItem) {
  const image = await loadImage(capture);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);

  const label = `${formatAmount(quoteItem.priceDa)} DA`;
  const fontSize = Math.max(34, Math.round(canvas.width * 0.085));
  context.font = `800 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const horizontalPadding = fontSize * 0.55;
  const verticalPadding = fontSize * 0.34;
  const labelWidth = context.measureText(label).width + horizontalPadding * 2;
  const labelHeight = fontSize + verticalPadding * 2;
  const x = canvas.width / 2;
  const y = canvas.height / 2;
  const left = x - labelWidth / 2;
  const top = y - labelHeight / 2;
  const radius = Math.min(24, labelHeight / 4);

  context.fillStyle = "rgba(255, 255, 255, 0.96)";
  context.beginPath();
  context.roundRect(left, top, labelWidth, labelHeight, radius);
  context.fill();
  context.fillStyle = "#111111";
  context.fillText(label, x, y + fontSize * 0.04);

  const identifiers = getIdentifiers(quoteItem).join("  •  ");
  if (identifiers) {
    const identifierFontSize = Math.max(18, Math.round(canvas.width * 0.032));
    context.font = `700 ${identifierFontSize}px Arial, sans-serif`;
    const maxIdentifierWidth = canvas.width * 0.88;
    let visibleIdentifiers = identifiers;
    while (
      visibleIdentifiers.length > 8 &&
      context.measureText(visibleIdentifiers).width > maxIdentifierWidth
    ) {
      visibleIdentifiers = `${visibleIdentifiers.slice(0, -4)}…`;
    }
    const identifierWidth = Math.min(
      maxIdentifierWidth,
      context.measureText(visibleIdentifiers).width + identifierFontSize * 1.6,
    );
    const identifierHeight = identifierFontSize * 2.25;
    const identifierLeft = (canvas.width - identifierWidth) / 2;
    const identifierTop = canvas.height - identifierHeight - canvas.height * 0.045;
    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.beginPath();
    context.roundRect(
      identifierLeft,
      identifierTop,
      identifierWidth,
      identifierHeight,
      Math.min(18, identifierHeight / 4),
    );
    context.fill();
    context.fillStyle = "#3a2a2d";
    context.font = `700 ${identifierFontSize}px Arial, sans-serif`;
    context.fillText(
      visibleIdentifiers,
      canvas.width / 2,
      identifierTop + identifierHeight / 2,
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Visual creation failed"))),
      "image/jpeg",
      0.92,
    );
  });
}

function downloadVisual(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function whatsappMessage(item, details) {
  const total = formatAmount(details.totalDa);
  const deposit = formatAmount(details.depositDa);
  const delay = details.estimatedDelay?.trim();
  const lines =
    item.locale === "ar"
      ? [
          `السلام عليكم، هذا عرض سعر طلبك ${item.reference} من Yuna’s Shop:`,
          "أرسلت لكِ سعر كل منتج على صورته.",
          total ? `المبلغ الإجمالي: ${total} دج` : "",
          deposit ? `التسبيق 50٪ من المجموع: ${deposit} دج` : "",
          delay ? `المدة التقريبية: ${delay}` : "",
          "إذا وافقتِ على الطلب، أكّدي لنا هنا من فضلك 🤍",
        ]
      : [
          `Bonjour, voici le devis de votre demande ${item.reference} chez Yuna’s Shop :`,
          "Je vous ai indiqué le prix directement sur chaque photo.",
          total ? `Montant total : ${total} DA` : "",
          deposit ? `Acompte de 50 % sur le total : ${deposit} DA` : "",
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
  const initialQuoteItems = (item.links || []).map((link, index) => {
    const existing =
      item.quoteItems?.find((quoteItem) => quoteItem.link === link) ||
      item.quoteItems?.[index];
    return {
      link,
      priceDa: existing?.priceDa || "",
      productId: existing?.productId || "",
      sku: existing?.sku || "",
      productReference: existing?.productReference || "",
      priceEur: existing?.priceEur || "",
      rate: existing?.rate || 310,
      logMode: existing?.logMode || "fixed",
      weightG: existing?.weightG || "",
      fixedLogisticsDa: existing?.fixedLogisticsDa || "",
    };
  });
  const [quoteItems, setQuoteItems] = useState(initialQuoteItems);
  const [captures, setCaptures] = useState({});
  const [estimatedDelay, setEstimatedDelay] = useState(item.estimatedDelay || "");
  const [privateNote, setPrivateNote] = useState(item.privateNote || "");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visualInProgress, setVisualInProgress] = useState("");
  const status = normalizeStatus(item.status);
  const totalDa = useMemo(
    () => quoteItems.reduce((total, quoteItem) => total + (Number(quoteItem.priceDa) || 0), 0),
    [quoteItems],
  );
  const depositDa = totalDa ? Math.round(totalDa / 2) : 0;
  const details = { totalDa, depositDa, estimatedDelay, privateNote };

  useEffect(() => {
    let active = true;
    const previewUrls = [];

    Promise.all(
      (item.links || []).map(async (link, index) => {
        try {
          const blob = await readStoredImage(`${item.id}:${index}:${link}`);
          if (!blob) return null;
          const previewUrl = URL.createObjectURL(blob);
          previewUrls.push(previewUrl);
          return [index, { blob, previewUrl }];
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (active) setCaptures(Object.fromEntries(results.filter(Boolean)));
    });

    return () => {
      active = false;
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [item.id, item.links]);

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
        quoteItems: quoteItems.map((quoteItem) => ({
          link: quoteItem.link,
          priceDa: quoteItem.priceDa ? Number(quoteItem.priceDa) : null,
          productId: quoteItem.productId.trim(),
          sku: quoteItem.sku.trim(),
          productReference: quoteItem.productReference.trim(),
          priceEur: quoteItem.priceEur ? Number(quoteItem.priceEur) : null,
          rate: quoteItem.rate ? Number(quoteItem.rate) : 310,
          logMode: quoteItem.logMode,
          weightG: quoteItem.weightG ? Number(quoteItem.weightG) : null,
          fixedLogisticsDa: quoteItem.fixedLogisticsDa
            ? Number(quoteItem.fixedLogisticsDa)
            : null,
        })),
        totalDa: totalDa || null,
        depositDa: depositDa || null,
        estimatedDelay: estimatedDelay.trim(),
        privateNote: privateNote.trim(),
        ...extra,
      },
      successMessage,
    );
  }

  function changeQuoteItem(index, field, value) {
    setQuoteItems((current) =>
      current.map((quoteItem, quoteIndex) =>
        quoteIndex === index ? { ...quoteItem, [field]: value } : quoteItem,
      ),
    );
  }

  function useSimulatedPrice(index) {
    const simulation = calculateSimulatedPrice(quoteItems[index]);
    changeQuoteItem(index, "priceDa", String(roundToNearestHundred(simulation.finalPrice)));
  }

  async function addCapture(index, file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Choisissez une capture au format image.");
      return;
    }
    try {
      const blob = await compressCapture(file);
      const key = `${item.id}:${index}:${quoteItems[index].link}`;
      await storeImage(key, blob);
      setCaptures((current) => {
        if (current[index]?.previewUrl) URL.revokeObjectURL(current[index].previewUrl);
        return {
          ...current,
          [index]: { blob, previewUrl: URL.createObjectURL(blob) },
        };
      });
      onError("");
    } catch {
      onError("La capture n’a pas pu être ajoutée. Réessayez avec une autre image.");
    }
  }

  async function deleteCapture(index) {
    try {
      await removeStoredImage(`${item.id}:${index}:${quoteItems[index].link}`);
      setCaptures((current) => {
        const next = { ...current };
        if (next[index]?.previewUrl) URL.revokeObjectURL(next[index].previewUrl);
        delete next[index];
        return next;
      });
    } catch {
      onError("La capture n’a pas pu être supprimée.");
    }
  }

  async function shareVisual(index) {
    const capture = captures[index]?.blob;
    const price = quoteItems[index]?.priceDa;
    if (!capture || !Number(price)) {
      onError("Ajoutez la capture et le prix de cet article avant de créer le visuel.");
      return;
    }
    setVisualInProgress(String(index));
    try {
      const visual = await createPricedVisual(capture, quoteItems[index]);
      const filename = `${item.reference}-article-${index + 1}.jpg`;
      const file = new File([visual], filename, { type: "image/jpeg" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Article ${index + 1} · ${item.reference}`,
        });
      } else {
        downloadVisual(visual, filename);
      }
      onError("");
    } catch (error) {
      if (error?.name !== "AbortError") {
        onError("Le visuel n’a pas pu être créé. Réessayez.");
      }
    } finally {
      setVisualInProgress("");
    }
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
        <span>{(item.links || []).length} article{(item.links || []).length > 1 ? "s" : ""}</span>
        <button type="button" onClick={copyLinks}>{copied ? "Liens copiés ✓" : "Copier tous les liens"}</button>
      </div>
      <p className="quote-workflow">
        Ouvrez le lien, ajoutez la capture et saisissez le prix final. Le total et
        l’acompte seront calculés pour toute la commande.
      </p>
      <div className="quote-items">
        {quoteItems.map((quoteItem, index) => {
          const simulation = calculateSimulatedPrice(quoteItem);
          const identifiers = getIdentifiers(quoteItem);
          return (
            <section className="quote-item" key={`${item.id}-${index}`}>
              <div className={`quote-capture ${captures[index] ? "has-capture" : ""}`}>
                {captures[index] ? (
                  <>
                    <img src={captures[index].previewUrl} alt={`Capture de l’article ${index + 1}`} />
                    {Number(quoteItem.priceDa) ? (
                      <strong>{formatAmount(quoteItem.priceDa)} DA</strong>
                    ) : null}
                    {identifiers.length ? <small>{identifiers.join(" · ")}</small> : null}
                  </>
                ) : (
                  <span>Capture<br />article {index + 1}</span>
                )}
              </div>
              <div className="quote-item-fields">
                <div className="quote-item-heading">
                  <strong>Article {index + 1}</strong>
                  <a href={quoteItem.link} target="_blank" rel="noreferrer">
                    Ouvrir le produit ↗
                  </a>
                </div>
                <p title={quoteItem.link}>{quoteItem.link}</p>

                <div className="identifier-fields">
                  <label>
                    <span>ID produit</span>
                    <input
                      value={quoteItem.productId}
                      onChange={(event) => changeQuoteItem(index, "productId", event.target.value)}
                      placeholder="Ex. 12345678"
                    />
                  </label>
                  <label>
                    <span>SKU</span>
                    <input
                      value={quoteItem.sku}
                      onChange={(event) => changeQuoteItem(index, "sku", event.target.value)}
                      placeholder="Ex. sw220..."
                    />
                  </label>
                  <label>
                    <span>Référence</span>
                    <input
                      value={quoteItem.productReference}
                      onChange={(event) =>
                        changeQuoteItem(index, "productReference", event.target.value)
                      }
                      placeholder="Taille, couleur…"
                    />
                  </label>
                </div>

                <details className="price-simulator">
                  <summary>
                    <span>Simulateur de prix CRM</span>
                    <strong>
                      {simulation.finalPrice > 0
                        ? `${formatAmount(simulation.finalPrice)} DA`
                        : "Calculer"}
                    </strong>
                  </summary>
                  <div className="simulator-body">
                    <div className="simulator-main-fields">
                      <label>
                        <span>Prix achat (€)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={quoteItem.priceEur}
                          onChange={(event) =>
                            changeQuoteItem(index, "priceEur", event.target.value)
                          }
                          placeholder="0,00"
                        />
                      </label>
                      <label>
                        <span>Taux actuel</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={quoteItem.rate}
                          onChange={(event) => changeQuoteItem(index, "rate", event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="simulator-info">
                      <span>Coefficient : ×{simulation.coefficient}</span>
                      <span>Achat : {formatAmount(simulation.purchaseDa) || "0"} DA</span>
                    </div>
                    <div className="logistics-mode">
                      <span>Logistique estimée</span>
                      <div>
                        <button
                          type="button"
                          className={quoteItem.logMode === "fixed" ? "active" : ""}
                          onClick={() => changeQuoteItem(index, "logMode", "fixed")}
                        >
                          Prix fixe
                        </button>
                        <button
                          type="button"
                          className={quoteItem.logMode === "weight" ? "active" : ""}
                          onClick={() => changeQuoteItem(index, "logMode", "weight")}
                        >
                          Au poids
                        </button>
                      </div>
                    </div>
                    {quoteItem.logMode === "weight" ? (
                      <label className="simulator-logistics-field">
                        <span>Poids en grammes · 2 200 DA/kg</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={quoteItem.weightG}
                          onChange={(event) =>
                            changeQuoteItem(index, "weightG", event.target.value)
                          }
                          placeholder="Ex. 250"
                        />
                      </label>
                    ) : (
                      <label className="simulator-logistics-field">
                        <span>Montant fixe en DA</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={quoteItem.fixedLogisticsDa}
                          onChange={(event) =>
                            changeQuoteItem(index, "fixedLogisticsDa", event.target.value)
                          }
                          placeholder="Ex. 720"
                        />
                      </label>
                    )}
                    <div className="simulator-result">
                      <div>
                        <span>Prix de vente conseillé</span>
                        <strong>{formatAmount(simulation.finalPrice) || "0"} DA</strong>
                      </div>
                      <small>
                        Bénéfice estimé : {formatAmount(simulation.estimatedProfit) || "0"} DA
                      </small>
                      <button
                        type="button"
                        disabled={simulation.finalPrice <= 0}
                        onClick={() => useSimulatedPrice(index)}
                      >
                        Utiliser ce prix
                      </button>
                    </div>
                  </div>
                </details>

                <label className="final-price-field">
                  <span>Prix final affiché (DA)</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    inputMode="numeric"
                    value={quoteItem.priceDa}
                    onChange={(event) => changeQuoteItem(index, "priceDa", event.target.value)}
                    placeholder="Ex. 1 600"
                  />
                </label>
                <div className="quote-item-actions">
                  <label className="capture-button">
                    {captures[index] ? "Remplacer la capture" : "Ajouter la capture"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        addCapture(index, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {captures[index] ? (
                    <>
                      <button
                        className="visual-button"
                        type="button"
                        disabled={!Number(quoteItem.priceDa) || visualInProgress === String(index)}
                        onClick={() => shareVisual(index)}
                      >
                        {visualInProgress === String(index) ? "Création…" : "Partager le visuel"}
                      </button>
                      <button
                        className="remove-capture-button"
                        type="button"
                        onClick={() => deleteCapture(index)}
                      >
                        Supprimer
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="quote-summary">
        <div>
          <span>Total de la commande</span>
          <strong>{formatAmount(totalDa) || "0"} DA</strong>
        </div>
        <div>
          <span>Acompte global · 50 %</span>
          <strong>{formatAmount(depositDa) || "0"} DA</strong>
        </div>
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
          Envoyer le total sur WhatsApp
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
