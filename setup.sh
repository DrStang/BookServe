#!/bin/bash

echo "======================================"
echo "  BookServe Setup Script"
echo "======================================"
echo ""
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"

# Download and install Node.js:
nvm install 24

# Verify the Node.js version:
node -v # Should print "v24.11.1".

# Verify npm version:
npm -v # Should print "11.6.2".

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd client
npm install
cd ..

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "WARNING: Please edit .env file and configure your settings!"
    echo "At minimum, change the JWT_SECRET to a secure random string."
fi

# Create data directories
echo "Creating data directories..."
mkdir -p data/books
mkdir -p data/uploads

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file and configure your settings"
echo "2. Configure NZBHydra and SABnzbd (optional)"
echo "3. Start the server:"
echo "   - Development: npm run dev (backend) and npm run client (frontend)"
echo "   - Production: npm run build && npm start"
echo ""
echo "The application will be available at:"
echo "- Frontend: http://localhost:3000 (development)"
echo "- Backend API: http://localhost:5000/api"
echo ""
