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
    
    // First, check available sports to find the correct golf sport key
    // Prioritize general PGA Tour golf over tournament-specific keys
    let golfSportKey = 'golf';
    const golfSportKeys = [];
    
    try {
      const sportsResponse = await axios.get(`https://api.the-odds-api.com/v4/sports`, {
        params: { apiKey: apiKey },
        timeout: 10000
      });
      
      if (sportsResponse.data) {
        // Find all golf-related sport keys
        const allGolfSports = sportsResponse.data.filter(sport => 
          sport.key && (sport.key.toLowerCase().includes('golf') || sport.title.toLowerCase().includes('golf'))
        );
        
        console.log('All golf sports found:', allGolfSports.map(s => `${s.key} (${s.title})`).join(', '));
        
        // Prioritize general golf keys over tournament-specific ones
        // Look for: golf, golf_pga, golf_pga_tour, etc. (not golf_masters, golf_us_open, etc.)
        const generalGolf = allGolfSports.find(sport => {
          const key = sport.key.toLowerCase();
          return key === 'golf' || 
                 key === 'golf_pga' || 
                 key === 'golf_pga_tour' ||
                 (key.includes('golf') && !key.includes('masters') && !key.includes('us_open') && !key.includes('pga_championship') && !key.includes('open_championship'));
        });
        
        if (generalGolf) {
          golfSportKey = generalGolf.key;
          console.log(`Using general golf sport key: ${golfSportKey}`);
        } else if (allGolfSports.length > 0) {
          // Fallback to first golf sport found
          golfSportKey = allGolfSports[0].key;
          console.log(`Using first golf sport found: ${golfSportKey}`);
        } else {
          console.log('Golf not found in available sports. Available sports:', sportsResponse.data.map(s => s.key).join(', '));
        }
      }
    } catch (sportsError) {
      console.log('Could not fetch sports list, using default "golf" key');
    }
    
    // Try to get events first, then odds for each event
    // If the first golf sport key doesn't have Sony Open, try other golf keys
    let tournamentData = null;
    let allGolfSportKeys = [golfSportKey];
    
    // Get list of all golf sport keys to try
    try {
      const sportsResponse = await axios.get(`https://api.the-odds-api.com/v4/sports`, {
        params: { apiKey: apiKey },
        timeout: 10000
      });
      
      if (sportsResponse.data) {
        allGolfSportKeys = sportsResponse.data
          .filter(sport => sport.key && sport.key.toLowerCase().includes('golf'))
          .map(sport => sport.key);
        
        // Prioritize general golf keys first
        const generalKeys = allGolfSportKeys.filter(k => 
          k === 'golf' || k === 'golf_pga' || k === 'golf_pga_tour' ||
          (k.includes('golf') && !k.includes('masters') && !k.includes('us_open') && !k.includes('pga_championship') && !k.includes('open_championship'))
        );
        const specificKeys = allGolfSportKeys.filter(k => !generalKeys.includes(k));
        allGolfSportKeys = [...generalKeys, ...specificKeys];
        
        console.log(`Will try golf sport keys in order: ${allGolfSportKeys.join(', ')}`);
      }
    } catch (e) {
      console.log('Could not get all golf keys, using single key');
    }
    
    // Try each golf sport key until we find Sony Open
    for (const sportKey of allGolfSportKeys) {
      try {
        console.log(`Trying golf sport key: ${sportKey}`);
        // Get events for this golf sport key
        const eventsResponse = await axios.get(`https://api.the-odds-api.com/v4/sports/${sportKey}/events`, {
          params: { apiKey: apiKey },
          timeout: 30000
        });
        
        if (eventsResponse.data && eventsResponse.data.length > 0) {
        const now = new Date();
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        // Filter to upcoming/current tournaments (within next 7 days)
        const upcomingEvents = eventsResponse.data.filter(event => {
          if (!event.commenceTime) return false;
          const eventDate = new Date(event.commenceTime);
          return eventDate >= now && eventDate <= oneWeekFromNow;
        });
        
        console.log(`Found ${eventsResponse.data.length} total events, ${upcomingEvents.length} upcoming this week`);
        console.log('Upcoming events:', upcomingEvents.map(e => `${e.description} (${e.commenceTime})`).join(', '));
        
        // First, try to find exact tournament name match in upcoming events
        const tournamentLower = tournament.toLowerCase();
        // For "Sony Open in Hawaii", look for "sony" and "open" and "hawaii"
        const keywords = tournamentLower.split(' ').filter(w => w.length > 2);
        console.log(`Searching for tournament with keywords: ${keywords.join(', ')}`);
        
        tournamentData = upcomingEvents.find(event => {
          if (!event.description) return false;
          const descLower = event.description.toLowerCase();
          // Check if description contains multiple keywords (better match)
          const matchingKeywords = keywords.filter(keyword => descLower.includes(keyword));
          if (matchingKeywords.length >= 2) {
            console.log(`Found match: "${event.description}" (matched keywords: ${matchingKeywords.join(', ')})`);
            return true;
          }
          return false;
        });
        
        // If no exact match, use the most immediate upcoming tournament
        if (!tournamentData && upcomingEvents.length > 0) {
          // Sort by commence time (earliest first)
          upcomingEvents.sort((a, b) => {
            const dateA = new Date(a.commenceTime || 0);
            const dateB = new Date(b.commenceTime || 0);
            return dateA - dateB;
          });
          tournamentData = upcomingEvents[0];
          console.log(`No exact match found, using most immediate tournament: ${tournamentData.description || 'Unknown'}`);
        }
        
        // If still no tournament, try all events (not just upcoming)
        if (!tournamentData && eventsResponse.data.length > 0) {
          tournamentData = eventsResponse.data.find(event => {
            if (!event.description) return false;
            const descLower = event.description.toLowerCase();
            const keywords = tournamentLower.split(' ').filter(w => w.length > 2);
            return keywords.some(keyword => descLower.includes(keyword));
          });
          
          if (!tournamentData) {
            // Last resort: use first event
            tournamentData = eventsResponse.data[0];
            console.log(`Using first available tournament: ${tournamentData.description || 'Unknown'}`);
          } else {
            console.log(`Found tournament in all events: ${tournamentData.description || 'Unknown'}`);
          }
        }
        
          if (tournamentData) {
            console.log(`Selected tournament: "${tournamentData.description}" (ID: ${tournamentData.id}, Date: ${tournamentData.commenceTime || 'unknown'})`);
            golfSportKey = sportKey; // Use this sport key for odds fetching
            break; // Found the tournament, stop trying other keys
          }
        }
      } catch (eventsError) {
        console.log(`Could not fetch events for ${sportKey}, trying next key...`);
        continue; // Try next golf sport key
      }
    }
    
    // If we still don't have tournamentData, try direct odds endpoint with the best golf key
    if (!tournamentData) {
      console.log('Could not find tournament in events, trying direct odds endpoint...');
    }
    
    // If we have an event, get odds for it; otherwise try the odds endpoint directly
    let response;
    if (tournamentData && tournamentData.id) {
      // Get odds for specific event
      const oddsApiUrl = `https://api.the-odds-api.com/v4/sports/${golfSportKey}/events/${tournamentData.id}/odds`;
      response = await axios.get(oddsApiUrl, {
        params: {
          regions: 'us',
          markets: 'outrights',
          oddsFormat: 'american',
          apiKey: apiKey
        },
        timeout: 30000
      });
      tournamentData = response.data;
    } else {
      // Try direct odds endpoint
      const oddsApiUrl = `https://api.the-odds-api.com/v4/sports/${golfSportKey}/odds`;
      response = await axios.get(oddsApiUrl, {
        params: {
          regions: 'us',
          markets: 'outrights',
          oddsFormat: 'american',
          apiKey: apiKey
        },
        timeout: 30000
      });
      
      if (!response.data || response.data.length === 0) {
        return res.status(404).json({
          error: 'No odds data available',
          message: `No golf tournaments with odds found. Golf may not be available in The Odds API, or the tournament may not have odds yet. Try checking available sports at https://the-odds-api.com/liveapi/guides/v4/#sports-endpoint`
        });
      }
      
      // Filter to upcoming tournaments (within next 7 days)
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const upcomingEvents = response.data.filter(event => {
        if (!event.commenceTime) return false;
        const eventDate = new Date(event.commenceTime);
        return eventDate >= now && eventDate <= oneWeekFromNow;
      });
      
      console.log(`Direct odds endpoint: Found ${response.data.length} total events, ${upcomingEvents.length} upcoming this week`);
      
      // Find matching tournament in upcoming events first
      const tournamentLower = tournament.toLowerCase();
      const keywords = tournamentLower.split(' ').filter(w => w.length > 2);
      console.log(`Direct endpoint: Searching for tournament with keywords: ${keywords.join(', ')}`);
      
      tournamentData = upcomingEvents.find(event => {
        if (!event.description) return false;
        const descLower = event.description.toLowerCase();
        // Check if description contains multiple keywords (better match)
        const matchingKeywords = keywords.filter(keyword => descLower.includes(keyword));
        if (matchingKeywords.length >= 2) {
          console.log(`Found match: "${event.description}" (matched keywords: ${matchingKeywords.join(', ')})`);
          return true;
        }
        return false;
      });
      
      // If no match in upcoming, try all events
      if (!tournamentData) {
        tournamentData = response.data.find(event => {
          if (!event.description) return false;
          const descLower = event.description.toLowerCase();
          const matchingKeywords = keywords.filter(keyword => descLower.includes(keyword));
          if (matchingKeywords.length >= 2) {
            console.log(`Found match in all events: "${event.description}" (matched keywords: ${matchingKeywords.join(', ')})`);
            return true;
          }
          return false;
        });
      }
      
      // If still no match, use most immediate upcoming tournament
      if (!tournamentData && upcomingEvents.length > 0) {
        upcomingEvents.sort((a, b) => {
          const dateA = new Date(a.commenceTime || 0);
          const dateB = new Date(b.commenceTime || 0);
          return dateA - dateB;
        });
        tournamentData = upcomingEvents[0];
        console.log(`Using most immediate upcoming tournament: ${tournamentData.description || 'Unknown'}`);
      }
      
      // Last resort: use first available
      if (!tournamentData && response.data.length > 0) {
        tournamentData = response.data[0];
        console.log(`Using first available tournament: ${tournamentData.description || 'Unknown'}`);
      }
      
      if (tournamentData) {
        console.log(`Selected tournament from direct endpoint: "${tournamentData.description}" (Date: ${tournamentData.commenceTime || 'unknown'})`);
      }
    }
    
    if (!tournamentData) {
      return res.status(404).json({
        error: 'Tournament not found',
        message: `Could not find odds for "${tournament}". Golf may not be available in The Odds API. Check available sports at https://the-odds-api.com/liveapi/guides/v4/#sports-endpoint`
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
    console.error('Error details:', error.response?.data || error.response?.status);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 404) {
        return res.status(404).json({
          error: 'Golf odds not available',
          message: 'The Odds API does not currently support golf odds, or the endpoint structure has changed.',
          details: 'Golf may not be available in The Odds API. You may need to use a different API or data source for golf betting odds.',
          suggestion: 'Check available sports at: https://api.the-odds-api.com/v4/sports?apiKey=YOUR_KEY'
        });
      }
      
      if (status === 401) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid API key. Please check your ODDS_API_KEY in Render environment variables.',
          details: 'Get a free API key at https://the-odds-api.com/'
        });
      }
      
      return res.status(status).json({
        error: 'Odds API error',
        message: errorData?.message || error.message,
        status: status,
        details: 'Check your ODDS_API_KEY and API quota at https://the-odds-api.com/dashboard'
      });
    }
    
    res.status(500).json({
      error: 'Failed to fetch odds',
      message: error.message,
      details: 'Network error or API unavailable. Check your internet connection and API key configuration.'
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
