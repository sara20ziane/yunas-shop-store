# Yuna’s Shop — Demandes de liens

Formulaire bilingue français/arabe permettant aux clientes d’envoyer leurs liens d’achat et leur numéro WhatsApp. Les demandes sont enregistrées dans Firebase puis traitées depuis un espace administratrice privé.

## Fonctionnement

- formulaire public limité à deux informations : liens + numéro WhatsApp ;
- interface française et arabe avec mise en page RTL ;
- référence unique générée pour chaque demande ;
- demandes stockées dans Firestore ;
- espace `/admin` protégé par Firebase Authentication ;
- bouton de réponse WhatsApp et suivi « nouvelle / traitée ».

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
