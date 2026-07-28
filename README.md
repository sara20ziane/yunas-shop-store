# Yuna’s Shop — Demandes de prix

Formulaire bilingue français/arabe permettant aux clientes d’envoyer le lien et/ou l’identifiant de chaque article, puis de choisir une réponse sur Instagram, Messenger ou WhatsApp. Les demandes sont enregistrées dans Firebase puis traitées depuis un espace administratrice privé.

## Fonctionnement

- ajout de plusieurs articles, chacun avec un lien et/ou un ID, SKU ou une référence ;
- choix du canal de réponse : Instagram, Messenger ou WhatsApp ;
- interface française et arabe avec mise en page RTL ;
- référence unique générée pour chaque demande ;
- demandes stockées dans Firestore ;
- espace `/admin` protégé par Firebase Authentication ;
- suivi détaillé : nouvelle, vérification, prix envoyé, confirmée, refusée ou archivée ;
- recherche et filtres par statut et date ;
- devis avec total, acompte, délai et réponse adaptée au canal choisi ;
- notes privées, copie groupée des articles et compteurs ;
- notifications navigateur lorsque l’espace administratrice est ouvert.

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Renseigner les variables Firebase dans `.env.local`.

## Déploiement Vercel

1. Importer ce dépôt dans Vercel.
2. Facultatif : ajouter les variables de `.env.example` dans **Settings → Environment Variables** pour remplacer la configuration Firebase Web intégrée.
3. Déployer.
4. Ajouter le domaine Vercel dans **Firebase Authentication → Settings → Authorized domains**.

## Règles Firestore

Le fichier `firestore.rules` contient les règles complètes recommandées. Elles permettent uniquement :

- la création publique d’une demande strictement validée ;
- la lecture, la modification et la suppression par une administratrice active du CRM.

Vérifier le document administratrice avant de publier les règles :

```text
artifacts/yunas-shop-crm/admins/TON_UID
```

avec :

```text
role: admin
active: true
```

## Commandes

```bash
npm run dev
npm run build
npm run preview
```
