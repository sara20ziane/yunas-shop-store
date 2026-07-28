import { lazy, Suspense, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, firebaseReady } from "./firebase";

const Admin = lazy(() => import("./Admin"));

const copy = {
  fr: {
    language: "العربية",
    response: "Réponse sur le canal de votre choix",
    eyebrow: "Service d’achat en ligne",
    title: (
      <>
        Envoyez vos articles.
        <br />
        On s’occupe du reste.
      </>
    ),
    description:
      "Ajoutez le lien ou la référence de chaque article. Nous vérifions le prix et la disponibilité, puis nous vous répondons où vous préférez.",
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
    responseChannelLabel: "Où souhaitez-vous recevoir notre réponse ?",
    responseChannels: {
      instagram: "Instagram",
      messenger: "Messenger",
      whatsapp: "WhatsApp",
    },
    contactLabels: {
      instagram: "Votre pseudo Instagram",
      messenger: "Votre profil Messenger / Facebook",
      whatsapp: "Votre numéro WhatsApp",
    },
    contactHints: {
      instagram: "Ex. @votre.pseudo",
      messenger: "Collez le lien du profil ou indiquez votre nom",
      whatsapp: "Numéro algérien 05, 06 ou 07",
    },
    contactPlaceholders: {
      instagram: "@votre.pseudo",
      messenger: "Lien du profil ou nom Facebook",
      whatsapp: "05 00 00 00 00",
    },
    submit: "Envoyer ma demande",
    sending: "Envoi en cours…",
    trust: "Prix et disponibilité vérifiés avant notre réponse.",
    privacy: "Votre contact est utilisé uniquement pour répondre à cette demande.",
    invalidProduct: "Ajoutez un lien ou un ID / SKU / référence pour chaque article.",
    invalidLink: "Vérifiez les liens : ils doivent commencer par http:// ou https://.",
    tooManyProducts: "Vous pouvez envoyer jusqu’à 30 articles par demande.",
    invalidContacts: {
      instagram: "Saisissez un pseudo Instagram valide.",
      messenger: "Indiquez votre nom ou le lien de votre profil Messenger / Facebook.",
      whatsapp: "Saisissez un numéro algérien commençant par 05, 06 ou 07.",
    },
    error: "La demande n’a pas pu être envoyée. Réessayez dans un instant.",
    configError: "Le formulaire est momentanément indisponible.",
    successTitle: "Demande bien reçue",
    successText: "Nous vérifions vos articles et nous vous répondrons prochainement via",
    reference: "Votre référence",
    another: "Envoyer une autre demande",
  },
  ar: {
    language: "Français",
    response: "الرد عبر الوسيلة التي تختارينها",
    eyebrow: "خدمة الشراء عبر الإنترنت",
    title: (
      <>
        أرسلي المنتجات.
        <br />
        ونحن نتكفل بالباقي.
      </>
    ),
    description:
      "أضيفي رابط أو مرجع كل منتج. نتحقق من السعر والتوفر، ثم نرد عليك عبر الوسيلة التي تفضلينها.",
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
    responseChannelLabel: "أين تفضلين استلام ردنا؟",
    responseChannels: {
      instagram: "إنستغرام",
      messenger: "ماسنجر",
      whatsapp: "واتساب",
    },
    contactLabels: {
      instagram: "اسم حسابك على إنستغرام",
      messenger: "حسابك على ماسنجر / فيسبوك",
      whatsapp: "رقم واتساب",
    },
    contactHints: {
      instagram: "مثال: @votre.pseudo",
      messenger: "الصقي رابط الحساب أو اكتبي اسمك",
      whatsapp: "رقم جزائري يبدأ بـ 05 أو 06 أو 07",
    },
    contactPlaceholders: {
      instagram: "@votre.pseudo",
      messenger: "رابط الحساب أو الاسم على فيسبوك",
      whatsapp: "05 00 00 00 00",
    },
    submit: "إرسال الطلب",
    sending: "جارٍ الإرسال…",
    trust: "نتحقق من السعر والتوفر قبل الرد عليك.",
    privacy: "تُستخدم معلومات الاتصال فقط للرد على هذا الطلب.",
    invalidProduct: "أضيفي رابطاً أو ID / SKU / مرجعاً لكل منتج.",
    invalidLink: "تحققي من الروابط: يجب أن تبدأ بـ http:// أو https://.",
    tooManyProducts: "يمكنك إرسال 30 منتجاً كحد أقصى في الطلب الواحد.",
    invalidContacts: {
      instagram: "أدخلي اسم حساب إنستغرام صحيحاً.",
      messenger: "أدخلي اسمك أو رابط حسابك على ماسنجر / فيسبوك.",
      whatsapp: "أدخلي رقماً جزائرياً يبدأ بـ 05 أو 06 أو 07.",
    },
    error: "تعذر إرسال الطلب. حاولي مرة أخرى بعد قليل.",
    configError: "الخدمة غير متاحة مؤقتاً.",
    successTitle: "تم استلام طلبك",
    successText: "سنتحقق من المنتجات ونرد عليك قريباً عبر",
    reference: "رقم طلبك",
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

function normalizeWhatsapp(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00213")) digits = digits.slice(2);
  if (digits.startsWith("213")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `213${digits}`;
}

function normalizeInstagram(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("instagram.com")) {
      return url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "") || "";
    }
  } catch {
    // Most customers will enter a username rather than a complete URL.
  }
  return trimmed.replace(/^@/, "");
}

function normalizeContact(channel, value) {
  if (channel === "whatsapp") return normalizeWhatsapp(value);
  if (channel === "instagram") return normalizeInstagram(value);
  return value.trim();
}

function createReference() {
  const date = new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `YS-${year}${month}-${random}`;
}

function RequestForm() {
  const [locale, setLocale] = useState("fr");
  const [products, setProducts] = useState([{ ...EMPTY_PRODUCT }]);
  const [responseChannel, setResponseChannel] = useState("instagram");
  const [responseContact, setResponseContact] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [fieldError, setFieldError] = useState("");
  const [reference, setReference] = useState("");
  const t = copy[locale];
  const isArabic = locale === "ar";

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

  function selectResponseChannel(channel) {
    setResponseChannel(channel);
    setResponseContact("");
    setFieldError("");
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

    const normalizedContact = normalizeContact(responseChannel, responseContact);
    const validContact =
      responseChannel === "whatsapp"
        ? /^213[567]\d{8}$/.test(normalizedContact)
        : responseChannel === "instagram"
          ? /^[A-Za-z0-9._]{1,30}$/.test(normalizedContact)
          : normalizedContact.length >= 2 && normalizedContact.length <= 150;
    if (!validContact) {
      setFieldError(t.invalidContacts[responseChannel]);
      return;
    }
    if (!firebaseReady || !db) {
      setFieldError(t.configError);
      return;
    }

    setStatus("sending");
    try {
      const nextReference = createReference();
      const productLinks = cleanedProducts.map((product) => product.link).filter(Boolean);
      await addDoc(
        collection(
          db,
          "artifacts",
          "yunas-shop-crm",
          "public",
          "data",
          "linkRequests",
        ),
        {
          reference: nextReference,
          requestItems: cleanedProducts,
          links: productLinks,
          responseChannel,
          responseContact: normalizedContact,
          whatsapp: responseChannel === "whatsapp" ? normalizedContact : "",
          locale,
          status: "new",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      );

      setReference(nextReference);
      setProducts([{ ...EMPTY_PRODUCT }]);
      setResponseContact("");
      setStatus("success");
    } catch (error) {
      console.error("Unable to create request", error);
      setStatus("error");
    }
  }

  function reset() {
    setReference("");
    setFieldError("");
    setStatus("idle");
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
            <span><b>3</b>{isArabic ? "نرد عليك" : "Réponse au choix"}</span>
          </div>
        </div>

        <div className="form-card">
          {status === "success" ? (
            <div className="success-panel" role="status">
              <span className="success-icon" aria-hidden="true">✓</span>
              <p className="success-kicker">{t.successTitle}</p>
              <h2>
                {t.successText} {t.responseChannels[responseChannel]}.
              </h2>
              <div className="reference-card">
                <span>{t.reference}</span>
                <strong dir="ltr">{reference}</strong>
              </div>
              <button className="primary-button" type="button" onClick={reset}>
                {t.another}
              </button>
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

              <fieldset className="response-channel-fieldset">
                <legend>{t.responseChannelLabel}</legend>
                <div className="response-channel-options">
                  {["instagram", "messenger", "whatsapp"].map((channel) => (
                    <label
                      className={responseChannel === channel ? "selected" : ""}
                      key={channel}
                    >
                      <input
                        type="radio"
                        name="responseChannel"
                        value={channel}
                        checked={responseChannel === channel}
                        onChange={() => selectResponseChannel(channel)}
                      />
                      <span>{t.responseChannels[channel]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="field-heading contact-heading">
                <label htmlFor="response-contact">{t.contactLabels[responseChannel]}</label>
                <span>{t.contactHints[responseChannel]}</span>
              </div>
              {responseChannel === "whatsapp" ? (
                <div className="phone-field" dir="ltr">
                  <span>+213</span>
                  <input
                    id="response-contact"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={responseContact}
                    onChange={(event) => setResponseContact(event.target.value)}
                    placeholder={t.contactPlaceholders.whatsapp}
                    required
                  />
                </div>
              ) : (
                <input
                  className="contact-field"
                  id="response-contact"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={responseContact}
                  onChange={(event) => setResponseContact(event.target.value)}
                  placeholder={t.contactPlaceholders[responseChannel]}
                  required
                />
              )}

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
  return window.location.pathname.startsWith("/admin") ? (
    <Suspense fallback={<main className="admin-shell"><p>Chargement…</p></main>}>
      <Admin />
    </Suspense>
  ) : <RequestForm />;
}
