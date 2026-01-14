# ScraperAPI Setup Guide

This app now uses **ScraperAPI** instead of Puppeteer/Chromium, which means:
- ✅ **No Chromium download needed** - builds are fast!
- ✅ **Free tier available** - 1,000 requests/month
- ✅ **Works on any hosting platform** - no browser dependencies

## Step 1: Get Your Free API Key

1. Go to: https://www.scraperapi.com/
2. Click "Start Free Trial" or "Sign Up"
3. Create an account (free tier gives you 1,000 requests/month)
4. Copy your API key from the dashboard

## Step 2: Set the API Key

### Option A: Render.com (Recommended)
1. Go to your Render dashboard
2. Select your `golfpool-backend` service
3. Go to "Environment" tab
4. Add a new environment variable:
   - **Key**: `SCRAPERAPI_KEY`
   - **Value**: Your API key from ScraperAPI
5. Save and redeploy

### Option B: Local Development
Create a `.env` file in the project root:
```
SCRAPERAPI_KEY=your_api_key_here
```

Then install dotenv:
```bash
npm install dotenv
```

And add to the top of `server.js`:
```javascript
require('dotenv').config();
```

## Step 3: Test

Once deployed, test the API:
- `https://your-render-url.onrender.com/api/test` - Should work immediately
- `https://your-render-url.onrender.com/api/leaderboard` - Needs API key

## Free Tier Limits

- **1,000 requests/month** - Perfect for testing and small projects
- If you need more, paid plans start at $29/month for 10,000 requests

## Alternative APIs

If ScraperAPI doesn't work for you, you can easily switch to:
- **ScrapingBee**: https://www.scrapingbee.com/ (1,000 free requests)
- **Scrapingdog**: https://www.scrapingdog.com/ (1,000 free credits)

Just update the API URL in `server.js`!
