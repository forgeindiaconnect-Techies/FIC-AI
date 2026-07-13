# Forge AI

## Overview

**Forge AI** is a local AI assistant built with:
- **Frontend**: React + Vite, Tailwind CSS, premium dark glassmorphism UI.
- **Backend**: Node.js + Express.
- **Database**: MongoDB.
- **AI Engine**: Ollama (local) running `llama3`.

It provides a ChatGPT‑style chat interface with chat history, streaming messages, and stores each conversation turn in MongoDB.

## Folder Structure

```
forge-ai/
├─ client/                # React Vite app
│   ├─ src/
│   │   ├─ components/
│   │   │   ├─ Sidebar.jsx
│   │   │   ├─ Chat.jsx
│   │   │   ├─ Message.jsx
│   │   │   └─ InputBox.jsx
│   │   ├─ utils/
│   │   │   └─ api.js
│   │   ├─ App.jsx
│   │   ├─ index.jsx
│   │   └─ index.css
│   ├─ index.html
│   ├─ vite.config.js
│   └─ tailwind.config.js
├─ server/                # Express API
│   ├─ models/
│   │   └─ Message.js
│   ├─ routes/
│   │   └─ chat.js
│   ├─ .env.example
│   ├─ index.js
│   └─ package.json
├─ .gitignore
└─ .env.example          # Example env for both server & client
```

## Setup & Installation

### Prerequisites
- **Node.js** (v18+)
- **npm** (or **yarn**)
- **MongoDB** instance (local or Atlas)
- **Ollama** installed and running (`ollama serve`). Ensure the `llama3` model is pulled:
  ```bash
  ollama pull llama3
  ```

### 1. Clone / Create Project
```bash
# Navigate to your workspace
cd "C:/Users/Forgeindiaconnect/OneDrive/Documents/My-Projects/AI"
# Create the project (already generated) – just cd in
cd forge-ai
```

### 2. Install Backend
```bash
cd server
npm install
# Copy example env and edit values
cp .env.example .env
# Set MONGODB_URI and PORT (default 5000)
```

### 3. Install Frontend
```bash
cd ../client
npm install
# Copy example env (optional for future env vars)
cp .env.example .env
```

### 4. Run Development Servers
#### Backend
```bash
cd ../server
npm run dev   # Starts Express on PORT (default 5000)
```
#### Frontend
```bash
cd ../client
npm run dev   # Vite dev server (default http://localhost:5173)
```

The frontend proxies API calls to `http://localhost:5000/api` (see `vite.config.js`).

## Environment Variables
- `PORT` – Port for the Express server (default **5000**).
- `MONGODB_URI` – MongoDB connection string.

Both are defined in `server/.env.example`.

## API Endpoint
`POST /api/ai/chat`
```json
{ "message": "Your prompt here" }
```
Response:
```json
{ "reply": "AI response" }
```
If Ollama is not reachable, the API returns **503** with `{ "error": "Local AI server not running" }`.

## Deployment
- **Frontend** can be built (`npm run build`) and deployed to Vercel.
- **Backend** can be containerized or deployed to Render (use the same `npm start` script).

---

Enjoy building with **Forge AI**! 🎉
