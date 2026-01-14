# GitHub Setup Instructions

## Step 1: Create Repository on GitHub

1. Go to: https://github.com/new
2. Repository name: `pga-tour-leaderboard` (or your preferred name)
3. Choose Public or Private
4. **DO NOT** check "Add a README file", "Add .gitignore", or "Choose a license"
5. Click "Create repository"

## Step 2: Push Your Code

After creating the repository, run these commands:

```powershell
cd "C:\Users\nakin\OneDrive\Desktop"

# If you used a different repository name, update this:
git remote set-url origin https://github.com/Noahakin/YOUR_REPO_NAME.git

# Push to GitHub
git push -u origin main
```

## Alternative: If you want to use a different repository name

If you want to use a different name, first create it on GitHub, then run:

```powershell
cd "C:\Users\nakin\OneDrive\Desktop"
git remote set-url origin https://github.com/Noahakin/YOUR_REPO_NAME.git
git push -u origin main
```

## Current Status

✅ Git repository initialized
✅ All files committed
✅ Remote configured (will need to update URL if different repo name)
⏳ Waiting for GitHub repository creation
