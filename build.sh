#!/bin/bash
set -e

# Install Chromium
sudo apt-get update
sudo apt-get install -y chromium-browser

# Install npm dependencies
npm install

echo "Build complete"
