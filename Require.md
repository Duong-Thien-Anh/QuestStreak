Step 1
Read the project structure, existing auth code, and schema.ts. 
Summarize what auth system is currently in place and what needs to change.
Step 2
Read the project structure and schema.ts first.
Add a demo login system for local development and Render deployment:

- POST /api/auth/demo endpoint, only works when DEMO_MODE=true in env
- 3 hardcoded demo users: demo_dom_1 (dominant), demo_sub_1 (submissive), demo_admin (admin)
- Upsert user into `users` table using unionId from schema.ts types
- Return a JWT signed with JWT_SECRET env variable
- Add a /demo-login page with buttons to login as each demo user
- Store JWT in httpOnly cookie (not localStorage)
- Guard the endpoint: return 403 if DEMO_MODE is not "true"
Do not touch any existing auth code. Do not modify schema.ts
Step 3
Based on what you just implemented, generate:
1. .env.local.example with all required variables and comments
2. List of environment variables I need to add on Render dashboard
Step 4
Write a quick test script to verify the demo login endpoint works:
- Test POST /api/auth/demo with each demo user
- Test that it returns 403 when DEMO_MODE is false
- Use fetch or curl commands I can run directly