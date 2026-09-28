# Government Physical Asset Lifecycle Management System

This document explains how to run the project locally and validate that the main features are working correctly.

## 1) Prerequisites

Make sure you have the following installed on your machine:

- Node.js 18+ or 20+
- npm
- A browser such as Chrome or Edge

## 2) Open the project folder

Open a terminal in the project root:

```bash
cd "C:\Users\praja\Desktop\Pravi_hackthon"
```

## 3) Install dependencies

Run:

```bash
npm install
```

If you see warnings about SQLite experimental support, that is normal for Node's built-in SQLite feature in this project.

## 4) Start the backend server

Run:

```bash
npm start
```

The app should start on:

```text
http://localhost:3000/
```

You should see a message similar to:

```text
Government asset lifecycle backend running on port 3000
```

## 5) Check the app in the browser

Open this URL in your browser:

```text
http://localhost:3000/
```

You should see the government asset management portal login screen.

## 6) Login to the system

Use the default seeded users:

### Admin

- Email: admin@gov.in
- Password: Admin@123

### Inspector

- Email: inspector@gov.in
- Password: Inspector@123

## 7) Validate the backend API manually

Use these checks in a browser or via curl/Postman.

### Health check

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{ "status": "ok" }
```

### Admin login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gov.in","password":"Admin@123"}'
```

Expected result:

- HTTP 200
- A JWT token in the response

### Fetch master data

```bash
curl -X GET http://localhost:3000/api/assets/masters \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

Expected result:

- Department list
- Asset type list
- Inspector list

### Create department

```bash
curl -X POST http://localhost:3000/api/departments \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Public Works","description":"Department for civic projects","is_active":1}'
```

Expected result:

- HTTP 201
- Created department object

### Create asset type

```bash
curl -X POST http://localhost:3000/api/asset-types \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Water Treatment Plant","description":"Utility infrastructure asset","is_active":1}'
```

Expected result:

- HTTP 201
- Created asset type object

## 8) Validate the web UI workflow

After login:

1. Check the dashboard loads
2. Confirm the sidebar shows the available sections
3. Open the asset list
4. Create a new asset using the form
5. Confirm asset details appear in the list
6. Perform a lifecycle step such as planning or approval if available in the UI
7. Check that the status updates correctly

## 9) Run the automated tests

Run:

```bash
npm test
```

This project includes tests covering:

- health endpoint
- admin login
- master data access
- department and asset type creation

Expected result:

```text
4 tests passed
0 failed
```

## 10) Common troubleshooting

### Port already in use

If port 3000 is already in use, stop the existing process and rerun:

```bash
npm start
```

On Windows PowerShell, you can stop a process with:

```powershell
Stop-Process -Id <PID>
```

### Login fails

Check that you are using the exact credentials:

- admin@gov.in / Admin@123
- inspector@gov.in / Inspector@123

### API returns 404 or 500

Check that:

- the server is running
- the route is spelled correctly
- you are sending the Authorization token for protected endpoints
- your JSON body is valid

### Database issues

If the database is in a bad state, remove the SQLite file and reseed the project:

```bash
del .\data\asset_lifecycle.db
```

Then restart:

```bash
npm start
```

## 11) Final success checklist

The project is working correctly if all of the following are true:

- Server starts without errors
- Browser portal loads at http://localhost:3000/
- Admin login succeeds
- Inspector login succeeds
- Master data loads for admin
- Department creation works
- Asset type creation works
- Automated tests pass via `npm test`

## 12) Useful commands summary

```bash
npm install
npm start
npm test
```

## 13) Project root

Project root:

```text
C:\Users\praja\Desktop\Pravi_hackthon
```

If you want, I can also create a second file with a very short “quick start” version for your team.
