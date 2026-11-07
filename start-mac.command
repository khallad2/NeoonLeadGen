#!/bin/bash
cd "$(dirname "$0")"
echo "⚡ Starting NeoonLeadGen ICP Studio..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed. Please install Node.js (v18+) from https://nodejs.org/"
  read -p "Press Enter to exit..."
  exit 1
fi
node server.js --open
