# Deploy to Railway - Step by Step Guide

Railway is perfect for Puppeteer because it runs full Node.js servers (not serverless functions).

## Step 1: Sign Up / Login to Railway

1. Go to: https://railway.app
2. Click "Start a New Project"
3. Sign in with GitHub (use your `noahakin` account)

## Step 2: Deploy Your Repository

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Find and select: `Noahakin/Golfpool`
4. Railway will automatically detect it's a Node.js app

## Step 3: Configure the Deployment

Railway should auto-detect:
- **Build Command**: `npm install` (automatic)
- **Start Command**: `npm start` (from package.json)
- **Port**: Railway will set `PORT` environment variable automatically

## Step 4: Get Your Railway URL

1. After deployment starts, click on your project
2. Click on the service/deployment
3. Go to "Settings" tab
4. Under "Domains", you'll see your Railway URL like: `https://golfpool-production.up.railway.app`
5. **Copy this URL** - you'll need it!

## Step 5: Update Frontend Code

Once you have your Railway URL:

1. Open `public/script.js`
2. Find the line: `const RAILWAY_URL = 'https://your-app-name.railway.app';`
3. Replace `https://your-app-name.railway.app` with your actual Railway URL
4. Commit and push to GitHub
5. Your Vercel frontend will now use the Railway backend!

## Step 6: Test

1. Test Railway API directly:
   - `https://your-railway-url.railway.app/api/test` - should work immediately
   - `https://your-railway-url.railway.app/api/leaderboard` - should scrape PGA Tour

2. Test from your Vercel frontend:
   - Go to your Vercel site
   - Click "Refresh Data"
   - It should now connect to Railway backend!

## Troubleshooting

### If deployment fails:
- Check Railway logs (click on deployment → Logs tab)
- Make sure `package.json` has correct start script
- Railway needs Node.js 14+ (we have that in engines)

### If Puppeteer errors:
- Railway supports Puppeteer much better than Vercel
- Check logs for specific errors
- May need to wait a bit for first request (cold start)

## Current Setup

- ✅ Backend: Railway (for Puppeteer)
- ✅ Frontend: Vercel (for static hosting)
- ✅ API calls: Frontend → Railway backend

This is the best setup for your app!
