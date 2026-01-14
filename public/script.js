const API_URL = '/api/leaderboard';

// Global state
let allPlayersData = null;
let tiersData = null;
let currentUser = null;

// DOM element references (will be set in DOMContentLoaded)
let loginPage, mainApp, loginForm, signupForm, loginBtn, signupBtn;
let showSignupLink, showLoginLink, loginUsernameInput, signupUsernameInput;
let loginError, signupError, logoutBtn, currentUsernameSpan;
let refreshBtn, loadingDiv, errorDiv, leaderboardBody, lastUpdatedSpan, tournamentInfoDiv;
let teamSelectionForm, submitTeamBtn, teamSelectionMessage, teamSubmittedMessage;
let scoreboardBody, scoreboardContent, noTeamMessage, refreshFromLeaderboardBtn;
let totalScoreElement, scoreboardTitle;

// User Management Functions
function getUsers() {
    const usersJson = localStorage.getItem('users');
    return usersJson ? JSON.parse(usersJson) : {};
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function getCurrentUser() {
    return localStorage.getItem('currentUser');
}

function setCurrentUser(username) {
    if (username) {
        localStorage.setItem('currentUser', username);
    } else {
        localStorage.removeItem('currentUser');
    }
}

function getUserTeam(username) {
    const users = getUsers();
    return users[username]?.team || null;
}

function saveUserTeam(username, team) {
    const users = getUsers();
    if (!users[username]) {
        users[username] = {};
    }
    users[username].team = team;
    users[username].username = username;
    saveUsers(users);
}

function hasUserSubmittedTeam(username) {
    const team = getUserTeam(username);
    return team && Object.keys(team).length > 0;
}

// Authentication Functions
function showLogin() {
    if (loginForm) loginForm.classList.remove('hidden');
    if (signupForm) signupForm.classList.add('hidden');
    if (loginError) loginError.classList.add('hidden');
    if (signupError) signupError.classList.add('hidden');
}

function showSignup() {
    if (signupForm) signupForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (loginError) loginError.classList.add('hidden');
    if (signupError) signupError.classList.add('hidden');
}

function login(username) {
    const users = getUsers();
    if (users[username]) {
        currentUser = username;
        setCurrentUser(username);
        showMainApp();
        return true;
    }
    return false;
}

function signup(username) {
    if (username.length < 3) {
        return { success: false, error: 'Username must be at least 3 characters long' };
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
    }
    
    const users = getUsers();
    if (users[username]) {
        return { success: false, error: 'Username already exists. Please login instead.' };
    }
    
    users[username] = { username, team: null };
    saveUsers(users);
    currentUser = username;
    setCurrentUser(username);
    showMainApp();
    return { success: true };
}

function logout() {
    currentUser = null;
    setCurrentUser(null);
    showLoginPage();
}

function showLoginPage() {
    if (loginPage) loginPage.classList.remove('hidden');
    if (mainApp) mainApp.classList.add('hidden');
    if (loginUsernameInput) loginUsernameInput.value = '';
    if (signupUsernameInput) signupUsernameInput.value = '';
    showLogin();
}

function showMainApp() {
    if (loginPage) loginPage.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    if (currentUsernameSpan) currentUsernameSpan.textContent = currentUser;
    loadUserData();
}

// Event Listeners for Auth - wrapped in function to ensure DOM is ready
function setupAuthListeners() {
    console.log('Setting up auth listeners...');
    console.log('loginBtn:', loginBtn);
    console.log('signupBtn:', signupBtn);
    
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Login button clicked');
            const username = loginUsernameInput ? loginUsernameInput.value.trim() : '';
            if (!username) {
                if (loginError) {
                    loginError.textContent = 'Please enter a username';
                    loginError.classList.remove('hidden');
                }
                return;
            }
            
            console.log('Attempting to login:', username);
            if (login(username)) {
                console.log('Login successful');
                // Success - showMainApp is called in login()
            } else {
                console.log('Login failed');
                if (loginError) {
                    loginError.textContent = 'Username not found. Please sign up first.';
                    loginError.classList.remove('hidden');
                }
            }
        });
    } else {
        console.error('loginBtn not found!');
    }
    
    if (signupBtn) {
        signupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Signup button clicked');
            const username = signupUsernameInput ? signupUsernameInput.value.trim() : '';
            if (!username) {
                if (signupError) {
                    signupError.textContent = 'Please enter a username';
                    signupError.classList.remove('hidden');
                }
                return;
            }
            
            console.log('Attempting to signup:', username);
            const result = signup(username);
            if (!result.success) {
                console.log('Signup failed:', result.error);
                if (signupError) {
                    signupError.textContent = result.error;
                    signupError.classList.remove('hidden');
                }
            } else {
                console.log('Signup successful');
            }
        });
    } else {
        console.error('signupBtn not found!');
    }
    
    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSignup();
        });
    }
    
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLogin();
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logout();
        });
    }
    
    // Allow Enter key to submit
    if (loginUsernameInput) {
        loginUsernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && loginBtn) loginBtn.click();
        });
    }
    
    if (signupUsernameInput) {
        signupUsernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && signupBtn) signupBtn.click();
        });
    }
}

// Tab elements - will be queried when needed
let tabButtons = null;
let tabContents = null;

function switchTab(tabName) {
    // Get tab elements if not already cached
    if (!tabButtons) {
        tabButtons = document.querySelectorAll('.tab-btn');
    }
    if (!tabContents) {
        tabContents = document.querySelectorAll('.tab-content');
    }
    
    // Update buttons
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update content
    tabContents.forEach(content => {
        if (content.id === `${tabName}Tab`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    
    // Load team selection if needed
    if (tabName === 'team' && tiersData && currentUser) {
        renderTeamSelection();
    }
    
    // Load scoreboard if needed
    if (tabName === 'scoreboard' && currentUser) {
        loadScoreboard();
    }
}

function loadUserData() {
    if (!currentUser) return;
    
    // Load team selection if needed
    if (document.getElementById('teamTab').classList.contains('active') && tiersData) {
        renderTeamSelection();
    }
    
    // Load scoreboard if needed
    if (document.getElementById('scoreboardTab').classList.contains('active')) {
        loadScoreboard();
    }
}

// Refresh button will be set up in DOMContentLoaded

async function loadLeaderboard() {
    // Show loading state
    loadingDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    refreshBtn.disabled = true;
    
    try {
        // Add timeout to fetch request (45 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log('Request aborted due to timeout');
        }, 45000); // 45 second timeout
        
        const response = await fetch(API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to fetch data');
        }
        
        // Store data globally
        allPlayersData = data;
        tiersData = groupPlayersIntoTiers(data.players);
        
        displayLeaderboard(data);
        updateLastUpdated();
        
        // Auto-sync scores if user has a team and is on scoreboard tab
        if (currentUser && document.getElementById('scoreboardTab').classList.contains('active')) {
            const team = getUserTeam(currentUser);
            if (team) {
                // Update scores from leaderboard
                Object.keys(team).forEach(tierNum => {
                    const teamPlayer = team[tierNum];
                    const leaderboardPlayer = data.players.find(
                        p => p.name.toLowerCase() === teamPlayer.name.toLowerCase()
                    );
                    if (leaderboardPlayer && leaderboardPlayer.score) {
                        teamPlayer.score = leaderboardPlayer.score;
                    }
                });
                saveUserTeam(currentUser, team);
                renderScoreboard(team);
            }
        }
        
        // Update team selection if on that tab
        if (document.getElementById('teamTab').classList.contains('active')) {
            renderTeamSelection();
        }
        
    } catch (error) {
        console.error('Error:', error);
        if (error.name === 'AbortError') {
            showError('Request timed out after 45 seconds. The PGA Tour website may be slow to respond or blocking automated access. Please try again in a moment.');
        } else if (error.message.includes('Failed to fetch')) {
            showError('Could not connect to server. Make sure the server is running on http://localhost:3000');
        } else {
            showError(error.message || 'Failed to load leaderboard data. Please try again.');
        }
    } finally {
        loadingDiv.classList.add('hidden');
        refreshBtn.disabled = false;
    }
}

// Function to parse odds and convert to numeric value for sorting
function parseOdds(oddsStr) {
    if (!oddsStr || oddsStr === 'N/A' || oddsStr === '') {
        return Infinity; // Put players without odds at the end
    }
    
    const odds = oddsStr.trim();
    
    // Handle American odds: +500, -150
    if (odds.startsWith('+')) {
        return parseInt(odds.substring(1));
    } else if (odds.startsWith('-')) {
        return parseInt(odds.substring(1));
    }
    
    // Handle fractional odds: 5/1, 10/1
    if (odds.includes('/')) {
        const parts = odds.split('/');
        if (parts.length === 2) {
            const numerator = parseFloat(parts[0]);
            const denominator = parseFloat(parts[1]);
            if (denominator > 0) {
                return (numerator / denominator) * 100; // Convert to American equivalent
            }
        }
    }
    
    // Handle decimal odds: 5.5, 10.0
    const decimal = parseFloat(odds);
    if (!isNaN(decimal)) {
        return (decimal - 1) * 100; // Convert to American equivalent
    }
    
    return Infinity; // Unknown format
}

// Function to group players into tiers
function groupPlayersIntoTiers(players) {
    // Filter out players without valid odds and sort by odds (lowest = most likely to win)
    const playersWithOdds = players
        .filter(p => p.odds && p.odds !== 'N/A' && p.odds !== '')
        .map(p => ({
            ...p,
            oddsValue: parseOdds(p.odds)
        }))
        .sort((a, b) => a.oddsValue - b.oddsValue);
    
    const playersWithoutOdds = players.filter(p => !p.odds || p.odds === 'N/A' || p.odds === '');
    
    const total = playersWithOdds.length;
    
    // Define tier distribution (fewer in tier 1, more in tier 6)
    // Tier 1: top 5%, Tier 2: next 10%, Tier 3: next 15%, Tier 4: next 20%, Tier 5: next 25%, Tier 6: remaining 25%
    const tierPercentages = [0.05, 0.10, 0.15, 0.20, 0.25, 0.25];
    const tiers = [[], [], [], [], [], []];
    
    let currentIndex = 0;
    
    tierPercentages.forEach((percentage, tierIndex) => {
        const tierSize = Math.max(1, Math.floor(total * percentage)); // At least 1 player per tier
        const endIndex = Math.min(currentIndex + tierSize, total);
        
        for (let i = currentIndex; i < endIndex; i++) {
            tiers[tierIndex].push({
                ...playersWithOdds[i],
                tier: tierIndex + 1
            });
        }
        
        currentIndex = endIndex;
    });
    
    // Add any remaining players to tier 6
    while (currentIndex < total) {
        tiers[5].push({
            ...playersWithOdds[currentIndex],
            tier: 6
        });
        currentIndex++;
    }
    
    // Add players without odds to tier 6
    playersWithoutOdds.forEach(player => {
        tiers[5].push({
            ...player,
            tier: 6,
            oddsValue: Infinity
        });
    });
    
    return tiers;
}

function displayLeaderboard(data) {
    // Update tournament info
    if (data.tournament) {
        tournamentInfoDiv.textContent = `📊 ${data.tournament}`;
    }
    
    // Clear existing content
    leaderboardBody.innerHTML = '';
    
    if (!data.players || data.players.length === 0) {
        leaderboardBody.innerHTML = `
            <tr>
                <td colspan="4" class="no-data">
                    No player data available. The page structure may have changed or data is still loading.
                </td>
            </tr>
        `;
        return;
    }
    
    // Group players into tiers
    const tiers = groupPlayersIntoTiers(data.players);
    
    // Display players by tier
    tiers.forEach((tierPlayers, tierIndex) => {
        if (tierPlayers.length === 0) return;
        
        const tierNumber = tierIndex + 1;
        const tierNames = ['🥇 Tier 1 - Favorites', '🥈 Tier 2 - Strong Contenders', '🥉 Tier 3 - Solid Picks', 
                          '⭐ Tier 4 - Good Value', '💫 Tier 5 - Long Shots', '🎯 Tier 6 - Field'];
        
        // Add tier header
        const tierHeaderRow = document.createElement('tr');
        tierHeaderRow.className = `tier-header tier-${tierNumber}`;
        tierHeaderRow.innerHTML = `
            <td colspan="4" class="tier-header-cell">
                ${tierNames[tierIndex]} (${tierPlayers.length} ${tierPlayers.length === 1 ? 'player' : 'players'})
            </td>
        `;
        leaderboardBody.appendChild(tierHeaderRow);
        
        // Add players in this tier
        tierPlayers.forEach((player) => {
            const row = document.createElement('tr');
            row.className = `tier-${tierNumber}-row`;
            
            const position = player.position || '-';
            const name = player.name || 'Unknown Player';
            const odds = player.odds || 'N/A';
            const score = player.score || '-';
            
            row.innerHTML = `
                <td class="position">${position}</td>
                <td class="player-name">${name}</td>
                <td class="odds">${odds}</td>
                <td class="score">${score}</td>
            `;
            
            leaderboardBody.appendChild(row);
        });
    });
}

function showError(message) {
    errorDiv.textContent = `❌ Error: ${message}`;
    errorDiv.classList.remove('hidden');
}

function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    lastUpdatedSpan.textContent = `Last updated: ${timeString}`;
}

// Team Selection Functions
function renderTeamSelection() {
    if (!tiersData) {
        teamSelectionForm.innerHTML = '<p class="no-data-message">Please load the leaderboard first by clicking "Refresh Data" in the Leaderboard tab.</p>';
        return;
    }
    
    if (!currentUser) {
        teamSelectionForm.innerHTML = '<p class="no-data-message">Please login to select a team.</p>';
        return;
    }
    
    // Check if user already submitted a team
    const existingTeam = getUserTeam(currentUser);
    if (hasUserSubmittedTeam(currentUser)) {
        teamSelectionForm.innerHTML = '<p class="no-data-message">You have already submitted a team. View it in the Scoreboard tab.</p>';
        teamSubmittedMessage.classList.remove('hidden');
        submitTeamBtn.disabled = true;
        return;
    }
    
    teamSubmittedMessage.classList.add('hidden');
    
    const tierNames = ['🥇 Tier 1 - Favorites', '🥈 Tier 2 - Strong Contenders', '🥉 Tier 3 - Solid Picks', 
                      '⭐ Tier 4 - Good Value', '💫 Tier 5 - Long Shots', '🎯 Tier 6 - Field'];
    
    teamSelectionForm.innerHTML = '';
    
    tiersData.forEach((tierPlayers, tierIndex) => {
        const tierDiv = document.createElement('div');
        tierDiv.className = 'tier-selection';
        
        const tierLabel = document.createElement('label');
        tierLabel.className = 'tier-label';
        tierLabel.textContent = tierNames[tierIndex];
        
        const select = document.createElement('select');
        select.className = 'player-select';
        select.id = `tier${tierIndex + 1}Select`;
        select.setAttribute('data-tier', tierIndex + 1);
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Select a player --';
        select.appendChild(defaultOption);
        
        // Add players
        tierPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player.name;
            option.textContent = `${player.name} (${player.odds || 'N/A'})`;
            option.setAttribute('data-odds', player.odds || 'N/A');
            option.setAttribute('data-position', player.position || '');
            select.appendChild(option);
        });
        
        // Set selected value if team exists
        if (existingTeam && existingTeam[tierIndex + 1]) {
            select.value = existingTeam[tierIndex + 1].name;
            select.disabled = true; // Disable if team already submitted
        }
        
        select.addEventListener('change', validateTeamSelection);
        
        tierDiv.appendChild(tierLabel);
        tierDiv.appendChild(select);
        teamSelectionForm.appendChild(tierDiv);
    });
    
    validateTeamSelection();
}

function validateTeamSelection() {
    const selects = document.querySelectorAll('.player-select');
    let allSelected = true;
    
    selects.forEach(select => {
        if (!select.value) {
            allSelected = false;
        }
    });
    
    submitTeamBtn.disabled = !allSelected;
    
    if (allSelected) {
        teamSelectionMessage.textContent = '✅ All tiers selected! Click "Submit Team" to save your team.';
        teamSelectionMessage.className = 'team-message success';
        teamSelectionMessage.classList.remove('hidden');
    } else {
        teamSelectionMessage.textContent = 'Please select a player from each tier.';
        teamSelectionMessage.className = 'team-message info';
        teamSelectionMessage.classList.remove('hidden');
    }
}

// Submit team handler - will be set up in DOMContentLoaded
function setupTeamSubmitHandler() {
    if (submitTeamBtn) {
        submitTeamBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert('Please login first.');
                return;
            }
            
            // Check if user already has a team
            if (hasUserSubmittedTeam(currentUser)) {
                alert('You have already submitted a team. You can only submit one team per tournament.');
                return;
            }
            
            const selects = document.querySelectorAll('.player-select');
            const team = {};
            
            selects.forEach(select => {
                const tier = parseInt(select.getAttribute('data-tier'));
                const selectedOption = select.options[select.selectedIndex];
                
                if (selectedOption.value) {
                    team[tier] = {
                        name: selectedOption.value,
                        odds: selectedOption.getAttribute('data-odds'),
                        position: selectedOption.getAttribute('data-position'),
                        score: '0', // Initialize score
                        tier: tier
                    };
                }
            });
            
            // Save team for current user
            saveUserTeam(currentUser, team);
            
            if (teamSelectionMessage) {
                teamSelectionMessage.textContent = `✅ Team submitted successfully for ${currentUser}! Go to the Scoreboard tab to view your team.`;
                teamSelectionMessage.className = 'team-message success';
                teamSelectionMessage.classList.remove('hidden');
            }
            
            // Disable form
            selects.forEach(select => select.disabled = true);
            submitTeamBtn.disabled = true;
            
            // Switch to scoreboard tab
            setTimeout(() => {
                switchTab('scoreboard');
            }, 1500);
        });
    }
}

// Scoreboard Functions
function loadScoreboard() {
    if (!currentUser) {
        scoreboardContent.classList.add('hidden');
        noTeamMessage.innerHTML = '<p>Please login to view your scoreboard.</p>';
        noTeamMessage.classList.remove('hidden');
        return;
    }
    
    const team = getUserTeam(currentUser);
    
    if (!team || Object.keys(team).length === 0) {
        scoreboardContent.classList.add('hidden');
        noTeamMessage.classList.remove('hidden');
        return;
    }
    
    scoreboardContent.classList.remove('hidden');
    noTeamMessage.classList.add('hidden');
    scoreboardTitle.textContent = `${currentUser}'s Team Scoreboard`;
    
    renderScoreboard(team);
}

function renderScoreboard(team) {
    if (!team || !currentUser) return;
    
    scoreboardBody.innerHTML = '';
    let totalScore = 0;
    
    const tierNames = ['🥇 Tier 1', '🥈 Tier 2', '🥉 Tier 3', '⭐ Tier 4', '💫 Tier 5', '🎯 Tier 6'];
    
    // Sort by tier
    const sortedTiers = Object.keys(team).sort((a, b) => parseInt(a) - parseInt(b));
    
    sortedTiers.forEach(tierNum => {
        const player = team[tierNum];
        const row = document.createElement('tr');
        
        // Get score from leaderboard if available, otherwise use stored score
        let score = parseInt(player.score) || 0;
        if (allPlayersData) {
            const leaderboardPlayer = allPlayersData.players.find(
                p => p.name.toLowerCase() === player.name.toLowerCase()
            );
            if (leaderboardPlayer && leaderboardPlayer.score) {
                score = parseInt(leaderboardPlayer.score) || 0;
                // Update stored score
                player.score = leaderboardPlayer.score;
            }
        }
        
        totalScore += score;
        
        row.innerHTML = `
            <td class="tier-cell">${tierNames[parseInt(tierNum) - 1]}</td>
            <td class="player-name">${player.name}</td>
            <td class="odds">${player.odds || 'N/A'}</td>
            <td class="score-cell">${score}</td>
        `;
        
        scoreboardBody.appendChild(row);
    });
    
    // Save updated scores
    saveUserTeam(currentUser, team);
    totalScoreElement.textContent = totalScore;
}

// Refresh from leaderboard handler - will be set up in DOMContentLoaded
function setupRefreshFromLeaderboardHandler() {
    if (refreshFromLeaderboardBtn) {
        refreshFromLeaderboardBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert('Please login first.');
                return;
            }
            
            const team = getUserTeam(currentUser);
            if (!team || !allPlayersData) {
                alert('Please load the leaderboard first.');
                return;
            }
            
            // Match team players with leaderboard data and update scores
            Object.keys(team).forEach(tierNum => {
                const teamPlayer = team[tierNum];
                const leaderboardPlayer = allPlayersData.players.find(
                    p => p.name.toLowerCase() === teamPlayer.name.toLowerCase()
                );
                
                if (leaderboardPlayer && leaderboardPlayer.score) {
                    teamPlayer.score = leaderboardPlayer.score;
                }
            });
            
            saveUserTeam(currentUser, team);
            renderScoreboard(team);
            
            // Show confirmation
            if (scoreboardContent) {
                const message = document.createElement('div');
                message.className = 'success-message';
                message.textContent = '✅ Scores synced from leaderboard!';
                scoreboardContent.insertBefore(message, scoreboardContent.firstChild);
                setTimeout(() => message.remove(), 2000);
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - initializing...');
    
    // Get all DOM elements
    loginPage = document.getElementById('loginPage');
    mainApp = document.getElementById('mainApp');
    loginForm = document.getElementById('loginForm');
    signupForm = document.getElementById('signupForm');
    loginBtn = document.getElementById('loginBtn');
    signupBtn = document.getElementById('signupBtn');
    showSignupLink = document.getElementById('showSignup');
    showLoginLink = document.getElementById('showLogin');
    loginUsernameInput = document.getElementById('loginUsername');
    signupUsernameInput = document.getElementById('signupUsername');
    loginError = document.getElementById('loginError');
    signupError = document.getElementById('signupError');
    logoutBtn = document.getElementById('logoutBtn');
    currentUsernameSpan = document.getElementById('currentUsername');
    refreshBtn = document.getElementById('refreshBtn');
    loadingDiv = document.getElementById('loading');
    errorDiv = document.getElementById('error');
    leaderboardBody = document.getElementById('leaderboardBody');
    lastUpdatedSpan = document.getElementById('lastUpdated');
    tournamentInfoDiv = document.getElementById('tournamentInfo');
    teamSelectionForm = document.getElementById('teamSelectionForm');
    submitTeamBtn = document.getElementById('submitTeamBtn');
    teamSelectionMessage = document.getElementById('teamSelectionMessage');
    teamSubmittedMessage = document.getElementById('teamSubmittedMessage');
    scoreboardBody = document.getElementById('scoreboardBody');
    scoreboardContent = document.getElementById('scoreboardContent');
    noTeamMessage = document.getElementById('noTeamMessage');
    refreshFromLeaderboardBtn = document.getElementById('refreshFromLeaderboardBtn');
    totalScoreElement = document.getElementById('totalScore');
    scoreboardTitle = document.getElementById('scoreboardTitle');
    
    console.log('Elements loaded:', {
        loginBtn: !!loginBtn,
        signupBtn: !!signupBtn,
        loginPage: !!loginPage,
        mainApp: !!mainApp
    });
    
    // Setup all event listeners
    setupAuthListeners();
    setupTeamSubmitHandler();
    setupRefreshFromLeaderboardHandler();
    
    // Setup refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadLeaderboard();
        });
    }
    
    // Initialize tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    // Check if user is already logged in
    const savedUser = getCurrentUser();
    if (savedUser) {
        currentUser = savedUser;
        showMainApp();
    } else {
        showLoginPage();
    }
});
