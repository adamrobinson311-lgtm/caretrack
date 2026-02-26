# CareTrack — Setup Guide

Follow these steps to get CareTrack running locally with a live Supabase database.

---

## Step 1 — Create a Supabase Project

1. Go to https://supabase.com and sign up for a free account
2. Click **"New Project"**
3. Choose a name (e.g. `caretrack`), set a database password, and pick a region close to you
4. Wait ~2 minutes for the project to provision

---

## Step 2 — Create the Database Table

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy the entire contents of `schema.sql` (included in this project folder)
4. Paste it into the editor and click **"Run"**
5. You should see "Success. No rows returned" — the table is created

---

## Step 3 — Get Your API Credentials

1. In Supabase, go to **Project Settings → API** (gear icon in the sidebar)
2. You need two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — a long string starting with `eyJ...`

---

## Step 4 — Configure the App

1. In the `caretrack` project folder, find the file `.env.example`
2. Copy it and rename the copy to `.env.local`:
   ```
   cp .env.example .env.local
   ```
3. Open `.env.local` and fill in your values:
   ```
   REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
   ```

---

## Step 5 — Install Dependencies & Run

Make sure you have **Node.js** installed (https://nodejs.org — download the LTS version if not).

Open a terminal, navigate to the `caretrack` folder, and run:

```bash
npm install
npm start
```

The app will open automatically at http://localhost:3000

You should see a green **● CONNECTED** indicator in the top-right of the header.

---

## How It Works

- Every time you save a session in the **Log Session** tab, the data is written directly to your Supabase `sessions` table
- When the app loads, it fetches all past sessions from Supabase and displays them in the Dashboard and History tabs
- Data persists permanently — closing the browser or restarting the app won't lose anything
- You can view and manage your raw data anytime in **Supabase → Table Editor → sessions**

---

## Troubleshooting

**Red ● DB ERROR banner** — Your `.env.local` credentials are missing or incorrect. Double-check the URL and anon key from Supabase Project Settings → API.

**"Failed to save" error** — Make sure you ran the `schema.sql` script in the SQL Editor and the `sessions` table exists.

**App won't start** — Make sure Node.js is installed (`node --version` in terminal should return a version number).

---

## Project File Structure

```
caretrack/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx          ← Main application (UI + logic)
│   └── supabaseClient.js ← Supabase connection
├── schema.sql           ← Run this in Supabase SQL Editor
├── .env.example         ← Copy to .env.local and fill in credentials
├── .env.local           ← Your credentials (never commit this file)
└── package.json
```
