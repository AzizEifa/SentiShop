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
                                                  └─ avis clients : table review (une ligne par avis)
```

## Structure du projet

```
SentiShop/
├── README.md
├── start.cmd                  ▶ lance backend + frontend et ouvre le navigateur
├── start-backend.cmd          ▶ backend seul  (http://localhost:8080)
├── start-frontend.cmd         ▶ frontend seul (http://localhost:4200)
├── run-tests.cmd              ▶ tous les tests (back + front)
├── samples/                   CSV d'exemple (format standard + export Excel FR)
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
│           │   ├── api/           review-api, dashboard-api (appels REST)
│           │   ├── csv/           normalisation du CSV avant import
│           │   ├── interceptors/  erreurs HTTP → snackbar
│           │   └── models/        types partagés (Review, DashboardStats…)
│           ├── features/          une page par fonctionnalité
│           │   ├── dashboard/     F3 · B1 · B2   vue d'ensemble, camembert, résumé, export
│           │   ├── analyze/       F1 · F4        analyser un avis
│           │   ├── import/        F2             importer un CSV
│           │   ├── reviews/       B2             liste filtrable + export
│           │   └── compare/       B3             multilingue vs anglais seul
│           └── shared/            sentiment-badge
│
└── sentiment-analysis/        ── API Spring Boot
    ├── pom.xml · mvnw · .env.example
    └── src/
        ├── main/java/com/shop/sentiment_analysis/
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

1. **Token** (une seule fois) : copier `sentiment-analysis\.env.example` en `sentiment-analysis\.env`
   et écrire `HF_TOKEN=hf_xxxxxxxx`.
2. Double-cliquer **`start.cmd`** : deux fenêtres s'ouvrent (backend, frontend), puis le navigateur
   sur **http://localhost:4200**. Garder les deux fenêtres ouvertes.

Swagger (documentation de l'API) : http://localhost:8080/swagger-ui.html

En ligne de commande :

```bash
cd sentiment-analysis && ./mvnw spring-boot:run     # backend
cd frontend && npm install && npm start             # frontend
```

Dans IntelliJ : SDK = Java 21, lancer `SentimentAnalysisApplication` avec comme
*working directory* le dossier `sentiment-analysis` (pour que le `.env` soit trouvé).

## Fonctionnalités (cahier des charges)

| | Exigence | Où |
|---|---|---|
| F1 | Analyser un avis saisi au clavier | page **Analyser un avis** → `POST /api/reviews/analyze` |
| F2 | Importer un CSV et analyser chaque ligne | page **Importer des avis** → `POST /api/reviews/import` (lots de 50, barre de progression) |
| F3 | Tableau de bord % positif / neutre / négatif + graphique | page **Vue d'ensemble** : cartes KPI + camembert |
| F4 | Cache : un avis déjà analysé ne repart pas vers l'API | `SentimentService` : Caffeine → table `review_analysis` → API ; clé `SHA-256(texte normalisé + modèle)` ; mention « depuis le cache » |
| B1 | Résumé des avis négatifs (BART) | bouton **Résumer les avis négatifs** → `POST /api/dashboard/summary/negative` |
| B2 | Filtrer par produit, exporter en CSV | filtre produit + bouton **Exporter CSV** → `GET /api/reviews/export` |
| B3 | Comparer avec un modèle anglais seul sur l'arabe | page **Comparer les modèles** → `POST /api/reviews/compare` : multilingue vs `twitter-roberta-base-sentiment-latest` |

### Format du CSV

```csv
text,product
"Livraison rapide, je recommande !",Casque Bluetooth
المنتج رائع جدا,Montre connectée
```

Accepté aussi : export Excel français (`;`), en-têtes `texte` / `avis` / `produit`, fichier sans
en-tête (1re colonne = texte). Lignes vides ignorées. Limites : texte 2000 caractères,
produit 120, 2000 avis, 5 Mo. Exemples dans [`samples/`](samples/).

## Données : cache et avis séparés

| Table | Contenu | Rôle |
|---|---|---|
| `review_analysis` | texte normalisé (+ modèle) → label, score | **cache** : un seul appel API par texte |
| `review` | chaque avis reçu (texte, produit, label, score, date) | **statistiques** : 30 clients qui écrivent « Très bien » = 30 avis |

Une base créée avant cette séparation est migrée automatiquement au démarrage (`SchemaMigration`) :
les analyses existantes sont recopiées dans le cache. Aucune donnée n'est perdue.

## Tests

Double-cliquer **`run-tests.cmd`**. Aucun test n'appelle la vraie API (aucun crédit consommé).

| Côté | Outils | Ce qui est vérifié |
|---|---|---|
| Back (25) | JUnit 5, Mockito, MockWebServer | 1er appel → HF appelé ; **2e appel identique → HF non appelé** (`cached=true`) ; avis identiques comptés séparément ; erreurs 401 / 429 / 503 (retry) ; résumé BART ; comparaison B3 ; migration |
| Front (34) | Jasmine, Karma | appels REST ; lecture CSV (Excel, arabe, guillemets, limites) ; import par lots ; dashboard (pourcentages, état vide, erreurs, export) ; comparaison B3 |

## Sécurité

- Le token n'existe que dans `sentiment-analysis/.env`, ignoré par Git (`.env.example` est vide).
- Le navigateur ne parle qu'au backend : le token n'est jamais visible avec F12.
- Ne jamais coller le token dans un prompt d'assistant IA.

## Limites connues

- Chaque envoi est un avis : importer deux fois le même fichier compte les avis deux fois
  (sans nouvel appel à l'API, tout vient du cache).
- BART (`bart-large-cnn`) est un modèle anglais : le résumé d'avis FR/AR est approximatif.
- Les noms de modèles et l'URL `router.huggingface.co/hf-inference` sont dans
  `application.properties` : à vérifier si Hugging Face fait évoluer ses endpoints.
