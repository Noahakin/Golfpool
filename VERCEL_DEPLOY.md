# Deploy to Vercel - Step by Step

## Steps to Deploy via Vercel Web Interface

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Make sure you're logged in as `noahakin`

2. **Import Your Repository**
   - Click "Add New..." → "Project"
   - Click "Import Git Repository"
   - Find and select: `Noahakin/Golfpool`
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset**: Leave as "Other" or "Node.js"
   - **Root Directory**: Leave as `.` (root)
   - **Build Command**: Leave empty (or `npm install` if needed)
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`
   - **Development Command**: Leave empty

4. **Environment Variables** (if needed)
   - You can add environment variables here if needed later
   - For now, leave it empty

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete (2-5 minutes)

6. **Get Your Deployment URL**
   - After deployment, Vercel will give you a URL like: `https://golfpool-xxxxx.vercel.app`
   - Copy this URL

7. **Update Frontend API URL**
   - Once you have your Vercel URL, we need to update `public/script.js`
   - Replace the API URL with your Vercel deployment URL

## Important Notes

⚠️ **Puppeteer on Vercel**: Vercel uses serverless functions which may have limitations with Puppeteer. If you encounter issues, we may need to:
- Use `puppeteer-core` with a Chrome binary
- Or deploy to Railway/Render instead (better for Puppeteer)

## After Deployment

Once deployed, share your Vercel URL and I'll update the frontend code to use it!
