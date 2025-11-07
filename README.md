# CineNote

CineNote is a production-ready movie review web application built with a static HTML/CSS/JS frontend, AWS serverless services, and AWS Amplify Hosting.

## Architecture

- **Frontend**: Static HTML pages (`frontend/`) hosted on AWS Amplify Hosting.
- **Authentication**: Amazon Cognito User Pool (with an `Admin` group) and Identity Pool for optional AWS credential federation.
- **Backend**: Single AWS Lambda (`backend/lambda/cinenoteHandler.js`) exposed via Amazon API Gateway with a Lambda proxy integration.
- **Data Store**: DynamoDB tables for movies and reviews.

```
Browser ── Amplify Hosting ──> API Gateway ──> Lambda ──> DynamoDB
          │
          └──> Cognito (User Pool + Admin group, optional Identity Pool)
```

## Frontend structure

- `frontend/index.html`: List movies with average ratings.
- `frontend/movie.html`: Movie details, ratings, and user reviews (create/update/delete own review).
- `frontend/login.html` & `frontend/register.html`: Account access via Cognito.
- `frontend/admin.html`: Admin-only panel for managing movies and deleting reviews.

Global scripts live in `frontend/js/` and share a config stub (`config.js`) that must be updated with live AWS values after provisioning infrastructure.

## Backend Lambda

`backend/lambda/cinenoteHandler.js` implements movie CRUD, review management, and rating aggregation. It reads the following environment variables:

- `MOVIE_TABLE`: DynamoDB table with HASH key `movieId`
- `REVIEW_TABLE`: DynamoDB table with HASH key `movieId`, RANGE key `reviewId`

The Lambda is designed to run behind an API Gateway proxy resource that forwards all HTTP methods under `/` to the handler.

## CloudFormation deployment

Use `infrastructure/cinenote-stack.yaml` to provision the backend. The template creates Cognito resources, DynamoDB tables, Lambda, IAM roles, and API Gateway. Parameters:

| Parameter | Description |
|-----------|-------------|
| `EnvironmentName` | Stage suffix (default `prod`). |
| `LambdaCodeS3Bucket` / `LambdaCodeS3Key` | Location of the packaged Lambda zip. |
| `ApiLogRetentionDays` | CloudWatch Logs retention for API Gateway. |
| `CognitoDomainPrefix` | Unique prefix for Cognito Hosted UI (optional for this project but required by template). |

### Package & deploy Lambda

1. Zip the handler code:
   ```bash
   cd backend/lambda
   zip -r cinenote-lambda.zip cinenoteHandler.js package.json package-lock.json
   ```
   (Add `package.json` if you include extra dependencies; `aws-sdk` is provided by Lambda.)
2. Upload zip to an S3 bucket in the deployment region.
3. Deploy stack:
   ```bash
   aws cloudformation deploy \
     --template-file infrastructure/cinenote-stack.yaml \
     --stack-name cinenote-prod \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       EnvironmentName=prod \
       LambdaCodeS3Bucket=<bucket> \
       LambdaCodeS3Key=<path>/cinenote-lambda.zip \
       CognitoDomainPrefix=<unique-domain>
   ```

### Post-deployment steps

1. In the Cognito console, confirm new users via email. For admin users, add them to the `Admin` group manually.
2. Note stack outputs:
   - `ApiBaseUrl`
   - `UserPoolId`
   - `UserPoolClientId`
   - `IdentityPoolId`
3. Update `frontend/js/config.js` with these values.

## Amplify Hosting

1. Push the frontend folder to a Git repository (the Amplify console expects a repo source) or connect the `frontend/` directory to Amplify via drag-and-drop deploy.
2. In Amplify console:
   - Create a new app and connect your repo.
   - Set the build command to copy frontend assets:
     ```bash
     cd frontend
     npm install # optional if adding tooling
     ```
     For pure static hosting, use a simple `amplify.yml`:
     ```yaml
     version: 1
     applications:
       - appRoot: frontend
         frontend:
           phases:
             preBuild:
               commands: []
             build:
               commands:
                 - echo "Static assets"
           artifacts:
             baseDirectory: .
             files:
               - '**/*'
           cache:
             paths: []
     ```
   - Configure environment variables if desired (e.g., `API_BASE_URL`).
3. After deployment, ensure the app domain matches the Cognito app client callback/logout URLs. Update the user pool client with your Amplify domain (e.g., `https://main.d123.amplifyapp.com/login.html`).

## Local testing

- Serve the frontend with any static server (e.g., `npx serve frontend`) and use the deployed API & Cognito values.
- Use browser dev-tools network tab to verify API calls include the Cognito ID token in the `Authorization` header.

## Admin workflow

1. Register/log in as a normal user to test.
2. Promote desired accounts to `Admin` via the Cognito console.
3. Admin users gain access to `admin.html` to manage movies and moderate reviews.

## Security & production notes

- Restrict `LambdaExecutionRole` permissions if you add more tables.
- Enable AWS WAF on the API Gateway stage for advanced protection.
- Configure CloudWatch alarms on Lambda errors and API Gateway 5xx rates.
- Set appropriate password policies or MFA in Cognito for production hardening.