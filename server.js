const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Storage directory for odds snapshots
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test endpoint with sample data (for testing)
app.get('/api/test', (req, res) => {
  res.json({
    tournament: 'Sony Open in Hawaii',
    players: [
      { position: '1', name: 'Sample Player 1', odds: '+500', score: '-15' },
      { position: '2', name: 'Sample Player 2', odds: '+600', score: '-14' },
      { position: '3', name: 'Sample Player 3', odds: '+700', score: '-13' }
    ],
    lastUpdated: new Date().toISOString()
  });
});

// Convert American odds to implied probability
function convertAmericanOddsToProbability(americanOdds) {
  const odds = parseFloat(americanOdds);
  if (isNaN(odds)) return null;
  
  if (odds > 0) {
    // Positive odds: +500 means bet $100 to win $500
    // Probability = 100 / (odds + 100)
    return 100 / (odds + 100);
  } else {
    // Negative odds: -150 means bet $150 to win $100
    // Probability = |odds| / (|odds| + 100)
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

// Convert probability back to American odds format for display
function probabilityToAmericanOdds(probability) {
  if (probability <= 0 || probability >= 1) return 'N/A';
  
  const decimalOdds = 1 / probability;
  if (decimalOdds >= 2) {
    // Positive American odds
    return `+${Math.round((decimalOdds - 1) * 100)}`;
  } else {
    // Negative American odds
    return Math.round(-100 / (decimalOdds - 1)).toString();
  }
}

// Assign players to 6 tiers based on implied probability
function assignTiers(players) {
  if (players.length === 0) return players;
  
  // Sort by probability (highest first = favorite)
  const sorted = [...players].sort((a, b) => b.probability - a.probability);
  
  // Calculate tier sizes (evenly distributed)
  const totalPlayers = sorted.length;
  const tierSize = Math.ceil(totalPlayers / 6);
  
  // Assign tiers
  sorted.forEach((player, index) => {
    const tierNumber = Math.min(Math.floor(index / tierSize) + 1, 6);
    player.tier = tierNumber;
  });
  
  return sorted;
}

// Save odds snapshot to file
function saveOddsSnapshot(tournament, players) {
  const snapshot = {
    tournament,
    players,
    timestamp: new Date().toISOString(),
    week: getWeekNumber(new Date())
  };
  
  const filename = `odds-${tournament.toLowerCase().replace(/\s+/g, '-')}-${snapshot.week}.json`;
  const filepath = path.join(DATA_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
  console.log(`Saved odds snapshot to ${filename}`);
  
  return snapshot;
}

// Get odds snapshot from file
function getOddsSnapshot(tournament) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return null;
    }
    
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('odds-') && f.endsWith('.json'));
    
    // Find most recent snapshot for this tournament
    const tournamentFiles = files.filter(f => 
      f.toLowerCase().includes(tournament.toLowerCase().replace(/\s+/g, '-'))
    );
    
    if (tournamentFiles.length === 0) return null;
    
    // Get most recent file
    const latestFile = tournamentFiles.sort().reverse()[0];
    const filepath = path.join(DATA_DIR, latestFile);
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    return data;
  } catch (error) {
    console.error('Error reading odds snapshot:', error.message);
    return null;
  }
}

// Get week number (for weekly snapshots)
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// API endpoint to fetch odds from The Odds API
app.get('/api/odds', async (req, res) => {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'ODDS_API_KEY not configured',
        message: 'Please set ODDS_API_KEY environment variable. Get a free key at https://the-odds-api.com/'
      });
    }
    
    const tournament = req.query.tournament || 'Sony Open in Hawaii';
    
    // Check if we have a recent snapshot (same week)
    const currentWeek = getWeekNumber(new Date());
    const snapshot = getOddsSnapshot(tournament);
    
    if (snapshot && snapshot.week === currentWeek) {
      console.log('Returning cached odds snapshot');
      return res.json({
        tournament: snapshot.tournament,
        players: snapshot.players,
        lastUpdated: snapshot.timestamp,
        cached: true
      });
    }
    
    // Fetch fresh odds from The Odds API
    console.log('Fetching odds from The Odds API...');
    
    // The Odds API v4 endpoint for golf outrights
    const oddsApiUrl = `https://api.the-odds-api.com/v4/sports/golf/odds`;
    const params = {
      regions: 'us',
      markets: 'outrights',
      oddsFormat: 'american',
      apiKey: apiKey
    };
    
    const response = await axios.get(oddsApiUrl, {
      params: params,
      timeout: 30000
    });
    
    if (!response.data || response.data.length === 0) {
      return res.status(404).json({
        error: 'No odds data available',
        message: 'No golf tournaments with odds found. The tournament may not have odds available yet.'
      });
    }
    
    // Find the tournament (match by name or use first available)
    let tournamentData = response.data.find(event => 
      event.description && event.description.toLowerCase().includes(tournament.toLowerCase().split(' ')[0])
    );
    
    if (!tournamentData && response.data.length > 0) {
      // Use first available tournament if exact match not found
      tournamentData = response.data[0];
      console.log(`Using tournament: ${tournamentData.description || 'Unknown'}`);
    }
    
    if (!tournamentData) {
      return res.status(404).json({
        error: 'Tournament not found',
        message: `Could not find odds for "${tournament}". Available tournaments: ${response.data.map(e => e.description).join(', ')}`
      });
    }
    
    // Extract players and odds from bookmakers
    const players = [];
    const playerOddsMap = new Map();
    
    // Collect odds from all bookmakers
    tournamentData.bookmakers?.forEach(bookmaker => {
      bookmaker.markets?.forEach(market => {
        if (market.key === 'outrights') {
          market.outcomes?.forEach(outcome => {
            const playerName = outcome.name;
            const odds = outcome.price;
            
            if (!playerOddsMap.has(playerName)) {
              playerOddsMap.set(playerName, []);
            }
            
            // Store odds from this bookmaker
            playerOddsMap.get(playerName).push({
              bookmaker: bookmaker.title,
              odds: odds,
              probability: convertAmericanOddsToProbability(odds)
            });
          });
        }
      });
    });
    
    // Convert to player array, using average probability across bookmakers
    playerOddsMap.forEach((oddsData, playerName) => {
      // Calculate average probability
      const probabilities = oddsData.map(d => d.probability).filter(p => p !== null);
      if (probabilities.length === 0) return;
      
      const avgProbability = probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length;
      
      // Use the most common odds (or average) for display
      const displayOdds = oddsData[0].odds; // Use first bookmaker's odds for display
      
      players.push({
        name: playerName,
        odds: displayOdds > 0 ? `+${displayOdds}` : displayOdds.toString(),
        probability: avgProbability,
        position: '', // Will be set by tier
        score: '' // Scores come from separate endpoint
      });
    });
    
    // Assign tiers based on probability
    const tieredPlayers = assignTiers(players);
    
    // Add position based on tier
    tieredPlayers.forEach((player, index) => {
      player.position = (index + 1).toString();
    });
    
    // Save snapshot
    const newSnapshot = saveOddsSnapshot(tournamentData.description || tournament, tieredPlayers);
    
    console.log(`Fetched ${tieredPlayers.length} players with odds`);
    
    res.json({
      tournament: tournamentData.description || tournament,
      players: tieredPlayers,
      lastUpdated: newSnapshot.timestamp,
      cached: false
    });
    
  } catch (error) {
    console.error('Error fetching odds:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Odds API error',
        message: error.response.data?.message || error.message,
        details: 'Check your ODDS_API_KEY and API quota'
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch odds',
      message: error.message
    });
  }
});

// API endpoint for leaderboard/scores (separate from odds)
// This will use PGA Tour JSON endpoints for scores only
app.get('/api/leaderboard', async (req, res) => {
  try {
    // TODO: Implement PGA Tour JSON API for scores
    // For now, return empty scores - odds come from /api/odds
    
    res.json({
      tournament: 'Sony Open in Hawaii',
      players: [],
      lastUpdated: new Date().toISOString(),
      message: 'Scores endpoint - to be implemented with PGA Tour JSON API'
    });
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: error.message
    });
  }
});

// Combined endpoint that merges odds and scores
app.get('/api/combined', async (req, res) => {
  try {
    // Fetch odds
    const oddsResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/odds?tournament=${encodeURIComponent(req.query.tournament || 'Sony Open in Hawaii')}`);
    const oddsData = oddsResponse.data;
    
    // Fetch scores (when implemented)
    // const scoresResponse = await axios.get(`${req.protocol}://${req.get('host')}/api/leaderboard`);
    // const scoresData = scoresResponse.data;
    
    // Merge odds with scores
    const players = oddsData.players.map(player => ({
      ...player,
      // score: scoresData.players.find(p => p.name === player.name)?.score || ''
    }));
    
    res.json({
      tournament: oddsData.tournament,
      players: players,
      lastUpdated: oddsData.lastUpdated
    });
    
  } catch (error) {
    console.error('Error fetching combined data:', error.message);
    res.status(500).json({
      error: 'Failed to fetch combined data',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the leaderboard`);
});
