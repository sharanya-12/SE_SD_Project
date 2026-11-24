# CurbGrid — Urban & Campus Parking Slot Finder

Full-stack SpotHero-style parking discovery, bay selection, digital QR gate pass reservation, and admin operations console built with React, Vite, Tailwind CSS, and Express.

## Running Locally in VS Code

### Prerequisites
- **Node.js 20.19+ or 22+** (Node 22.18+ recommended for `npm start`)
- **npm 10+**
- **MongoDB Community Server** running locally (default URI: `mongodb://127.0.0.1:27017`)

### 1. Install Dependencies
Open the VS Code integrated terminal (`Ctrl + \`` / `Cmd + \``) in the project root and run:

```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```

This starts the Express API server and Vite frontend together on:
- **http://localhost:3000**

*(Note: Always run `npm run dev` rather than opening `index.html` directly, because authentication, facility inventory, and reservation persistence run through the Express `/api/*` server on port 3000.)*

The finder uses an interactive OpenStreetMap map. Place lookup and turn-by-turn driving directions require an internet connection and use OpenStreetMap's Nominatim service and OSRM; requesting directions sends the selected place and browser-approved current coordinates to OSRM. Select **Start** to follow live GPS updates, or use **Next step** to advance manually. **End** closes navigation; select **Show directions** to reopen the steps. Demo parking pin positions are approximate.

### 3. Production Build & Start
```bash
npm run build
NODE_ENV=production npm start
```
On Windows PowerShell:
```powershell
npm run build
$env:NODE_ENV="production"; npm start
```

### 4. Type Check
```bash
npm run lint
```

## MongoDB, Accounts & Persistent Backend

The Express backend stores application data in MongoDB collections: `accounts`, `facilities`, `reservations`, and `app_metadata`. By default it connects to the local `curbgrid` database at `mongodb://127.0.0.1:27017/curbgrid`.

1. Install MongoDB Community Server and make sure its service is running.
2. Copy `.env.example` to `.env` in the project root. Keep the default `MONGODB_URI` for a local MongoDB installation, or change it to your local connection URI.
3. Start the project with `npm run dev`. The server connects to MongoDB before it starts listening.

On first start, if the MongoDB collections are empty, CurbGrid imports existing data from `data/curbgrid-db.json` when present. If there is no legacy JSON data, it initializes the demo accounts, facilities, and sample reservations. The JSON file is left untouched as a backup. You can inspect the database and collections using MongoDB Compass with the same URI.

- Every driver can enter their own **Full Name, Email, Password, License Plate, and Vehicle Model** via **Create Account** on the login page (`POST /api/auth/register`) and sign in anytime (`POST /api/auth/login`).
- Passwords are salted and hashed with `crypto.scryptSync`, and sessions use HMAC-SHA256 Bearer tokens.
- User accounts, reservations, and facility edits are persisted in MongoDB and survive server restarts.
- Administrators can also view registered accounts and create additional Driver or Admin credentials from the **Users** tab in the Admin Console.

## Demo Login Credentials

### Driver / User Portal
- **Email:** `driver@curbgrid.app`
- **Password:** `DriverPass2026!`
- *(Or click **Create Account** to register your own credentials.)*

### Admin Portal
- **Email:** `admin@curbgrid.app`
- **Password:** `AdminOps2026!`
