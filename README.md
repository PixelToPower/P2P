# P2P Chat App

A responsive peer-to-peer chat application built with React, Node.js, Express, MongoDB, and Socket.IO.

## Features

- Real-time direct and global lobby messaging
- Online/offline status and last-seen activity
- Connection requests with accept and decline actions
- Clickable user profiles and connection counts
- Instagram-style avatars and grouped message bubbles
- Local message deletion and delete-for-everyone actions
- Message editing and emoji reactions
- Reaction summary window showing all users and their reactions
- Reply, edit, delete, reaction, and swipe interactions
- Photo, file, voice-note, and in-app camera attachments
- Attachment preview and optional download
- Group lobby with active and offline member sections
- Clear Global P2P Lobby history on the current device
- App settings, themes, font sizes, privacy controls, notifications, and sound
- Login/logout and remembered local profiles
- Google OAuth-ready account verification with local passkey support
- Mobile, tablet, laptop, and desktop responsive layouts

## Tech Stack

### Frontend

- React 18
- Vite
- Socket.IO Client
- Axios
- CSS

### Backend

- Node.js
- Express
- Socket.IO
- MongoDB with Mongoose
- bcrypt
- JSON Web Tokens
- Google Identity Services / google-auth-library

## Project Structure

```text
P2P/
├── client/client/
│   ├── src/
│   │   ├── components/
│   │   └── App.jsx
│   └── package.json
├── server/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── server.js
└── README.md
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB Atlas or a local MongoDB instance
- Google OAuth client ID for Google verification

## Environment Variables

Create `server/.env`:

```env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_jwt_secret
GOOGLE_CLIENT_ID=your_google_o_auth_client_id
```

Create `client/client/.env`:

```env
VITE_GOOGLE_CLIENT_ID=your_google_o_auth_client_id
```

Never commit `.env` files or credentials.

## Installation

Install backend dependencies:

```bash
cd server
npm install
```

Install frontend dependencies:

```bash
cd client/client
npm install
```

## Running the App

Start the backend:

```bash
cd server
npm start
```

Start the frontend:

```bash
cd client/client
npm run dev
```

Open `http://localhost:5173`.

## Production Build

```bash
cd client/client
npm run build
```

The built frontend is generated in `client/client/dist`.

## Deploy with GitHub

The repository includes:

- `.github/workflows/deploy-pages.yml` for GitHub Pages
- `render.yaml` for the Node.js, MongoDB, and Socket.IO backend on Render

### 1. Deploy the backend

1. In Render, create a new Blueprint and select this GitHub repository.
2. Set `MONGO_URI` to the MongoDB Atlas connection string.
3. Set `GOOGLE_CLIENT_ID` for Google login.
4. Set `CORS_ORIGINS` to the GitHub Pages URL, for example `https://username.github.io`.
5. Deploy the `p2p-chat-server` service and copy its HTTPS URL.

### 2. Configure GitHub Pages

1. Open repository **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Open **Settings → Secrets and variables → Actions**.
4. Add `VITE_API_URL` with the Render service URL.
5. Add `VITE_GOOGLE_CLIENT_ID` with the Google OAuth web client ID.
6. Push or run the **Deploy P2P frontend to GitHub Pages** workflow.

The frontend will be available at:

```text
https://<github-username>.github.io/P2P/
```

For local development, `VITE_API_URL` defaults to `http://localhost:5001`.

## Security

- Passwords are hashed with bcrypt before storage.
- JWTs are used for authenticated sessions.
- Google Identity Services verifies Google account identity.
- Gmail passwords are never collected or stored by P2P.
- P2P passkeys are hashed before storage.
- Environment secrets remain in ignored `.env` files.

## Repository

GitHub: https://github.com/PixelToPower/P2P
