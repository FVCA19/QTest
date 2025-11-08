# CineNote Project Notes

## 1️⃣ Overview
- **What it is**: CineNote is a serverless movie-review site. Users register/login, browse movies, post reviews, and admins manage catalog and moderation.
- **Stack**: Static frontend (HTML + CSS + vanilla JS) hosted via AWS Amplify, authentication with Amazon Cognito, backend on AWS Lambda behind API Gateway, data persisted in DynamoDB, infrastructure defined with AWS CloudFormation.
- **Key directories**
  - `frontend/`: Public web assets (HTML, CSS, JavaScript, vendor SDKs).
  - `backend/lambda/`: Lambda handler source and deployment artifact.
  - `infrastructure/`: CloudFormation template provisioning AWS resources.
  - Root files (`README.md`, `plan.md`, `Note.md`): Documentation and planning.

## 2️⃣ File-by-file Explanation
- `frontend/`
  - `index.html`: Landing page showing movie catalog (entry point for authenticated users).
  - `movie.html`: Movie detail view, review form, and list.
  - `admin.html`: Admin console for movie CRUD and review moderation.
  - `login.html`, `register.html`, `verify.html`: Authentication flows wired to Cognito.
  - `css/styles.css`: Global styling for layouts, tables, forms, alerts.
  - `js/config.js`: Runtime configuration populated with API Gateway and Cognito IDs.
  - `js/auth.js`: Cognito wrapper (sign-up, confirmation, login, session refresh, logout, admin detection).
  - `js/api.js`: Fetch helper adding Cognito ID token authorization and exposing movie/review endpoints.
  - `js/navigation.js`: Toggles nav visibility for anonymous/authenticated/admin states and handles logout.
  - `js/index.js`: Landing page controller; loads movies, renders cards, applies filters.
  - `js/movie.js`: Detail page controller; fetches movie info, loads reviews, submits/deletes reviews.
  - `js/admin.js`: Admin dashboard controller; enforces admin session, manages movies/reviews.
  - `js/login.js`, `js/register.js`, `js/verify.js`: Page-specific form handlers delegating to `CineNoteAuth`.
  - `js/vendor/aws-sdk-2.1481.0.min.js`, `js/vendor/amazon-cognito-identity.min.js`: AWS browser SDK bundles.
- `backend/lambda/`
  - `cinenoteHandler.js`: Lambda entry point. Routes API Gateway proxy requests, enforces auth/admin via Cognito claims, performs movie CRUD, review management, and rating aggregation using DynamoDB.
  - `cinenote-lambda.zip`: Packaged Lambda artifact (contains handler and npm dependencies when deployed).
- `infrastructure/cinenote-stack.yaml`: CloudFormation template provisioning DynamoDB tables, Cognito resources (user pool, client, domain, admin group, identity pool), IAM roles, Lambda function, API Gateway proxy, CORS responses, and stack outputs.
- Documentation & planning
  - `README.md`: High-level architecture, deployment instructions, and hosting notes.
  - `plan.md`: Workstream matrix tracking responsibilities and tasks.
  - `Note.md`: (this document) consolidated structure guide.

### Entry points & config
- Frontend entry pages: `index.html`, `movie.html`, `admin.html`, `login.html`, `register.html`, `verify.html`.
- Backend entry point: `backend/lambda/cinenoteHandler.js` (`exports.handler`).
- Config: `frontend/js/config.js` stores API URL, region, Cognito/Identity Pool IDs provided by CloudFormation outputs.

## 3️⃣ Dependencies
- Browser-side: AWS SDK for JavaScript v2 (`aws-sdk-2.1481.0.min.js`) and `amazon-cognito-identity` library (handles Cognito auth flows).
- Lambda: Uses Node.js 18 runtime with Node’s built-in `crypto` module plus AWS SDK v3 packages `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` (included via deployment zip). No `package.json` is committed; dependencies are bundled when packaging the Lambda.
- Fetch API and browser storage (`localStorage`) are leveraged natively; no additional frontend frameworks.

## 4️⃣ Execution Flow
1. **User visits site** served from Amplify Hosting and loads `index.html`.
2. `navigation.js` checks `CineNoteAuth.getSession()`; nav updates for anonymous vs signed-in vs admin.
3. Anonymous users see hero content. Authenticated users trigger `index.js` which calls `CineNoteApi.listMovies()` with the Cognito ID token (if present) in the `Authorization` header.
4. API Gateway (secured by Cognito authorizer) forwards the request to the Lambda handler.
5. `cinenoteHandler.js` executes the relevant branch (e.g., `listMovies`, `getMovie`, `upsertReview`) and interacts with DynamoDB tables (`Movies`, `Reviews`), maintaining rating aggregates.
6. Lambda returns JSON with CORS headers → API Gateway → browser.
7. Frontend scripts update the DOM (movie grid, detail view, alerts) based on responses. Review submissions or deletions refresh lists and averages; admin actions refresh tables accordingly.

## 5️⃣ AWS / Cloud Integration
- **Amplify Hosting**: Serves static assets under `frontend/`.
- **Cognito User Pool & Admin group**: Provide authentication and role separation. Config values surface in `config.js`; `auth.js` uses them to create the user pool client and manage sessions.
- **Cognito Identity Pool + IAM role**: Optional federation for authenticated users; currently grants DynamoDB read permissions if needed.
- **API Gateway**: Configured as a REST proxy (`ANY /{proxy+}`) secured via Cognito authorizer; defined in `cinenote-stack.yaml`.
- **Lambda (`cinenoteHandler.js`)**: Handles all API requests, verifying claims from API Gateway’s authorizer and accessing DynamoDB.
- **DynamoDB tables** (`CineNote-Movies-*`, `CineNote-Reviews-*`): Store movie metadata, reviews, and rating aggregates.
- **CloudFormation template** (`infrastructure/cinenote-stack.yaml`): Centralizes provisioning of the above services, IAM roles, log groups, CORS responses, and provides stack outputs (`ApiBaseUrl`, `UserPoolId`, `UserPoolClientId`, `IdentityPoolId`) consumed by the frontend configuration.

