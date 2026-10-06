# SentiShop — Analyse de sentiment des avis clients

Atelier **AI App Studio** (thème 1). Une boutique reçoit des avis en français, anglais et arabe :
l'application dit en un coup d'œil si les clients sont satisfaits.

| Partie | Technologie | Dossier |
|---|---|---|
| Frontend | Angular 18 (standalone, Angular Material, ng2-charts) | [`frontend/`](frontend/) |
| Backend | Spring Boot 3, Java 21, H2 | [`sentiment-analysis/`](sentiment-analysis/) |
| IA | Hugging Face Inference : `cardiffnlp/twitter-xlm-roberta-base-sentiment` (+ `facebook/bart-large-cnn` pour le résumé) | — |

```
Navigateur ──▶ Angular :4200 ──/api (proxy)──▶ Spring Boot :8080 ──▶ Hugging Face
                                                  │  └─ le token HF est ici (.env), jamais dans le navigateur
                                                  ├─ cache : Caffeine (mémoire) puis table review_analysis
                                                  ├─ avis clients : table review (une ligne par avis)
                                                  ├─ comptes : table app_user (BCrypt) + jetons JWT
                                                  └─ WebSocket /ws/notifications → admins connectés
```

## Comptes et droits

| Rôle | Comment l'obtenir | Ce qu'il peut faire |
|---|---|---|
| **Client** | Inscription libre sur `/register` | Écrire un avis sur un produit du catalogue (note ★, texte avec émojis, jusqu'à 3 photos), puis **modifier ou supprimer ses propres avis** dans `/espace`. Gérer son profil (nom, email, mot de passe, photo). Le sentiment détecté reste interne à la boutique. |
| **Administrateur** | Créé au démarrage (impossible par l'inscription) | Tout le back-office : tableau de bord, avis (détail, photos, **suppression**), analyse, import, export, comparaison, **catalogue produits** (ajout, modification, suppression, image), **utilisateurs** (rôle, suppression). Reçoit **en temps réel** chaque avis déposé ou modifié par un client. |

Garde-fous : un client n'accède qu'à ses propres avis (un avis d'un autre client répond « introuvable ») ;
un administrateur ne peut ni modifier son propre rôle ni supprimer son compte, et le dernier administrateur
est protégé. Un texte d'avis modifié est **réanalysé** ; un nom de produit ou de client modifié est répercuté
sur les avis.

**Images** (produits, avis, photos de profil) : JPG, PNG, WEBP ou GIF, 3 Mo max, type vérifié sur le contenu
réel du fichier (pas seulement l'extension). Stockées dans `sentiment-analysis/uploads/` (ignoré par Git) sous
un nom aléatoire et servies sur `/uploads/…`.

Les droits sont appliqués **par le backend** (Spring Security, jetons JWT signés) et pas seulement masqués dans
l'interface : un client qui appelle une route admin reçoit `403`, une requête sans jeton `401`.

**Comptes créés au premier démarrage** (modifiables dans `.env`, cf. `.env.example`) :

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | `admin@sentishop.local` | `Admin123!` |
| Client de démonstration | `client@sentishop.local` | `Client123!` |

**Notifications temps réel** : quand un client publie un avis, les administrateurs connectés reçoivent
une alerte (avec la note et le sentiment), la cloche affiche le nombre de non-lus et le tableau de bord
se met à jour sans recharger. Le jeton est envoyé dans le premier message WebSocket, pas dans l'URL ;
seuls les jetons ADMIN sont abonnés. Reconnexion automatique en cas de coupure.

## Structure du projet

```
SentiShop/
├── README.md
├── samples/                   CSV de démonstration pour l'import (FR / EN / AR, export Excel FR)
│
├── frontend/                  ── application Angular
│   ├── package.json · angular.json · tsconfig*.json
│   ├── public/                favicon
│   └── src/
│       ├── index.html · main.ts · styles.scss
│       ├── proxy.conf.json    /api → http://localhost:8080
│       └── app/
│           ├── app.component.ts · app.config.ts · app.routes.ts
│           ├── core/
│           │   ├── api/           appels REST (avis, dashboard, espace client, administration)
│           │   ├── auth/          session JWT, intercepteur, gardes par rôle
│           │   ├── notifications/ WebSocket temps réel (alertes, compteur, reconnexion)
│           │   ├── csv/           normalisation du CSV avant import
│           │   ├── interceptors/  erreurs HTTP → message à l'utilisateur
│           │   ├── models/        types partagés (Review, DashboardStats…)
│           │   └── format.ts      dates relatives, verdict de satisfaction, score net
│           ├── layouts/           back-office admin · espace client
│           ├── features/          une page par fonctionnalité
│           │   ├── auth/          connexion, inscription
│           │   ├── client/        espace client : écrire, modifier, supprimer ses avis (émojis, photos)
│           │   ├── products/      catalogue produits avec images (admin)
│           │   ├── profile/       mon profil : photo, nom, email, mot de passe
│           │   ├── users/         administration des comptes (rôle, suppression)
│           │   ├── dashboard/     F3 · B1 · B2   vue d'ensemble, camembert, résumé, export
│           │   ├── analyze/       F1 · F4        analyser un avis
│           │   ├── import/        F2             importer un CSV
│           │   ├── reviews/       B2             liste filtrable + export
│           │   └── compare/       B3             multilingue vs anglais seul
│           └── shared/            badge, étoiles, avatar, émojis, confirmation, visionneuse, cloche, alertes, menu
│
└── sentiment-analysis/        ── API Spring Boot
    ├── pom.xml · mvnw
    ├── .env.example           modèle du fichier .env (HF_TOKEN=), à copier en .env
    └── src/
        ├── main/java/com/shop/sentiment_analysis/
        │   ├── auth/          comptes, JWT, SecurityConfig (droits), connexion, profil, administration des comptes
        │   ├── me/            espace client (avis + photos) ; modération des avis (admin)
        │   ├── product/       catalogue produits (CRUD admin, statistiques par produit)
        │   ├── storage/       stockage et contrôle des images envoyées
        │   ├── notify/        WebSocket des notifications temps réel
        │   ├── controller/    ReviewController, DashboardController
        │   ├── service/       SentimentService (cache), CsvImportService, DashboardService, ExportService
        │   ├── client/        HuggingFaceClient (équivalent de api_client.py)
        │   ├── compare/       B3 : CompareController, CompareService
        │   ├── cache/         ReviewHasher (normalisation + SHA-256)
        │   ├── domain/        Review, ReviewAnalysis, SentimentLabel
        │   ├── repository/    ReviewRepository, ReviewAnalysisRepository
        │   ├── config/        AppConfig (WebClient, CORS), HuggingFaceProperties, SchemaMigration
        │   ├── dto/           requêtes / réponses de l'API
        │   └── exception/     GlobalExceptionHandler, HfUnavailableException
        ├── main/resources/application.properties
        └── test/java/…        tests JUnit (équivalent de test_api_client.py)
```

## Prérequis

- **Java 21** (JDK) avec `JAVA_HOME` qui pointe dessus — ex. [Eclipse Temurin 21](https://adoptium.net/temurin/releases/?version=21)
- **Node.js 18+** et npm
- Un token Hugging Face *Fine-grained* avec la permission **Make calls to Inference Providers**

## Démarrage

**1. Token** (une seule fois) : copier `sentiment-analysis/.env.example` en `sentiment-analysis/.env`,
puis écrire votre token : `HF_TOKEN=hf_xxxxxxxx`. Ce fichier n'est jamais envoyé sur GitHub.

**2. Backend** (terminal 1) → http://localhost:8080 · Swagger : http://localhost:8080/swagger-ui.html

```bash
cd sentiment-analysis
./mvnw spring-boot:run          # Windows (cmd / PowerShell) : .\mvnw spring-boot:run
```

**3. Frontend** (terminal 2) → **http://localhost:4200**

```bash
cd frontend
npm install                     # la première fois seulement
npm start
```

Garder les deux terminaux ouverts. Le front appelle `/api/...`, redirigé vers le backend par
`frontend/src/proxy.conf.json`.

Dans IntelliJ : SDK = Java 21, lancer `SentimentAnalysisApplication` avec comme
*working directory* le dossier `sentiment-analysis` (pour que le `.env` soit trouvé).

## Fonctionnalités (cahier des charges)

| | Exigence | Où |
|---|---|---|
| F1 | Analyser un avis saisi au clavier | page **Analyser un avis** → `POST /api/reviews/analyze` |
| F2 | Importer un CSV et analyser chaque ligne | page **Importer des avis** → `POST /api/reviews/import` (lots de 50, barre de progression) |
| F3 | Tableau de bord % positif / neutre / négatif + graphique | page **Tableau de bord** : verdict, score net, KPI (somme = 100 %), anneau, tendance (`GET /api/dashboard/trend?days=`), filtre période (`GET /api/dashboard/stats?days=`) |
| F4 | Cache : un avis déjà analysé ne repart pas vers l'API | `SentimentService` : Caffeine → table `review_analysis` → API ; clé `SHA-256(texte normalisé + modèle)` ; mention « depuis le cache » |
| B1 | Résumé des avis négatifs (BART) | bouton **Résumer les avis négatifs** → `POST /api/dashboard/summary/negative` |
| B2 | Filtrer par produit, exporter en CSV | filtre produit + bouton **Exporter CSV** → `GET /api/reviews/export` |
| B3 | Comparer avec un modèle anglais seul sur l'arabe | page **Comparer les modèles** → `POST /api/reviews/compare` : multilingue vs `twitter-roberta-base-sentiment-latest` (exactitude, accord, matrices de confusion) |
| — | Rechercher, trier, filtrer la liste des avis | page **Avis clients** → `GET /api/reviews?q=&label=&product=&days=&sort=score,desc&page=&size=` (tri : `createdAt`, `score`, `product`, `authorName`) |

**Score de satisfaction** : score net = % d'avis positifs − % d'avis négatifs (−100 à +100), seuils réglables dans
`frontend/src/app/core/format.ts` (`SATISFACTION_RULES`). Il repose sur le sentiment détecté par l'IA, pas sur les étoiles.
La **langue** affichée est estimée dans le navigateur (`core/language.ts`) : le backend ne la stocke pas.
Les **notifications** (avis temps réel, fin d'import, IA indisponible) vivent le temps de la session : le serveur n'en garde pas d'historique.

### Format du CSV

```csv
text,product
"Livraison rapide, je recommande !",Casque Bluetooth
المنتج رائع جدا,Montre connectée
```

Accepté aussi : export Excel français (`;`), en-têtes `texte` / `avis` / `produit`, fichier sans
en-tête (1re colonne = texte). Lignes vides ignorées. Limites : texte 2000 caractères,
produit 120, 2000 avis, 5 Mo. Exemples dans [`samples/`](samples/).

## Expérience utilisateur

| Page | Ce qu'elle apporte |
|---|---|
| Vue d'ensemble | **Verdict en clair** (« Vos clients sont satisfaits » / « Satisfaction à surveiller ») et score net, camembert, **avis négatifs à traiter** avec résumé IA, **classement des produits** les plus critiqués (clic = filtre), parcours de démarrage si la base est vide |
| Avis clients | Filtres rapides par sentiment, recherche produit instantanée, filtres conservés dans l'URL, texte dépliable, confiance et date relative, pagination, export de la sélection |
| Analyser un avis | Exemples FR / EN / AR en un clic, raccourci <kbd>Ctrl</kbd>+<kbd>Entrée</kbd>, suggestions de produits, résultat avec jauge de confiance et mention « cache : aucun crédit consommé », historique de la session |
| Importer des avis | Parcours en 3 étapes : fichier (glisser-déposer, modèle téléchargeable) → **aperçu avant envoi** → progression en direct et bilan |
| Comparer les modèles | Expérience B3 expliquée, taux de bonnes réponses par modèle, ✓ / ✗ par avis |

Également : indicateur « API connectée / hors ligne », fil d'Ariane, squelettes de chargement,
états vides explicites, mise en page adaptée au mobile, texte arabe affiché de droite à gauche.
Polices et icônes sont **embarquées** (`@fontsource-variable/inter`, `material-symbols`) :
l'interface s'affiche correctement même sans connexion internet.

## Données : cache et avis séparés

| Table | Contenu | Rôle |
|---|---|---|
| `review_analysis` | texte normalisé (+ modèle) → label, score | **cache** : un seul appel API par texte |
| `review` | chaque avis reçu (texte, produit, label, score, date) | **statistiques** : 30 clients qui écrivent « Très bien » = 30 avis |

Une base créée avant cette séparation est migrée automatiquement au démarrage (`SchemaMigration`) :
les analyses existantes sont recopiées dans le cache. Aucune donnée n'est perdue.

## Tests

```bash
cd sentiment-analysis && ./mvnw test                         # backend
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless   # frontend
```

Aucun test n'appelle la vraie API (aucun crédit consommé).

| Côté | Outils | Ce qui est vérifié |
|---|---|---|
| Back (52) | JUnit 5, Mockito, MockWebServer, Spring Security Test | 1er appel → HF appelé ; **2e appel identique → HF non appelé** (`cached=true`) ; avis identiques comptés séparément ; erreurs 401 / 429 / 503 (retry) ; résumé BART ; comparaison B3 ; migration ; **droits par rôle** (401 / 403), inscription, connexion, avis client, notification WebSocket ; produits avec image ; modification / suppression d'avis (propriétaire uniquement) ; photos et émojis ; profil ; garde-fous admin |
| Front (87) | Jasmine, Karma | appels REST ; lecture CSV (Excel, arabe, guillemets, limites) ; import par lots ; dashboard (pourcentages, état vide, erreurs, export) ; comparaison B3 ; verdict et score net ; historique d'analyse ; étapes de l'import ; état de l'API ; session et gardes par rôle ; connexion / inscription ; dépôt, modification et suppression d'avis ; émojis et photos ; catalogue ; profil ; WebSocket (reconnexion) |

## Sécurité

- Le token n'existe que dans `sentiment-analysis/.env`, ignoré par Git (`.env.example` est vide).
- Le navigateur ne parle qu'au backend : le token n'est jamais visible avec F12.
- Mots de passe stockés chiffrés (BCrypt) ; message d'erreur de connexion identique que l'email existe ou non.
- Jetons de connexion signés (HS256), valables 8 h ; secret `JWT_SECRET` à définir dans `.env` hors développement.
- Ne jamais coller le token dans un prompt d'assistant IA.

## Limites connues

- Chaque envoi est un avis : importer deux fois le même fichier compte les avis deux fois
  (sans nouvel appel à l'API, tout vient du cache).
- BART (`bart-large-cnn`) est un modèle anglais : le résumé d'avis FR/AR est approximatif.
- Les noms de modèles et l'URL `router.huggingface.co/hf-inference` sont dans
  `application.properties` : à vérifier si Hugging Face fait évoluer ses endpoints.
