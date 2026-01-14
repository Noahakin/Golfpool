const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
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
  let browser = null;
  
  // Set overall timeout for the entire operation
  const overallTimeout = setTimeout(() => {
    console.error('Overall operation timeout - taking too long');
  }, 45000); // 45 seconds total
  
  try {
    const url = req.query.url || 'https://www.pgatour.com/tournaments/2026/sony-open-in-hawaii/R2026006/odds';
    
    console.log(`[${new Date().toLocaleTimeString()}] Starting request...`);
    console.log('Launching browser...');
    
    // Use system Chromium if available (Render), otherwise use Puppeteer's Chrome
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    
    const browserPromise = puppeteer.launch({
      headless: "new",
      executablePath: executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    
    // Add timeout for browser launch
    browser = await Promise.race([
      browserPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Browser launch timeout')), 10000)
      )
    ]);
    
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set a shorter timeout for navigation
    page.setDefaultNavigationTimeout(15000);
    page.setDefaultTimeout(10000);
    
    console.log('Navigating to PGA Tour website...');
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log('Page loaded successfully');
    } catch (navError) {
      console.error('Navigation error:', navError.message);
      throw new Error(`Failed to load page: ${navError.message}`);
    }
    
    // Wait for the leaderboard/odds content to load (shorter wait)
    console.log('Waiting for content to load...');
    await page.waitForTimeout(2000);
    
    console.log('Extracting data...');
    
    // Try to wait for content to load (shorter timeout)
    try {
      await page.waitForSelector('table, [class*="leaderboard"], [class*="odds"], [data-testid*="player"], body', { timeout: 5000 });
      console.log('Page content loaded');
    } catch (e) {
      console.log('Waiting for selectors timed out, proceeding anyway...');
    }
    
    // Debug: Log page title and some content
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        tables: document.querySelectorAll('table').length,
        oddsElements: document.querySelectorAll('[class*="odds"], [class*="Odds"]').length
      };
    });
    console.log('Page info:', pageInfo);
    
    const data = await page.evaluate(() => {
      const players = [];
      
      // Function to clean text
      const cleanText = (text) => text.replace(/\s+/g, ' ').trim();
      
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
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        const headerRow = rows[0];
        let oddsColumnIndex = -1;
        let nameColumnIndex = -1;
        let positionColumnIndex = -1;
        
        // Try to identify column indices from header
        if (headerRow) {
          const headerCells = headerRow.querySelectorAll('th, td');
          headerCells.forEach((cell, idx) => {
            const headerText = cleanText(cell.textContent).toLowerCase();
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
        
        rows.forEach((row, rowIndex) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const rowText = Array.from(cells).map(c => cleanText(c.textContent));
            
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
            cells.forEach((cell, idx) => {
              const text = cleanText(cell.textContent);
              
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
              const rowElement = row;
              // Look for odds in the row or nearby
              const oddsElements = rowElement.querySelectorAll('[class*="odds"], [class*="Odds"], [data-odds], [data-betting]');
              oddsElements.forEach(el => {
                const oddsText = cleanText(el.textContent);
                if (isOdds(oddsText)) {
                  playerData.odds = oddsText;
                }
              });
              
              // Check data attributes
              const dataOdds = rowElement.getAttribute('data-odds') || 
                              rowElement.querySelector('[data-odds]')?.getAttribute('data-odds');
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
      const playerContainers = document.querySelectorAll(
        '[class*="player"], [class*="Player"], [data-testid*="player"], ' +
        '[class*="odds-row"], [class*="betting-row"], li[class*="player"], ' +
        '[class*="betting"], [class*="Betting"]'
      );
      
      // If we have players but missing odds, try to match them
      if (players.length > 0 && players.some(p => !p.odds || p.odds === 'N/A' || p.odds === '')) {
        playerContainers.forEach((container) => {
          const nameEl = container.querySelector('[class*="name"], [class*="Name"], strong, h3, h4, a');
          const oddsEl = container.querySelector('[class*="odds"], [class*="Odds"], [class*="betting"], [class*="Betting"], [data-odds]');
          
          if (nameEl) {
            const name = cleanText(nameEl.textContent);
            // Find matching player and update odds
            const player = players.find(p => p.name && p.name.toLowerCase().includes(name.toLowerCase().substring(0, 10)));
            if (player && (!player.odds || player.odds === 'N/A' || player.odds === '')) {
              if (oddsEl) {
                const oddsText = cleanText(oddsEl.textContent);
                if (isOdds(oddsText)) {
                  player.odds = oddsText;
                }
              }
              // Also check data attributes
              const dataOdds = container.getAttribute('data-odds') || oddsEl?.getAttribute('data-odds');
              if (dataOdds && isOdds(dataOdds)) {
                player.odds = dataOdds;
              }
            }
          }
        });
      }
      
      // If no players found yet, try this strategy
      if (players.length === 0) {
        playerContainers.forEach((container, index) => {
          const nameEl = container.querySelector('[class*="name"], [class*="Name"], strong, h3, h4, a');
          const oddsEl = container.querySelector('[class*="odds"], [class*="Odds"], [class*="betting"], [class*="Betting"], [data-odds]');
          
          if (nameEl) {
            const name = cleanText(nameEl.textContent);
            let odds = 'N/A';
            
            if (oddsEl) {
              const oddsText = cleanText(oddsEl.textContent);
              if (isOdds(oddsText)) {
                odds = oddsText;
              }
            }
            
            // Check data attributes
            const dataOdds = container.getAttribute('data-odds') || oddsEl?.getAttribute('data-odds');
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
        const allElements = document.querySelectorAll('div, span, p, li');
        const potentialPlayers = [];
        
        allElements.forEach(el => {
          const text = cleanText(el.textContent);
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
          const oddsEl = playerEl?.closest('div, tr, li')?.querySelector('[class*="odds"], [class*="betting"]');
          const odds = oddsEl ? cleanText(oddsEl.textContent) : 'N/A';
          
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
        const el = document.querySelector(selector);
        if (el) {
          const text = cleanText(el.textContent);
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
    });
    
    clearTimeout(overallTimeout);
    
    if (browser) {
      await browser.close();
    }
    
    console.log(`[${new Date().toLocaleTimeString()}] Found ${data.players.length} players`);
    res.json(data);
    
  } catch (error) {
    clearTimeout(overallTimeout);
    console.error(`[${new Date().toLocaleTimeString()}] Error fetching leaderboard:`, error.message);
    
    // Make sure browser is closed even on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    // Return error with helpful message
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      message: error.message,
      details: 'The page may be taking too long to load or the structure may have changed. Please try again.',
      tournament: 'Sony Open in Hawaii',
      players: []
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the leaderboard`);
});
