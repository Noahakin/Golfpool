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
    
    // Debug: Save a sample of the HTML to see what we're working with
    const firstTable = $('table').first();
    const sampleHTML = firstTable.html();
    console.log('Sample table HTML (first 500 chars):', sampleHTML ? sampleHTML.substring(0, 500) : 'No tables found');
    
    // Debug: Check what tables we found
    console.log('Total tables found:', $('table').length);
    $('table').each((idx, table) => {
      const $table = $(table);
      const headerText = $table.find('th, thead tr, tr:first-child').text().toLowerCase();
      const firstRowCells = $table.find('tr').first().find('th, td').length;
      console.log(`Table ${idx}: header contains "odds": ${headerText.includes('odds')}, "player": ${headerText.includes('player')}, cells in first row: ${firstRowCells}`);
    });
    
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
      
      // List of common navigation/menu items to exclude
      const excludePatterns = [
        'signature events', 'how it works', 'groupings official', 'waialae country club',
        'how to watch', 'marketing partners', 'payne stewart award', 'fan council',
        'social responsibility', 'fan shop', 'mastercard tickets', 'tournament', 'leaderboard',
        'odds', 'schedule', 'players', 'news', 'video', 'shop', 'tickets', 'mobile app',
        'follow us', 'about', 'contact', 'privacy', 'terms', 'cookie', 'accessibility'
      ];
      
      const isExcludedText = (text) => {
        const lowerText = text.toLowerCase();
        return excludePatterns.some(pattern => lowerText.includes(pattern)) ||
               lowerText.length < 3 ||
               lowerText.length > 50; // Player names are usually 3-50 chars
      };
      
      // Strategy 1: Target the specific odds table structure
      // Find the table that has "Odds" in its header or contains odds data
      const allTables = $('table');
      let oddsTable = null;
      
      // Find the table with "Odds" column header
      allTables.each((idx, table) => {
        const $table = $(table);
        const headerText = $table.find('th, thead tr, tr:first-child').text().toLowerCase();
        if (headerText.includes('odds') && headerText.includes('player')) {
          oddsTable = $table;
          return false; // break
        }
      });
      
      // If not found, try the first table with 6+ columns
      if (!oddsTable) {
        allTables.each((idx, table) => {
          const $table = $(table);
          const firstRow = $table.find('tr').first();
          const cells = firstRow.find('th, td');
          if (cells.length >= 6) {
            oddsTable = $table;
            return false; // break
          }
        });
      }
      
      if (oddsTable) {
        const $table = $(oddsTable);
        const rows = $table.find('tbody tr, tr').not(':first-child'); // Skip header row
        
        console.log(`Found odds table with ${rows.length} rows`);
        
        rows.each((rowIndex, row) => {
          const $row = $(row);
          const cells = $row.find('td');
          
          // Need at least 6 cells for the odds table structure
          if (cells.length >= 6) {
            // Position (cell 0)
            let position = cleanText(cells.eq(0).text());
            if (!position || position === '-' || position === '') {
              position = (players.length + 1).toString();
            }
            
            // Player name (cell 1) - extract from nested elements
            const nameCell = cells.eq(1);
            const nameCellHTML = nameCell.html();
            const nameCellText = cleanText(nameCell.text());
            
            // Debug first few rows
            if (rowIndex < 5) {
              console.log(`\n=== Row ${rowIndex} Debug ===`);
              console.log(`Cell 1 HTML (first 300 chars):`, nameCellHTML ? nameCellHTML.substring(0, 300) : 'empty');
              console.log(`Cell 1 full text:`, nameCellText);
              console.log(`Cell 1 text length:`, nameCellText.length);
            }
            
            let name = '';
            
            // Try to find text that looks like a player name (First Last format)
            // Look in all nested elements
            const allTexts = [];
            nameCell.find('*').each((idx, el) => {
              const text = cleanText($(el).text());
              // Check if it matches player name pattern (2-3 words, capitalized)
              if (text.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) && 
                  text.length > 5 && text.length < 40 &&
                  !text.toLowerCase().includes('favorite') &&
                  !text.match(/^(USA|KOR|JPN|ENG|CAN|FIJ|SCO|COL|AUS|BEL|FRA|NOR|PHI|ARG|IRL|RSA|SWE|MEX|PUR|CHN|GER)$/)) {
                allTexts.push(text);
                if (rowIndex < 5) {
                  console.log(`  Found potential name in nested element: "${text}"`);
                }
              }
            });
            
            // Get the longest matching text (likely the full name)
            if (allTexts.length > 0) {
              name = allTexts.sort((a, b) => b.length - a.length)[0];
              if (rowIndex < 5) {
                console.log(`  Selected name from nested elements: "${name}"`);
              }
            } else {
              // Fallback: get all text and clean it
              name = cleanText(nameCell.text());
              if (rowIndex < 5) {
                console.log(`  No nested name found, using full cell text: "${name}"`);
              }
              // Remove country codes, "Favorite", and other noise
              name = name.replace(/\b(USA|KOR|JPN|ENG|CAN|FIJ|SCO|COL|AUS|BEL|FRA|NOR|PHI|ARG|IRL|RSA|SWE|MEX|PUR|CHN|GER|Favorite|Create|Account|Sign|Up|In|Quick|Links|Weather|Your|Opt|Out|Preference|Signal|Honored|Switch|Label|Search|Icon|Filter|Apply|Cancel|Consent|Leg|Interest|Reject|All|Confirm|My|Choices|Aon|Better|Decisions)\b/gi, '').trim();
              // Extract just the name part (should be 2-3 words)
              const nameParts = name.split(/\s+/).filter(part => 
                part.length > 1 && 
                !part.match(/^[A-Z]{2,3}$/) && // Not country codes
                part.match(/^[A-Z][a-z]+$/) // Proper capitalization
              );
              if (nameParts.length >= 2) {
                name = nameParts.slice(0, 3).join(' '); // Take first 2-3 words
                if (rowIndex < 5) {
                  console.log(`  After filtering, extracted: "${name}"`);
                }
              }
            }
            
            // Score (cell 2) - Total
            const score = cleanText(cells.eq(2).text()) || '-';
            
            // Odds (cell 5) - get button text
            const oddsCell = cells.eq(5);
            const oddsButton = oddsCell.find('button');
            let odds = 'N/A';
            
            if (oddsButton.length > 0) {
              let oddsText = cleanText(oddsButton.text());
              // Remove "Up" or "Down" prefixes
              oddsText = oddsText.replace(/^(Up|Down)\s*/i, '').trim();
              if (isOdds(oddsText)) {
                odds = oddsText;
              }
            } else {
              // Fallback: check cell text
              const oddsText = cleanText(oddsCell.text());
              if (isOdds(oddsText)) {
                odds = oddsText.replace(/^(Up|Down)\s*/i, '').trim();
              }
            }
            
            // Validate and add player - must match player name pattern
            const hasName = !!name;
            const matchesPattern = name && name.match(/^[A-Z][a-z]+ [A-Z][a-z]+/);
            const validLength = name && name.length > 5 && name.length <= 40;
            const notExcluded = name && !isExcludedText(name);
            const notNavigation = name && 
                !name.toLowerCase().includes('advertisement') &&
                !name.toLowerCase().includes('create') &&
                !name.toLowerCase().includes('account') &&
                !name.toLowerCase().includes('sign') &&
                !name.toLowerCase().includes('quick') &&
                !name.toLowerCase().includes('links') &&
                !name.toLowerCase().includes('weather') &&
                !name.toLowerCase().includes('search') &&
                !name.toLowerCase().includes('filter') &&
                !name.toLowerCase().includes('apply') &&
                !name.toLowerCase().includes('cancel') &&
                !name.toLowerCase().includes('consent') &&
                !name.toLowerCase().includes('reject') &&
                !name.toLowerCase().includes('confirm') &&
                !name.toLowerCase().includes('choices') &&
                !name.toLowerCase().includes('aon');
            
            const isValidName = hasName && matchesPattern && validLength && notExcluded && notNavigation;
            
            if (rowIndex < 5) {
              console.log(`  Validation: hasName=${hasName}, matchesPattern=${matchesPattern}, validLength=${validLength}, notExcluded=${notExcluded}, notNavigation=${notNavigation}`);
              console.log(`  Final decision: ${isValidName ? 'ACCEPTED' : 'REJECTED'}`);
            }
            
            if (isValidName) {
              players.push({
                position: position,
                name: name,
                odds: odds,
                score: score
              });
            } else if (rowIndex < 5) {
              console.log(`  REJECTED name: "${name}"`);
            }
          }
        });
        
        console.log(`\n=== Extraction Complete ===`);
        console.log(`Total players extracted: ${players.length}`);
        if (players.length > 0) {
          console.log(`First 3 players:`, players.slice(0, 3).map(p => p.name));
        }
      } else {
        console.log('ERROR: Could not find odds table!');
        console.log('Available tables:', $('table').length);
      }
      
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
            
            if (name && name.length > 1 && !isExcludedText(name)) {
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
          // Must match pattern like "First Last" or "First Middle Last"
          if (text.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) && 
              text.length > 5 && text.length < 50 &&
              !isExcludedText(text) &&
              !text.includes('Tournament') && !text.includes('Open') &&
              !text.includes('Leaderboard') && !text.includes('Odds') &&
              !text.includes('Signature') && !text.includes('How It Works') &&
              !text.includes('Groupings') && !text.includes('Country Club') &&
              !text.includes('Marketing') && !text.includes('Fan') &&
              !text.includes('Shop') && !text.includes('Tickets')) {
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
