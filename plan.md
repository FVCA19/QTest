| Workstream | Tasks | Owner | Notes |
|------------|-------|-------|-------|
| Requirements & Design | Finalise user stories, roles (user/admin), data model, API surface | Product/Tech lead | Aligns with README architecture summary |
| Frontend Static Pages | Build `index.html`, `movie.html`, `login.html`, `register.html`, `verify.html`, `admin.html`; implement shared CSS and navigation | Frontend dev | Vanilla HTML/CSS/JS; config via `frontend/js/config.js` |
| Frontend Auth Logic | Implement Cognito integration (`auth.js`), session handling, forms (`login.js`, `register.js`, `verify.js`), navigation state | Frontend dev | Requires Cognito details from backend stack |
| Frontend API Client | Create API abstraction (`api.js`) for movies/reviews CRUD and admin ops | Frontend dev | Depends on API Gateway base URL |
| Backend Lambda | Implement handlers in `backend/lambda/cinenoteHandler.js` for movies/reviews, rating aggregation, admin enforcement | Backend dev | Uses AWS SDK v3 and DynamoDB tables |
| Infrastructure IaC | Author CloudFormation template (`infrastructure/cinenote-stack.yaml`) for Cognito, DynamoDB, Lambda, API Gateway, IAM | Cloud/DevOps | Outputs consumed by frontend config |
| Deployment Pipeline | Package Lambda artifact, upload to S3, deploy CloudFormation stack, grant admin group membership | Cloud/DevOps | Follow README provisioning overview |
| Hosting & CDN | Configure AWS Amplify Hosting for `frontend/`, set environment vars, connect domain if needed | Cloud/DevOps | Deploy updated assets on merge |
| Testing & QA | Functional tests for auth flows, movie CRUD, admin actions; verify CORS and permissions; run manual smoke tests post-deploy | QA/Engineering | Use CloudWatch logs for backend diagnostics |
| Operations & Monitoring | Set up CloudWatch log retention, alarms, review IAM least privilege, plan WAF/MFA enhancements | DevOps/SRE | Based on README security notes |

