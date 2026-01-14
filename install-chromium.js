// Script to install Chromium if not found
const { execSync } = require('child_process');
const fs = require('fs');

const possiblePaths = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/usr/bin/google-chrome'
];

let found = false;
for (const path of possiblePaths) {
  if (fs.existsSync(path)) {
    console.log(`Chromium found at: ${path}`);
    found = true;
    break;
  }
}

if (!found) {
  console.log('Chromium not found, attempting to install...');
  try {
    execSync('apt-get update && apt-get install -y chromium-browser', { stdio: 'inherit' });
    console.log('Chromium installed successfully');
  } catch (error) {
    console.error('Failed to install Chromium:', error.message);
    console.log('Will try to use Puppeteer\'s bundled Chrome');
  }
}
