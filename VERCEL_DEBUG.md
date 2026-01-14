# How to Debug Vercel 404 Errors

## Step 1: Check Vercel Logs

1. Go to: https://vercel.com/dashboard
2. Click on your project
3. Click "Deployments" tab
4. Click on the latest deployment
5. Click "Functions" tab - you'll see all your API functions listed
6. Click on a function (like `api/test`) to see its logs
7. Or click "Logs" tab to see real-time logs

## Step 2: Test API Endpoints Directly

Open these URLs in your browser (replace with your actual Vercel URL):

1. **Test endpoint** (should work immediately):
   ```
   https://your-vercel-url.vercel.app/api/test
   ```

2. **Leaderboard endpoint**:
   ```
   https://your-vercel-url.vercel.app/api/leaderboard
   ```

## Step 3: Check Function Status

In Vercel dashboard:
- Go to your project → Functions tab
- You should see:
  - `api/test.js` 
  - `api/leaderboard.js`
- If they're not listed, the functions aren't being detected

## Step 4: Common Issues

### Issue: Functions not detected
**Solution**: Make sure files are in `api/` folder and named correctly:
- ✅ `api/test.js`
- ✅ `api/leaderboard.js`
- ❌ `api/test.ts` (wrong extension)
- ❌ `api/test/index.js` (wrong structure)

### Issue: 404 on all routes
**Solution**: Vercel might need the files in root or different structure. Try:
- Move `public/index.html` to root `index.html`
- Or update vercel.json routing

### Issue: CORS errors
**Solution**: Already handled in the code with CORS headers

## Step 5: View Real-time Logs

In Vercel dashboard:
1. Go to your project
2. Click "Logs" tab
3. You'll see real-time console.log output
4. Look for errors or the log messages we added

## What to Share

If you're still getting 404s, share:
1. Screenshot of Vercel Functions tab (showing which functions are detected)
2. The exact URL you're trying to access
3. Any error messages from the Logs tab
4. Screenshot of the browser's Network tab (F12 → Network) showing the failed request
