import { lazy, Suspense, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "./firebase";

const Admin = lazy(() => import("./Admin"));

const copy = {
  fr: {
    language: "العربية",
    response: "Réponse dans votre conversation",
    eyebrow: "Service d’achat en ligne",
    title: (
      <>
        Envoyez vos articles.
        <br />
        On s’occupe du reste.
      </>
    ),
    description:
      "Ajoutez le lien ou la référence de chaque article. Nous vérifions le prix et la disponibilité, puis nous vous répondons dans votre conversation avec Yuna’s Shop.",
    productsLabel: "Vos articles",
    productsHint: "Un article par fiche",
    product: "Article",
    linkLabel: "Lien de l’article",
    linkHint: "Facultatif si vous avez la référence",
    linkPlaceholder: "https://...",
    identifierLabel: "ID / SKU / Référence",
    identifierHint: "Facultatif si vous avez le lien",
    identifierPlaceholder: "Ex. 12345678 ou sw220...",
    addProduct: "Ajouter un autre article",
    removeProduct: "Retirer",
    submit: "Envoyer ma demande",
    sending: "Envoi en cours…",
    trust: "Prix et disponibilité vérifiés avant notre réponse.",
    privacy: "Aucun pseudo ni numéro à saisir.",
    invalidProduct: "Ajoutez un lien ou un ID / SKU / référence pour chaque article.",
    invalidLink: "Vérifiez les liens : ils doivent commencer par http:// ou https://.",
    tooManyProducts: "Vous pouvez envoyer jusqu’à 30 articles par demande.",
    error: "La demande n’a pas pu être envoyée. Réessayez dans un instant.",
    configError: "Le formulaire est momentanément indisponible.",
    invalidConversationLink: "Ce lien de conversation n’est pas valide ou a été modifié.",
    successTitle: "Demande bien reçue",
    linkedSuccess:
      "Votre demande est automatiquement liée à notre conversation. Vous n’avez rien d’autre à envoyer.",
    publicSuccess:
      "Copiez cette référence et envoyez-la dans votre conversation avec Yuna’s Shop pour que nous puissions vous retrouver.",
    reference: "Votre référence",
    copyReference: "Copier la référence",
    copiedReference: "Référence copiée ✓",
    closePage: "Vous pouvez maintenant fermer cette page.",
    another: "Envoyer une autre demande",
  },
  ar: {
    language: "Français",
    response: "الرد في نفس المحادثة",
    eyebrow: "خدمة الشراء عبر الإنترنت",
    title: (
      <>
        أرسلي المنتجات.
        <br />
        ونحن نتكفل بالباقي.
      </>
    ),
    description:
      "أضيفي رابط أو مرجع كل منتج. نتحقق من السعر والتوفر، ثم نرد عليك في محادثتك مع Yuna’s Shop.",
    productsLabel: "منتجاتك",
    productsHint: "كل منتج في خانة مستقلة",
    product: "المنتج",
    linkLabel: "رابط المنتج",
    linkHint: "اختياري إذا كان لديك المرجع",
    linkPlaceholder: "https://...",
    identifierLabel: "ID / SKU / المرجع",
    identifierHint: "اختياري إذا كان لديك الرابط",
    identifierPlaceholder: "مثال: 12345678 أو sw220...",
    addProduct: "إضافة منتج آخر",
    removeProduct: "حذف",
    submit: "إرسال الطلب",
    sending: "جارٍ الإرسال…",
    trust: "نتحقق من السعر والتوفر قبل الرد عليك.",
    privacy: "لا حاجة لكتابة اسم الحساب أو رقم الهاتف.",
    invalidProduct: "أضيفي رابطاً أو ID / SKU / مرجعاً لكل منتج.",
    invalidLink: "تحققي من الروابط: يجب أن تبدأ بـ http:// أو https://.",
    tooManyProducts: "يمكنك إرسال 30 منتجاً كحد أقصى في الطلب الواحد.",
    error: "تعذر إرسال الطلب. حاولي مرة أخرى بعد قليل.",
    configError: "الخدمة غير متاحة مؤقتاً.",
    invalidConversationLink: "رابط المحادثة غير صالح أو تم تغييره.",
    successTitle: "تم استلام طلبك",
    linkedSuccess:
      "تم ربط طلبك تلقائياً بمحادثتنا. لا تحتاجين إلى إرسال أي شيء آخر.",
    publicSuccess:
      "انسخي رقم الطلب وأرسليه في محادثتك مع Yuna’s Shop حتى نتمكن من العثور على طلبك.",
    reference: "رقم طلبك",
    copyReference: "نسخ رقم الطلب",
    copiedReference: "تم نسخ الرقم ✓",
    closePage: "يمكنك الآن إغلاق هذه الصفحة.",
    another: "إرسال طلب آخر",
  },
};

const EMPTY_PRODUCT = { link: "", identifier: "" };

function isValidWebLink(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function createReference() {
  const date = new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `YS-${year}${month}-${random}`;
}

function isValidConversationReference(value) {
  return /^YS-META-[A-Z0-9]{10}$/.test(value);
}

function getConversationReference(pathname) {
  if (!pathname.startsWith("/d/")) return "";
  try {
    return decodeURIComponent(pathname.slice(3)).toUpperCase();
  } catch {
    return "";
  }
}

function RequestForm({ conversationReference = "", invalidConversationLink = false }) {
  const [locale, setLocale] = useState("fr");
  const [products, setProducts] = useState([{ ...EMPTY_PRODUCT }]);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [fieldError, setFieldError] = useState("");
  const [reference, setReference] = useState("");
  const [referenceCopied, setReferenceCopied] = useState(false);
  const t = copy[locale];
  const isArabic = locale === "ar";
  const isLinkedConversation = Boolean(conversationReference);

  function updateProduct(index, field, value) {
    setProducts((current) =>
      current.map((product, productIndex) =>
        productIndex === index ? { ...product, [field]: value } : product,
      ),
    );
  }

  function addProduct() {
    if (products.length >= 30) {
      setFieldError(t.tooManyProducts);
      return;
    }
    setProducts((current) => [...current, { ...EMPTY_PRODUCT }]);
    setFieldError("");
  }

  function removeProduct(index) {
    setProducts((current) => current.filter((_, productIndex) => productIndex !== index));
  }

  async function submit(event) {
    event.preventDefault();
    setFieldError("");
    setStatus("idle");

    if (website) return;

    const cleanedProducts = products.map((product) => ({
      link: product.link.trim(),
      identifier: product.identifier.trim(),
    }));
    if (
      !cleanedProducts.length ||
      cleanedProducts.some((product) => !product.link && !product.identifier)
    ) {
      setFieldError(t.invalidProduct);
      return;
    }
    if (cleanedProducts.some((product) => !isValidWebLink(product.link))) {
      setFieldError(t.invalidLink);
      return;
    }
    if (cleanedProducts.length > 30) {
      setFieldError(t.tooManyProducts);
      return;
    }
    if (invalidConversationLink) {
      setFieldError(t.invalidConversationLink);
      return;
    }
    if (!firebaseReady || !db) {
      setFieldError(t.configError);
      return;
    }

    setStatus("sending");
    try {
      const nextReference = conversationReference || createReference();
      const productLinks = cleanedProducts.map((product) => product.link).filter(Boolean);
      const requests = collection(
        db,
        "artifacts",
        "yunas-shop-crm",
        "public",
        "data",
        "linkRequests",
      );
      await setDoc(
        doc(requests, nextReference),
        {
          reference: nextReference,
          requestItems: cleanedProducts,
          links: productLinks,
          responseChannel: "instagram",
          responseContact: isLinkedConversation
            ? `meta:${nextReference}`
            : `story:${nextReference}`,
          whatsapp: "",
          locale,
          status: "new",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      );

      setReference(nextReference);
      setProducts([{ ...EMPTY_PRODUCT }]);
      setStatus("success");
    } catch (error) {
      console.error("Unable to create request", error);
      setStatus("error");
    }
  }

  function reset() {
    setReference("");
    setFieldError("");
    setReferenceCopied(false);
    setStatus("idle");
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference);
      setReferenceCopied(true);
    } catch {
      setFieldError(t.error);
    }
  }

  return (
    <main className={`site-shell ${isArabic ? "is-arabic" : ""}`} dir={isArabic ? "rtl" : "ltr"}>
      <header className="site-header">
        <a className="brand brand-with-logo" href="/" aria-label="Yuna's Shop">
          <img src="/logo-yunas-shop.jpg" alt="" />
          <span>Yuna’s Shop</span>
        </a>
        <div className="header-actions">
          <span className="whatsapp-note">
            <span aria-hidden="true">◉</span>
            {t.response}
          </span>
          <button
            className="language-button"
            type="button"
            onClick={() => setLocale(isArabic ? "fr" : "ar")}
          >
            {t.language}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <div className="title-rule" aria-hidden="true"><span /></div>
          <p className="description">{t.description}</p>
          <div className="steps" aria-label={isArabic ? "طريقة الطلب" : "Comment ça marche"}>
            <span><b>1</b>{isArabic ? "أضيفي المنتجات" : "Ajoutez les articles"}</span>
            <span><b>2</b>{isArabic ? "نحن نتحقق" : "Nous vérifions"}</span>
            <span><b>3</b>{isArabic ? "نرد عليك" : "Réponse dans Meta"}</span>
          </div>
        </div>

        <div className="form-card">
          {status === "success" ? (
            <div className="success-panel" role="status">
              <span className="success-icon" aria-hidden="true">✓</span>
              <p className="success-kicker">{t.successTitle}</p>
              <h2>{isLinkedConversation ? t.linkedSuccess : t.publicSuccess}</h2>
              <div className="reference-card">
                <span>{t.reference}</span>
                <strong dir="ltr">{reference}</strong>
              </div>
              {isLinkedConversation ? (
                <p className="success-close-note">{t.closePage}</p>
              ) : (
                <>
                  <button className="primary-button" type="button" onClick={copyReference}>
                    {referenceCopied ? t.copiedReference : t.copyReference}
                  </button>
                  {fieldError ? <p className="form-error" role="alert">{fieldError}</p> : null}
                  <button className="secondary-text-button" type="button" onClick={reset}>
                    {t.another}
                  </button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="field-heading">
                <label>{t.productsLabel}</label>
                <span>{t.productsHint}</span>
              </div>

              <div className="product-request-list">
                {products.map((product, index) => (
                  <section className="product-request-card" key={index}>
                    <div className="product-request-heading">
                      <strong>{t.product} {index + 1}</strong>
                      {products.length > 1 ? (
                        <button type="button" onClick={() => removeProduct(index)}>
                          {t.removeProduct}
                        </button>
                      ) : null}
                    </div>
                    <label>
                      <span>{t.linkLabel}</span>
                      <small>{t.linkHint}</small>
                      <input
                        type="url"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        value={product.link}
                        onChange={(event) => updateProduct(index, "link", event.target.value)}
                        placeholder={t.linkPlaceholder}
                      />
                    </label>
                    <div className="product-or"><span>{isArabic ? "أو" : "OU"}</span></div>
                    <label>
                      <span>{t.identifierLabel}</span>
                      <small>{t.identifierHint}</small>
                      <input
                        type="text"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={product.identifier}
                        onChange={(event) => updateProduct(index, "identifier", event.target.value)}
                        placeholder={t.identifierPlaceholder}
                      />
                    </label>
                  </section>
                ))}
              </div>

              <button className="add-product-button" type="button" onClick={addProduct}>
                <span aria-hidden="true">＋</span>{t.addProduct}
              </button>

              <div className="honeypot" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  tabIndex="-1"
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              {fieldError ? <p className="form-error" role="alert">{fieldError}</p> : null}
              {status === "error" ? <p className="form-error" role="alert">{t.error}</p> : null}

              <button className="primary-button" type="submit" disabled={status === "sending"}>
                {status === "sending" ? t.sending : t.submit}
              </button>
              <p className="trust-line"><span aria-hidden="true">✓</span>{t.trust}</p>
              <p className="privacy-line">{t.privacy}</p>
            </form>
          )}
        </div>
      </section>

      <footer className="site-footer">
        <a href="https://www.instagram.com/yunas.shop/" target="_blank" rel="noreferrer">
          Instagram · @yunas.shop
        </a>
        <span>Yuna’s Shop — votre intermédiaire d’achat en Algérie</span>
      </footer>

      <div className="botanical botanical-left" aria-hidden="true"><span /><i /><b /></div>
      <div className="botanical botanical-right" aria-hidden="true"><span /></div>
    </main>
  );
}

export default function App() {
  const pathname = window.location.pathname;
  const conversationPath = pathname.startsWith("/d/");
  const conversationReference = getConversationReference(pathname);
  const validConversationReference = isValidConversationReference(conversationReference)
    ? conversationReference
    : "";

  return pathname.startsWith("/admin") ? (
    <Suspense fallback={<main className="admin-shell"><p>Chargement…</p></main>}>
      <Admin />
    </Suspense>
  ) : (
    <RequestForm
      conversationReference={validConversationReference}
      invalidConversationLink={conversationPath && !validConversationReference}
    />
  );
}
