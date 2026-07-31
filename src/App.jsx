import { lazy, Suspense, useState } from "react";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "./firebase";
import { DELIVERY_TARIFFS, WILAYAS_58 } from "./deliveryTariffs";

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
    formEyebrow: "Devis gratuit, sans engagement",
    formTitle: "Obtenir le prix de mes articles",
    formIntro: "Collez le lien ou indiquez la référence du premier article.",
    submit: "Obtenir le prix de mes articles",
    sending: "Envoi en cours…",
    trust: "Prix et disponibilité vérifiés avant notre réponse.",
    privacy: "Votre contact sert uniquement à retrouver votre conversation.",
    linkedPrivacy: "Aucun pseudo ni numéro à saisir.",
    linkedFormNotice:
      "Cette demande est déjà liée à notre conversation. Ajoutez seulement vos articles.",
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
      "Dernière étape : envoyez maintenant ce numéro dans votre conversation avec Yuna’s Shop.",
    reference: "Votre référence",
    copyReference: "Copier la référence",
    copiedReference: "Référence copiée ✓",
    sendReference: "Envoyer le numéro dans la messagerie",
    sendingReference: "Ouverture de la messagerie…",
    referenceSent: "Vérifiez que le message a bien été envoyé ✓",
    publicContactTitle: "Pour retrouver votre conversation",
    publicContactIntro:
      "Choisissez où vous nous avez écrit, puis indiquez exactement le nom ou le numéro affiché dans la conversation.",
    contactChannel: "Où nous avez-vous écrit ?",
    contactLabels: {
      instagram: "Instagram",
      messenger: "Messenger",
      whatsapp: "WhatsApp",
    },
    contactFieldLabels: {
      instagram: "Votre pseudo Instagram",
      messenger: "Votre nom sur Messenger",
      whatsapp: "Votre numéro WhatsApp",
    },
    contactPlaceholders: {
      instagram: "Ex. @votre.pseudo",
      messenger: "Le nom affiché dans la conversation",
      whatsapp: "Ex. 0555 00 00 00",
    },
    invalidContact: "Indiquez le même nom, pseudo ou numéro que dans votre conversation.",
    invalidWhatsapp: "Vérifiez le numéro WhatsApp algérien.",
    shareMessage: (reference) =>
      `Bonjour, j’ai envoyé mes articles sur le site Yuna’s Shop. Ma référence est ${reference}.`,
    closePage: "Vous pouvez maintenant fermer cette page.",
    another: "Envoyer une autre demande",
    orderEyebrow: "Procédure de commande",
    orderTitle: "Comment commander ?",
    orderIntro:
      "Une procédure simple et transparente, de l’envoi de vos articles jusqu’à la livraison.",
    orderSteps: [
      {
        title: "Ajoutez vos articles",
        detail: "Indiquez un lien, un ID, un SKU ou une référence pour chaque produit.",
      },
      {
        title: "Recevez votre devis",
        detail:
          "Nous vérifions la disponibilité, les promotions et le prix final, puis nous vous répondons dans votre conversation.",
      },
      {
        title: "Confirmez avec 50 %",
        detail:
          "La commande est confirmée après le versement d’un acompte global de 50 % par BaridiMob ou CCP.",
      },
      {
        title: "Nous passons la commande",
        detail:
          "Après confirmation, nous achetons vos articles et nous suivons leur acheminement.",
      },
      {
        title: "Recevez votre commande",
        detail:
          "Délai estimé : 15 à 30 jours. Livraison dans les 58 wilayas et règlement du solde à la livraison.",
      },
    ],
    linkedReferenceTitle: "Demande liée automatiquement",
    linkedReferenceDetail:
      "Le lien reçu dans notre conversation rattache automatiquement cette demande : aucun pseudo ni numéro à saisir.",
    publicReferenceTitle: "Envoyez-nous votre référence",
    publicReferenceDetail:
      "Depuis ce lien public, nous enregistrons votre contact et le site vous aide à transmettre la référence dans la bonne conversation.",
    orderNotice:
      "Le prix et la disponibilité sont toujours confirmés avant le paiement de l’acompte.",
    deliveryEyebrow: "Tarifs de livraison",
    deliveryTitle: "Combien coûte la livraison ?",
    deliverySelect: "Choisissez votre wilaya",
    deliveryPrompt: "Sélectionnez une wilaya pour afficher les deux tarifs.",
    homeDelivery: "À domicile",
    stopDeskDelivery: "Au bureau (stop desk)",
    deliveryNotice: "Le tarif dépend de la wilaya et du mode de livraison choisi.",
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
    formEyebrow: "حساب السعر مجاناً وبدون التزام",
    formTitle: "احصلي على سعر منتجاتك",
    formIntro: "الصقي رابط المنتج الأول أو اكتبي المرجع الخاص به.",
    submit: "اضغطي هنا باش تحصلي على السعر",
    sending: "جارٍ الإرسال…",
    trust: "نتحقق من السعر والتوفر قبل الرد عليك.",
    privacy: "نستعمل الاسم أو الرقم فقط باش نلقاو محادثتك.",
    linkedPrivacy: "لا حاجة لكتابة اسم الحساب أو رقم الهاتف.",
    linkedFormNotice:
      "هذا الطلب مرتبط مسبقاً بمحادثتنا. أضيفي المنتجات فقط.",
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
      "بقات خطوة أخيرة: ابعثي الآن رقم الطلب في محادثتك مع Yuna’s Shop.",
    reference: "رقم طلبك",
    copyReference: "نسخ رقم الطلب",
    copiedReference: "تم نسخ الرقم ✓",
    sendReference: "ابعثي رقم الطلب في المحادثة",
    sendingReference: "جاري فتح المراسلة…",
    referenceSent: "تأكدي بلي الرسالة تبعثت ✓",
    publicContactTitle: "باش نلقاو محادثتك بسهولة",
    publicContactIntro:
      "اختاري وين بعثتيلنا، واكتبي نفس الاسم أو الرقم لي ظاهر في المحادثة.",
    contactChannel: "وين بعثتيلنا؟",
    contactLabels: {
      instagram: "Instagram",
      messenger: "Messenger",
      whatsapp: "WhatsApp",
    },
    contactFieldLabels: {
      instagram: "اسم حسابك في Instagram",
      messenger: "اسمك في Messenger",
      whatsapp: "رقم WhatsApp",
    },
    contactPlaceholders: {
      instagram: "مثال: @votre.pseudo",
      messenger: "نفس الاسم لي ظاهر في المحادثة",
      whatsapp: "مثال: 0555 00 00 00",
    },
    invalidContact: "اكتبي نفس الاسم أو الرقم لي ظاهر في محادثتك.",
    invalidWhatsapp: "تأكدي من رقم WhatsApp الجزائري.",
    shareMessage: (reference) =>
      `السلام عليكم، بعثت المنتجات في موقع Yuna’s Shop. رقم طلبي هو ${reference}.`,
    closePage: "يمكنك الآن إغلاق هذه الصفحة.",
    another: "إرسال طلب آخر",
    orderEyebrow: "طريقة الطلب",
    orderTitle: "كيفاش تطلبي؟",
    orderIntro: "خطوات بسيطة وواضحة، من إرسال المنتجات حتى استلام الطلبية.",
    orderSteps: [
      {
        title: "أضيفي المنتجات",
        detail: "اكتبي الرابط أو ID أو SKU أو المرجع الخاص بكل منتج.",
      },
      {
        title: "استلمي السعر النهائي",
        detail:
          "نتحقق من التوفر والتخفيضات والسعر النهائي، ثم نرد عليك في نفس المحادثة.",
      },
      {
        title: "أكدي الطلب بـ 50٪",
        detail:
          "يتم تأكيد الطلبية بعد دفع تسبيق إجمالي 50٪ عن طريق بريدي موب أو CCP.",
      },
      {
        title: "نقوم بالطلب",
        detail: "بعد التأكيد، نشتري المنتجات ونتابع وصولها.",
      },
      {
        title: "استلمي طلبيتك",
        detail:
          "المدة المتوقعة من 15 إلى 30 يوماً، مع التوصيل إلى 58 ولاية ودفع الباقي عند الاستلام.",
      },
    ],
    linkedReferenceTitle: "الطلب مربوط تلقائياً",
    linkedReferenceDetail:
      "الرابط المرسل في محادثتنا يربط طلبك تلقائياً، بدون كتابة اسم الحساب أو رقم الهاتف.",
    publicReferenceTitle: "أرسلي لنا رقم الطلب",
    publicReferenceDetail:
      "في الرابط العام نسجلو اسمك أو رقمك، والموقع يساعدك تبعثي رقم الطلب في المحادثة الصحيحة.",
    orderNotice:
      "نؤكد لك دائماً السعر والتوفر قبل دفع التسبيق.",
    deliveryEyebrow: "أسعار التوصيل",
    deliveryTitle: "شحال سعر التوصيل؟",
    deliverySelect: "اختاري الولاية",
    deliveryPrompt: "اختاري الولاية باش يبانلك السعرين.",
    homeDelivery: "للمنزل",
    stopDeskDelivery: "للمكتب (Stop desk)",
    deliveryNotice: "السعر يختلف حسب الولاية ونوع التوصيل المختار.",
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

function normalizeWhatsapp(value) {
  const digits = value.replace(/\D/g, "");
  if (/^0[567]\d{8}$/.test(digits)) return `213${digits.slice(1)}`;
  if (/^213[567]\d{8}$/.test(digits)) return digits;
  return "";
}

function RequestForm({ conversationReference = "", invalidConversationLink = false }) {
  const [locale, setLocale] = useState("ar");
  const [products, setProducts] = useState([{ ...EMPTY_PRODUCT }]);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("idle");
  const [fieldError, setFieldError] = useState("");
  const [reference, setReference] = useState("");
  const [referenceCopied, setReferenceCopied] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState("idle");
  const [contactChannel, setContactChannel] = useState("instagram");
  const [contact, setContact] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState("");
  const t = copy[locale];
  const isArabic = locale === "ar";
  const isLinkedConversation = Boolean(conversationReference);
  const selectedTariffs = selectedWilaya ? DELIVERY_TARIFFS[selectedWilaya] : null;

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
    const cleanedContact = contact.trim();
    const normalizedWhatsapp = contactChannel === "whatsapp"
      ? normalizeWhatsapp(cleanedContact)
      : "";
    if (!isLinkedConversation && !cleanedContact) {
      setFieldError(t.invalidContact);
      return;
    }
    if (!isLinkedConversation && contactChannel === "whatsapp" && !normalizedWhatsapp) {
      setFieldError(t.invalidWhatsapp);
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
          responseChannel: isLinkedConversation ? "instagram" : contactChannel,
          responseContact: isLinkedConversation
            ? `meta:${nextReference}`
            : contactChannel === "whatsapp"
              ? normalizedWhatsapp
              : cleanedContact,
          whatsapp: !isLinkedConversation && contactChannel === "whatsapp"
            ? normalizedWhatsapp
            : "",
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
    setHandoffStatus("idle");
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

  async function continueInMessaging() {
    const message = t.shareMessage(reference);
    setHandoffStatus("opening");

    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        setReferenceCopied(true);
        setHandoffStatus("sent");
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          setHandoffStatus("idle");
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      setReferenceCopied(true);
    } catch {
      setFieldError(t.error);
      setHandoffStatus("idle");
      return;
    }

    const destination = contactChannel === "instagram"
      ? "https://ig.me/m/yunas.shop"
      : contactChannel === "messenger"
        ? "https://m.me/yunas.shop"
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.location.href = destination;
    setHandoffStatus("sent");
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
                  <div className="required-next-step">
                    <strong>{isArabic ? "لا تغلقي الصفحة قبل إرسال الرقم" : "Ne fermez pas avant d’envoyer le numéro"}</strong>
                    <span>{isArabic ? "اضغطي على الزر واختاري محادثتك مع Yuna’s Shop" : "Appuyez sur le bouton et choisissez votre conversation avec Yuna’s Shop."}</span>
                  </div>
                  <button
                    className="primary-button messaging-handoff-button"
                    type="button"
                    onClick={continueInMessaging}
                    disabled={handoffStatus === "opening"}
                  >
                    {handoffStatus === "opening" ? t.sendingReference : t.sendReference}
                  </button>
                  {handoffStatus === "sent" ? (
                    <p className="handoff-confirmation">{t.referenceSent}</p>
                  ) : null}
                  <button className="secondary-text-button" type="button" onClick={copyReference}>
                    {referenceCopied ? t.copiedReference : t.copyReference}
                  </button>
                  {fieldError ? <p className="form-error" role="alert">{fieldError}</p> : null}
                  <button className="secondary-text-button another-request-button" type="button" onClick={reset}>
                    {t.another}
                  </button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="form-intro">
                <p>{t.formEyebrow}</p>
                <h2>{t.formTitle}</h2>
                <span>{t.formIntro}</span>
              </div>
              {isLinkedConversation ? (
                <div className="linked-conversation-notice">
                  <span aria-hidden="true">✓</span>
                  <p>{t.linkedFormNotice}</p>
                </div>
              ) : null}
              {invalidConversationLink ? (
                <p className="form-error invalid-link-error" role="alert">
                  {t.invalidConversationLink}
                </p>
              ) : null}
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

              {!isLinkedConversation ? (
                <section className="public-contact-card">
                  <div>
                    <strong>{t.publicContactTitle}</strong>
                    <p>{t.publicContactIntro}</p>
                  </div>
                  <fieldset>
                    <legend>{t.contactChannel}</legend>
                    <div className="contact-channel-options">
                      {Object.keys(t.contactLabels).map((channel) => (
                        <button
                          className={contactChannel === channel ? "active" : ""}
                          type="button"
                          key={channel}
                          aria-pressed={contactChannel === channel}
                          onClick={() => {
                            setContactChannel(channel);
                            setContact("");
                            setFieldError("");
                          }}
                        >
                          {t.contactLabels[channel]}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label>
                    <span>{t.contactFieldLabels[contactChannel]}</span>
                    <input
                      type={contactChannel === "whatsapp" ? "tel" : "text"}
                      inputMode={contactChannel === "whatsapp" ? "tel" : "text"}
                      maxLength="150"
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      placeholder={t.contactPlaceholders[contactChannel]}
                    />
                  </label>
                </section>
              ) : null}

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
              <p className="privacy-line">
                {isLinkedConversation ? t.linkedPrivacy : t.privacy}
              </p>
            </form>
          )}
        </div>
      </section>

      <section className="order-overview" aria-label={isArabic ? "معلومات الطلب" : "Informations de commande"}>
        <details className="info-accordion order-process">
          <summary>
            <span className="accordion-icon" aria-hidden="true">1–5</span>
            <span>
              <small>{t.orderEyebrow}</small>
              <strong>{t.orderTitle}</strong>
              <em>{t.orderIntro}</em>
            </span>
            <b aria-hidden="true">＋</b>
          </summary>

          <div className="accordion-content">
            <ol className="order-process-list">
              {t.orderSteps.map((step, index) => (
                <li key={step.title}>
                  <span className="order-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="order-reference-note">
              <span aria-hidden="true">{isLinkedConversation ? "✓" : "↗"}</span>
              <div>
                <strong>
                  {isLinkedConversation ? t.linkedReferenceTitle : t.publicReferenceTitle}
                </strong>
                <p>
                  {isLinkedConversation ? t.linkedReferenceDetail : t.publicReferenceDetail}
                </p>
              </div>
            </div>

            <p className="order-process-notice">
              <span aria-hidden="true">✓</span>
              {t.orderNotice}
            </p>
          </div>
        </details>

        <details className="info-accordion delivery-tariffs">
          <summary>
            <span className="accordion-icon" aria-hidden="true">🚚</span>
            <span>
              <small>{t.deliveryEyebrow}</small>
              <strong>{t.deliveryTitle}</strong>
              <em>{t.deliveryPrompt}</em>
            </span>
            <b aria-hidden="true">＋</b>
          </summary>

          <div className="accordion-content delivery-content">
            <label className="wilaya-select">
              <span>{t.deliverySelect}</span>
              <select
                value={selectedWilaya}
                onChange={(event) => setSelectedWilaya(event.target.value)}
              >
                <option value="">{t.deliverySelect}…</option>
                {WILAYAS_58.map((wilaya) => {
                  const name = wilaya.slice(3);
                  return (
                    <option key={wilaya} value={name}>
                      {wilaya}
                    </option>
                  );
                })}
              </select>
            </label>

            {selectedTariffs ? (
              <div className="delivery-price-grid" aria-live="polite">
                <div>
                  <span aria-hidden="true">⌂</span>
                  <small>{t.homeDelivery}</small>
                  <strong dir="ltr">{selectedTariffs.home.toLocaleString("fr-FR")} DA</strong>
                </div>
                <div>
                  <span aria-hidden="true">▣</span>
                  <small>{t.stopDeskDelivery}</small>
                  <strong dir="ltr">{selectedTariffs.stopDesk.toLocaleString("fr-FR")} DA</strong>
                </div>
              </div>
            ) : (
              <p className="delivery-prompt">{t.deliveryPrompt}</p>
            )}

            <p className="delivery-notice">{t.deliveryNotice}</p>
          </div>
        </details>
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
