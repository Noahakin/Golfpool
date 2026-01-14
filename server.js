const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

// API endpoint to fetch leaderboard and odds
app.get('/api/leaderboard', async (req, res) => {
  try {
    const targetUrl = req.query.url || 'https://www.pgatour.com/tournaments/2026/sony-open-in-hawaii/R2026006/odds';
    
    console.log(`[${new Date().toLocaleTimeString()}] Starting request...`);
    console.log('Fetching page via ScraperAPI...');
    
    // ScraperAPI endpoint - replace YOUR_API_KEY with your actual key (or use env variable)
    // Free tier: 1,000 requests/month
    // Sign up at: https://www.scraperapi.com/
    const apiKey = process.env.SCRAPERAPI_KEY || 'YOUR_API_KEY_HERE';
    
    // Check if API key is set
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      throw new Error('ScraperAPI key not configured. Please set SCRAPERAPI_KEY environment variable in Render. See SCRAPERAPI_SETUP.md for instructions.');
    }
    
    // Use HTTPS for ScraperAPI
    const scraperApiUrl = `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render=true`;
    
    console.log('ScraperAPI URL (key hidden):', scraperApiUrl.replace(apiKey, '***'));
    console.log('API Key length:', apiKey.length);
    
    // Fetch HTML using ScraperAPI
    let response;
    try {
      response = await axios.get(scraperApiUrl, {
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        validateStatus: function (status) {
          return status < 500; // Don't throw on 4xx errors, we'll handle them
        }
      });
      
      // Check for 401 or other auth errors
      if (response.status === 401) {
        console.error('ScraperAPI returned 401 - Authentication failed');
        console.error('Response:', response.data);
        throw new Error('ScraperAPI authentication failed (401). Please verify your API key is correct and active in your ScraperAPI dashboard.');
      }
      
      if (response.status !== 200) {
        console.error(`ScraperAPI returned status ${response.status}`);
        console.error('Response:', response.data);
        throw new Error(`ScraperAPI returned status ${response.status}: ${JSON.stringify(response.data)}`);
      }
      
    } catch (axiosError) {
      if (axiosError.response) {
        // Response was received but status code is not 2xx
        if (axiosError.response.status === 401) {
          throw new Error('ScraperAPI authentication failed (401). Please check your SCRAPERAPI_KEY in Render environment variables. Verify the key is correct at https://www.scraperapi.com/dashboard');
        }
        throw new Error(`ScraperAPI error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
      } else if (axiosError.request) {
        // Request was made but no response received
        throw new Error('ScraperAPI request failed - no response received. Check your internet connection.');
      } else {
        // Error setting up the request
        throw new Error(`ScraperAPI request setup failed: ${axiosError.message}`);
      }
    }
    
    console.log('Page fetched successfully');
    console.log('Parsing HTML...');
    
    // Load HTML into cheerio
    const $ = cheerio.load(response.data);
    
    // Debug: Log page info
    const pageInfo = {
      title: $('title').text(),
      tables: $('table').length,
      oddsElements: $('[class*="odds"], [class*="Odds"]').length
    };
    console.log('Page info:', pageInfo);
    
    // Extract data using cheerio (same logic as before, but adapted for cheerio)
    const extractData = () => {
      const players = [];
      
      // Function to clean text
      const cleanText = (text) => {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').trim();
      };
      
      // Function to detect if text looks like odds
      const isOdds = (text) => {
        if (!text) return false;
        // Match patterns like: +500, -150, +1200, 5/1, 10/1, 15/2, etc.
        return /^[+-]\d+$/.test(text) ||           // +500, -150
               /^\d+\/\d+$/.test(text) ||          // 5/1, 10/1
               /^\d+\.\d+$/.test(text) ||          // 5.5, 10.0
               (text.includes('+') && /\+?\d+/.test(text)) ||  // +500
               (text.includes('-') && /-?\d+/.test(text));      // -150
      };
      
      // Strategy 1: Look for tables with odds/leaderboard data
      const tables = $('table');
      tables.each((tableIndex, table) => {
        const $table = $(table);
        const rows = $table.find('tr');
        const headerRow = rows.first();
        let oddsColumnIndex = -1;
        let nameColumnIndex = -1;
        let positionColumnIndex = -1;
        
        // Try to identify column indices from header
        if (headerRow.length > 0) {
          const headerCells = $(headerRow).find('th, td');
          headerCells.each((idx, cell) => {
            const headerText = cleanText($(cell).text()).toLowerCase();
            if (headerText.includes('odds') || headerText.includes('betting')) {
              oddsColumnIndex = idx;
            }
            if (headerText.includes('player') || headerText.includes('name')) {
              nameColumnIndex = idx;
            }
            if (headerText.includes('position') || headerText.includes('pos') || headerText.includes('rank')) {
              positionColumnIndex = idx;
            }
          });
        }
        
        rows.each((rowIndex, row) => {
          const $row = $(row);
          const cells = $row.find('td');
          if (cells.length >= 2) {
            const rowText = cells.map((idx, cell) => cleanText($(cell).text())).get();
            
            // Skip header rows
            if (rowText.some(text => text.toLowerCase().includes('position') || 
                                   text.toLowerCase().includes('player') ||
                                   text.toLowerCase().includes('odds') ||
                                   text.toLowerCase().includes('rank'))) {
              return;
            }
            
            let playerData = {
              position: '',
              name: '',
              odds: '',
              score: ''
            };
            
            // Try to identify columns using header info or pattern matching
            cells.each((idx, cell) => {
              const text = cleanText($(cell).text());
              
              // Use header info if available
              if (idx === oddsColumnIndex && oddsColumnIndex >= 0) {
                playerData.odds = text || 'N/A';
              } else if (idx === nameColumnIndex && nameColumnIndex >= 0) {
                playerData.name = text;
              } else if (idx === positionColumnIndex && positionColumnIndex >= 0) {
                playerData.position = text;
              }
              // Otherwise, try pattern matching
              else {
                // Position (usually first column, numeric)
                if (idx === 0 && /^\d+$/.test(text)) {
                  playerData.position = text;
                }
                // Odds detection (improved patterns)
                else if (isOdds(text)) {
                  if (!playerData.odds || playerData.odds === 'N/A') {
                    playerData.odds = text;
                  }
                }
                // Score (numeric, could be negative, typically small numbers)
                else if (/^-?\d+$/.test(text) && parseInt(text) < 100 && parseInt(text) > -30) {
                  if (!playerData.score) playerData.score = text;
                }
                // Player name (usually longer text, not numeric, not odds)
                else if (text.length > 2 && 
                         !/^\d+$/.test(text) && 
                         !isOdds(text) &&
                         !text.toLowerCase().includes('position') &&
                         !text.toLowerCase().includes('round') &&
                         !text.toLowerCase().includes('total')) {
                  if (!playerData.name) playerData.name = text;
                }
              }
            });
            
            // Also check for odds in nearby elements or data attributes
            if (playerData.name && !playerData.odds) {
              // Look for odds in the row or nearby
              const oddsElements = $row.find('[class*="odds"], [class*="Odds"], [data-odds], [data-betting]');
              oddsElements.each((idx, el) => {
                const oddsText = cleanText($(el).text());
                if (isOdds(oddsText)) {
                  playerData.odds = oddsText;
                }
              });
              
              // Check data attributes
              const dataOdds = $row.attr('data-odds') || $row.find('[data-odds]').first().attr('data-odds');
              if (dataOdds && isOdds(dataOdds)) {
                playerData.odds = dataOdds;
              }
            }
            
            if (playerData.name && playerData.name.length > 1) {
              if (!playerData.position) playerData.position = (players.length + 1).toString();
              if (!playerData.odds || playerData.odds === '') playerData.odds = 'N/A';
              players.push(playerData);
            }
          }
        });
      });
      
      // Strategy 2: Look for list items or divs with player data (even if we found some players, try to get odds)
      const playerContainers = $(
        '[class*="player"], [class*="Player"], [data-testid*="player"], ' +
        '[class*="odds-row"], [class*="betting-row"], li[class*="player"], ' +
        '[class*="betting"], [class*="Betting"]'
      );
      
      // If we have players but missing odds, try to match them
      if (players.length > 0 && players.some(p => !p.odds || p.odds === 'N/A' || p.odds === '')) {
        playerContainers.each((idx, container) => {
          const $container = $(container);
          const nameEl = $container.find('[class*="name"], [class*="Name"], strong, h3, h4, a').first();
          const oddsEl = $container.find('[class*="odds"], [class*="Odds"], [class*="betting"], [class*="Betting"], [data-odds]').first();
          
          if (nameEl.length > 0) {
            const name = cleanText(nameEl.text());
            // Find matching player and update odds
            const player = players.find(p => p.name && p.name.toLowerCase().includes(name.toLowerCase().substring(0, 10)));
            if (player && (!player.odds || player.odds === 'N/A' || player.odds === '')) {
              if (oddsEl.length > 0) {
                const oddsText = cleanText(oddsEl.text());
                if (isOdds(oddsText)) {
                  player.odds = oddsText;
                }
              }
              // Also check data attributes
              const dataOdds = $container.attr('data-odds') || oddsEl.attr('data-odds');
              if (dataOdds && isOdds(dataOdds)) {
                player.odds = dataOdds;
              }
            }
          }
        });
      }
      
      // If no players found yet, try this strategy
      if (players.length === 0) {
        playerContainers.each((index, container) => {
          const $container = $(container);
          const nameEl = $container.find('[class*="name"], [class*="Name"], strong, h3, h4, a').first();
          const oddsEl = $container.find('[class*="odds"], [class*="Odds"], [class*="betting"], [class*="Betting"], [data-odds]').first();
          
          if (nameEl.length > 0) {
            const name = cleanText(nameEl.text());
            let odds = 'N/A';
            
            if (oddsEl.length > 0) {
              const oddsText = cleanText(oddsEl.text());
              if (isOdds(oddsText)) {
                odds = oddsText;
              }
            }
            
            // Check data attributes
            const dataOdds = $container.attr('data-odds') || oddsEl.attr('data-odds');
            if (dataOdds && isOdds(dataOdds)) {
              odds = dataOdds;
            }
            
            if (name && name.length > 1) {
              players.push({
                position: (index + 1).toString(),
                name: name,
                odds: odds,
                score: ''
              });
            }
          }
        });
      }
      
      // Strategy 3: Look for any structured data with player names
      if (players.length === 0) {
        // Try to find all text that might be player names
        const allElements = $('div, span, p, li');
        const potentialPlayers = [];
        
        allElements.each((idx, el) => {
          const text = cleanText($(el).text());
          // Look for text that might be a player name (2-4 words, capitalized)
          if (text.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) && 
              text.length > 5 && text.length < 50 &&
              !text.includes('Tournament') && !text.includes('Open') &&
              !text.includes('Leaderboard') && !text.includes('Odds')) {
            potentialPlayers.push({
              name: text,
              element: el
            });
          }
        });
        
        // Get unique player names
        const uniqueNames = [...new Set(potentialPlayers.map(p => p.name))];
        uniqueNames.slice(0, 50).forEach((name, idx) => {
          const playerEl = potentialPlayers.find(p => p.name === name)?.element;
          const $playerEl = $(playerEl);
          const oddsEl = $playerEl.closest('div, tr, li').find('[class*="odds"], [class*="betting"]').first();
          const odds = oddsEl.length > 0 ? cleanText(oddsEl.text()) : 'N/A';
          
          players.push({
            position: (idx + 1).toString(),
            name: name,
            odds: odds,
            score: ''
          });
        });
      }
      
      // Get tournament name
      const tournamentSelectors = [
        'h1',
        '[class*="tournament"]',
        '[class*="Tournament"]',
        '[class*="event"]',
        '[class*="Event"]'
      ];
      
      let tournamentName = 'Sony Open in Hawaii';
      for (const selector of tournamentSelectors) {
        const el = $(selector).first();
        if (el.length > 0) {
          const text = cleanText(el.text());
          if (text && text.length > 5 && text.length < 100) {
            tournamentName = text;
            break;
          }
        }
      }
      
      return {
        tournament: tournamentName,
        players: players.slice(0, 100), // Limit to 100 players
        lastUpdated: new Date().toISOString()
      };
    };
    
    const data = extractData();
    
    console.log(`[${new Date().toLocaleTimeString()}] Found ${data.players.length} players`);
    res.json(data);
    
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] Error fetching leaderboard:`, error.message);
    
    // Provide more specific error messages
    let errorDetails = 'The page may be taking too long to load or the structure may have changed. Please try again.';
    if (error.message.includes('ScraperAPI')) {
      errorDetails = error.message + ' See SCRAPERAPI_SETUP.md for setup instructions.';
    } else if (error.response && error.response.status === 401) {
      errorDetails = 'ScraperAPI authentication failed. Please check your SCRAPERAPI_KEY in Render environment variables. Get a free key at https://www.scraperapi.com/';
    }
    
    // Return error with helpful message
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      message: error.message,
      details: errorDetails,
      tournament: 'Sony Open in Hawaii',
      players: []
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the leaderboard`);
});
