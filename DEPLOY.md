# CareTrack — Deployment Guide
## Going Live with GitHub + Vercel (Free)

---

## Overview
The flow is: **Your code → GitHub → Vercel → Live URL**
Every time you push an update to GitHub, Vercel automatically redeploys. Takes ~15 minutes total.

---

## Part 1 — Create a GitHub Account

1. Go to https://github.com and click **"Sign up"**
2. Choose a username, enter your email, and create a password
3. Verify your email address

---

## Part 2 — Put Your Code on GitHub

### Install Git (if you don't have it)
- Go to https://git-scm.com/downloads
- Download and install for your operating system
- Restart your terminal after installing

### Create a new GitHub repository
1. On GitHub, click the **"+"** icon (top right) → **"New repository"**
2. Name it `caretrack`
3. Set it to **Private** (so your credentials stay safe)
4. Leave everything else unchecked
5. Click **"Create repository"**

### Push your code to GitHub
Open a terminal, navigate to your `caretrack` folder, and run these commands one at a time:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/caretrack.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

> ⚠️ IMPORTANT: Make sure your `.env.local` file is NOT pushed to GitHub.
> Create a `.gitignore` file in your project root with these contents if one doesn't exist:
> ```
> node_modules/
> .env.local
> .env
> build/
> ```
> Your Supabase keys must stay out of GitHub — you'll add them directly to Vercel instead.

---

## Part 3 — Deploy on Vercel

1. Go to https://vercel.com and click **"Sign Up"**
2. Choose **"Continue with GitHub"** — this links your accounts
3. Click **"Add New Project"**
4. You'll see your `caretrack` repository listed — click **"Import"**
5. Vercel will auto-detect it as a React app. Leave all settings as default.
6. **Before clicking Deploy**, click **"Environment Variables"** and add these two:

   | Name | Value |
   |------|-------|
   | `REACT_APP_SUPABASE_URL` | `https://your-project-id.supabase.co` |
   | `REACT_APP_SUPABASE_ANON_KEY` | `your-anon-key-here` |

   (These are the same values from your `.env.local` file)

7. Click **"Deploy"**
8. Wait ~2 minutes for the build to complete

---

## Part 4 — Your Live URL

Once deployed, Vercel gives you a URL like:
```
https://caretrack-yourname.vercel.app
```

That's it — anyone with that link can access CareTrack from any device.

You can find the URL on your Vercel project dashboard. You can also set a custom domain later if you want (e.g. `caretrack.yourclinic.com`) under Project Settings → Domains.

---

## Updating the App in the Future

Whenever you make changes to the code locally, just run:
```bash
git add .
git commit -m "Description of your change"
git push
```
Vercel will automatically detect the push and redeploy within ~2 minutes.

---

## Sharing with Your Team

- Share the Vercel URL with anyone who needs access
- All users write to the same Supabase database, so data is shared in real time
- If you want to restrict who can log in, the next step would be adding Supabase Auth (user accounts + login screen) — let your developer know when you're ready for that

---

## Troubleshooting

**Build fails on Vercel** — Check that your environment variables are set correctly under Project Settings → Environment Variables in Vercel.

**"● DB ERROR" after deploying** — The env variables weren't saved before deploying. Go to Vercel → Project Settings → Environment Variables, add them, then go to Deployments → click the three dots on the latest deployment → "Redeploy."

**Site loads but data doesn't appear** — In Supabase, go to Authentication → Policies and confirm the "Allow all access" policy exists on the `sessions` table.
