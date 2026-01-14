# Deployment Guide

## The Problem

When your website is published (e.g., on GitHub Pages), it can't connect to `localhost:3000` because that only works on your local machine. You need to deploy the backend server to a hosting service.

## Solution: Deploy Backend to Railway (Recommended)

Railway is free and easy to use for Node.js apps with Puppeteer.

### Step 1: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and sign up/login with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `Golfpool` repository
5. Railway will auto-detect it's a Node.js app
6. It will automatically deploy your server

### Step 2: Get Your Backend URL

1. After deployment, Railway will give you a URL like: `https://your-app-name.railway.app`
2. Copy this URL

### Step 3: Update Frontend Code

1. Open `public/script.js`
2. Find this line:
   ```javascript
   : 'https://your-backend-url.railway.app/api/leaderboard';
   ```
3. Replace `your-backend-url.railway.app` with your actual Railway URL
4. Commit and push to GitHub

### Step 4: Update Frontend Deployment

If you're using GitHub Pages or another static host, push the updated code.

## Alternative: Deploy to Render

1. Go to [render.com](https://render.com)
2. Create a new "Web Service"
3. Connect your GitHub repo
4. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node
5. Deploy and get your URL
6. Update the API_URL in `public/script.js`

## Alternative: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Vercel will auto-detect Node.js
4. Add build settings if needed
5. Deploy and get your URL
6. Update the API_URL in `public/script.js`

## Environment Variables (Optional)

For better configuration, you can use environment variables:

1. Create a `.env` file (add to .gitignore):
   ```
   API_URL=http://localhost:3000/api/leaderboard
   ```

2. Update `public/script.js` to read from environment or use a config file

## Quick Fix for Testing

If you just want to test locally, make sure your server is running:
```bash
npm start
```

Then access the site at `http://localhost:3000`

## Current Status

- ✅ Backend code ready for deployment
- ⏳ Need to deploy backend to Railway/Render/Vercel
- ⏳ Need to update API_URL in frontend code
- ⏳ Need to redeploy frontend
