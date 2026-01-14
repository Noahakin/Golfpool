module.exports = async (req, res) => {
  console.log('Test endpoint called:', req.method, req.url);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    res.json({
      tournament: 'Sony Open in Hawaii',
      players: [
        { position: '1', name: 'Sample Player 1', odds: '+500', score: '-15' },
        { position: '2', name: 'Sample Player 2', odds: '+600', score: '-14' },
        { position: '3', name: 'Sample Player 3', odds: '+700', score: '-13' }
      ],
      lastUpdated: new Date().toISOString(),
      message: 'Test endpoint is working!'
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: error.message });
  }
};
