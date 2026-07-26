import { lazy, Suspense, useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, firebaseReady } from "./firebase";

const Admin = lazy(() => import("./Admin"));

const copy = {
  fr: {
    language: "العربية",
    response: "Réponse sur WhatsApp",
    eyebrow: "Service d’achat en ligne",
    title: (
      <>
        Envoyez vos liens.
        <br />
        On s’occupe du reste.
      </>
    ),
    description:
      "Partagez les liens des articles qui vous intéressent. Nous vérifions les prix et la disponibilité, puis nous vous répondons sur WhatsApp.",
    linksLabel: "Vos liens",
    linksHint: "Collez un lien par ligne",
    linksPlaceholder: "https://...\nhttps://...",
    whatsappLabel: "Numéro WhatsApp",
    whatsappHint: "Pour recevoir notre réponse",
    whatsappPlaceholder: "05 00 00 00 00",
    submit: "Envoyer ma demande",
    sending: "Envoi en cours…",
    trust: "Prix et disponibilité vérifiés avant notre réponse.",
    privacy: "Votre numéro est utilisé uniquement pour répondre à cette demande.",
    invalidLinks: "Ajoutez au moins un lien commençant par http:// ou https://.",
    tooManyLinks: "Vous pouvez envoyer jusqu’à 30 liens par demande.",
    invalidWhatsapp: "Saisissez un numéro algérien commençant par 05, 06 ou 07.",
    error: "La demande n’a pas pu être envoyée. Réessayez dans un instant.",
    configError: "Le formulaire est momentanément indisponible.",
    successTitle: "Demande bien reçue",
    successText:
      "Nous vérifions vos liens et nous vous répondrons prochainement sur WhatsApp.",
    reference: "Votre référence",
    another: "Envoyer une autre demande",
  },
  ar: {
    language: "Français",
    response: "الرد عبر واتساب",
    eyebrow: "خدمة الشراء عبر الإنترنت",
    title: (
      <>
        أرسلي الروابط.
        <br />
        ونحن نتكفل بالباقي.
      </>
    ),
    description:
      "شاركي روابط المنتجات التي أعجبتك. نتحقق من السعر والتوفر، ثم نرد عليك عبر واتساب.",
    linksLabel: "روابط المنتجات",
    linksHint: "الصقي رابطاً واحداً في كل سطر",
    linksPlaceholder: "https://...\nhttps://...",
    whatsappLabel: "رقم واتساب",
    whatsappHint: "لاستلام ردنا",
    whatsappPlaceholder: "05 00 00 00 00",
    submit: "إرسال الطلب",
    sending: "جارٍ الإرسال…",
    trust: "نتحقق من السعر والتوفر قبل الرد عليك.",
    privacy: "يُستخدم رقمك فقط للرد على هذا الطلب.",
    invalidLinks: "أضيفي رابطاً واحداً على الأقل يبدأ بـ http:// أو https://.",
    tooManyLinks: "يمكنك إرسال 30 رابطاً كحد أقصى في الطلب الواحد.",
    invalidWhatsapp: "أدخلي رقماً جزائرياً يبدأ بـ 05 أو 06 أو 07.",
    error: "تعذر إرسال الطلب. حاولي مرة أخرى بعد قليل.",
    configError: "الخدمة غير متاحة مؤقتاً.",
    successTitle: "تم استلام طلبك",
    successText: "سنتحقق من الروابط ونرد عليك قريباً عبر واتساب.",
    reference: "رقم طلبك",
    another: "إرسال طلب آخر",
  },
};

function parseLinks(value) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const unique = [...new Set(lines)];
  const valid = unique.filter((line) => {
    try {
      const url = new URL(line);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });

  return { lines, valid };
}

function normalizeWhatsapp(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00213")) digits = digits.slice(2);
  if (digits.startsWith("213")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `213${digits}`;
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
  const [links, setLinks] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [fieldError, setFieldError] = useState("");
  const [reference, setReference] = useState("");
  const t = copy[locale];
  const isArabic = locale === "ar";
  const linkCount = useMemo(() => parseLinks(links).valid.length, [links]);

  async function submit(event) {
    event.preventDefault();
    setFieldError("");
    setStatus("idle");

    if (website) return;

    const parsed = parseLinks(links);
    if (!parsed.lines.length || parsed.valid.length !== parsed.lines.length) {
      setFieldError(t.invalidLinks);
      return;
    }
    if (parsed.valid.length > 30) {
      setFieldError(t.tooManyLinks);
      return;
    }

    const normalizedWhatsapp = normalizeWhatsapp(whatsapp);
    if (!/^213[567]\d{8}$/.test(normalizedWhatsapp)) {
      setFieldError(t.invalidWhatsapp);
      return;
    }
    if (!firebaseReady || !db) {
      setFieldError(t.configError);
      return;
    }

    setStatus("sending");
    try {
      const nextReference = createReference();
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
          links: parsed.valid,
          whatsapp: normalizedWhatsapp,
          locale,
          status: "new",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      );

      setReference(nextReference);
      setLinks("");
      setWhatsapp("");
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
            <span><b>1</b>{isArabic ? "الصقي الروابط" : "Collez les liens"}</span>
            <span><b>2</b>{isArabic ? "نحن نتحقق" : "Nous vérifions"}</span>
            <span><b>3</b>{isArabic ? "نرد عبر واتساب" : "Réponse WhatsApp"}</span>
          </div>
        </div>

        <div className="form-card">
          {status === "success" ? (
            <div className="success-panel" role="status">
              <span className="success-icon" aria-hidden="true">✓</span>
              <p className="success-kicker">{t.successTitle}</p>
              <h2>{t.successText}</h2>
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
                <label htmlFor="links">{t.linksLabel}</label>
                <span>{t.linksHint}</span>
              </div>
              <textarea
                id="links"
                value={links}
                onChange={(event) => setLinks(event.target.value)}
                placeholder={t.linksPlaceholder}
                rows="7"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                required
              />
              <div className="link-counter" aria-live="polite">
                {linkCount > 0
                  ? isArabic
                    ? `${linkCount} رابط`
                    : `${linkCount} lien${linkCount > 1 ? "s" : ""}`
                  : ""}
              </div>

              <div className="field-heading whatsapp-heading">
                <label htmlFor="whatsapp">{t.whatsappLabel}</label>
                <span>{t.whatsappHint}</span>
              </div>
              <div className="phone-field" dir="ltr">
                <span>+213</span>
                <input
                  id="whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder={t.whatsappPlaceholder}
                  required
                />
              </div>

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
