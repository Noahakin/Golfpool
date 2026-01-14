# The Odds API Setup Guide

This application uses [The Odds API](https://the-odds-api.com/) to fetch golf betting odds. The Odds API provides real-time odds from multiple sportsbooks.

## Getting Your API Key

1. **Sign up for a free account** at https://the-odds-api.com/
   - Free tier: 500 requests/month
   - No credit card required

2. **Get your API key** from the dashboard:
   - Log in to https://the-odds-api.com/
   - Navigate to your dashboard
   - Copy your API key

## Setting Up on Render

1. **Go to your Render dashboard**: https://dashboard.render.com/

2. **Select your service** (golfpool-backend)

3. **Go to Environment**: Click on "Environment" in the left sidebar

4. **Add environment variable**:
   - **Key**: `ODDS_API_KEY`
   - **Value**: Your API key from The Odds API dashboard
   - Click "Save Changes"

5. **Redeploy**: Render will automatically redeploy when you save environment variables

## How It Works

- **Endpoint**: `/api/odds`
- **Data Source**: The Odds API v4 (`https://api.the-odds-api.com/v4/sports/golf/odds`)
- **Market**: `outrights` (golfers to win the tournament)
- **Format**: American odds (e.g., +500, -150)

## Odds Snapshot System

- Odds are fetched once per week (on Wednesday)
- Snapshots are stored in the `data/` directory
- If a snapshot exists for the current week, it's returned from cache
- This prevents unnecessary API calls and ensures consistent tier assignments

## API Limits

- **Free tier**: 500 requests/month
- **Paid tiers**: Available if you need more requests
- Check your usage at https://the-odds-api.com/dashboard

## Troubleshooting

### Error: "ODDS_API_KEY not configured"
- Make sure you've added `ODDS_API_KEY` to your Render environment variables
- Verify the key is correct (no extra spaces)

### Error: "No odds data available"
- The tournament may not have odds available yet
- Check The Odds API dashboard to see available tournaments

### Error: "Odds API error" with status 401
- Your API key is invalid or expired
- Get a new key from https://the-odds-api.com/dashboard

### Error: "Odds API error" with status 429
- You've exceeded your monthly request limit
- Wait until next month or upgrade your plan

## Testing Locally

1. Create a `.env` file in the project root:
   ```
   ODDS_API_KEY=your_api_key_here
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the server:
   ```bash
   npm start
   ```

4. Visit http://localhost:3000

## Notes

- Odds are normalized to implied probability for tier assignment
- Tiers are evenly distributed across all players
- Tier assignments persist once odds are locked (same week snapshot)
