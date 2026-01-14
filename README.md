# PGA Tour Leaderboard & Odds Scraper

A web application that fetches and displays player information and betting odds from the PGA Tour website.

## Features

- 🏌️ Real-time leaderboard data from PGA Tour website
- 📊 Displays player positions, names, odds, and scores
- 🔄 Refresh button to update data
- 📱 Responsive design for mobile and desktop
- ⚡ Fast and efficient data fetching

## Installation

1. Install Node.js (version 14 or higher) if you haven't already.

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Click the "Refresh Data" button to fetch the latest leaderboard and odds from the PGA Tour website.

## How It Works

- The backend uses Puppeteer to scrape the PGA Tour website
- Data is extracted from the leaderboard/odds page
- The frontend displays the data in a clean, organized table
- The server runs on port 3000 by default

## Customization

You can modify the tournament URL by passing a `url` query parameter:
```
http://localhost:3000/api/leaderboard?url=YOUR_PGA_TOUR_URL
```

## Notes

- The scraping may need adjustments if the PGA Tour website structure changes
- Some data may not be available depending on the tournament page structure
- The first load may take a few seconds as Puppeteer needs to launch a browser

## Troubleshooting

If you encounter issues:
1. Make sure all dependencies are installed: `npm install`
2. Check that port 3000 is not already in use
3. Ensure you have a stable internet connection
4. The PGA Tour website structure may have changed - you may need to update the scraping logic
