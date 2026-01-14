# Deploy to Render.com - Alternative to Railway

Render.com handles Puppeteer much better and has more reliable builds.

## Step 1: Sign Up / Login

1. Go to: https://render.com
2. Sign up/Login with GitHub (use your `noahakin` account)

## Step 2: Create New Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub account if not already connected
3. Select repository: `Noahakin/Golfpool`

## Step 3: Configure Service

Render will auto-detect settings, but verify:
- **Name**: `golfpool-backend` (or any name you want)
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (or paid if you want)

## Step 4: Advanced Settings (Optional)

Click "Advanced" and you can:
- Set environment variables if needed
- Adjust instance size (Free tier should work)

## Step 5: Deploy

1. Click "Create Web Service"
2. Render will start building (should take 3-5 minutes)
3. Wait for "Live" status

## Step 6: Get Your URL

1. Once deployed, you'll see your URL like: `https://golfpool-backend.onrender.com`
2. **Copy this URL** - you'll need it!

## Step 7: Update Frontend

1. Open `public/script.js`
2. Find: `const RAILWAY_URL = 'https://your-app-name.railway.app';`
3. Replace with your Render URL: `const RAILWAY_URL = 'https://golfpool-backend.onrender.com';`
4. Commit and push

## Why Render?

- ✅ Better Puppeteer support
- ✅ More reliable builds
- ✅ Free tier available
- ✅ Automatic deployments from GitHub

## Test After Deployment

1. Test API: `https://your-render-url.onrender.com/api/test`
2. Test scraping: `https://your-render-url.onrender.com/api/leaderboard`
3. Update frontend and test from Vercel site
