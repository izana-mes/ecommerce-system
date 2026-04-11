#!/bin/bash

# Backend and Frontend Startup Script

echo "=========================================="
echo "  Backend Migration - Quick Start"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Install Backend Dependencies${NC}"
echo "Run in Terminal 1:"
echo ""
echo -e "${YELLOW}cd backend${NC}"
echo -e "${YELLOW}npm install${NC}"
echo ""
echo -e "${GREEN}✓ Dependencies will be installed${NC}"
echo ""

echo "=========================================="
echo ""

echo -e "${BLUE}Step 2: Create Backend .env file${NC}"
echo "Create 'backend/.env' with:"
echo ""
cat << 'EOF'
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=mydb
JWT_SECRET=your-super-secret-key-change-this
PORT=3001
NODE_ENV=development
EOF
echo ""
echo -e "${GREEN}✓ Database will auto-create tables${NC}"
echo ""

echo "=========================================="
echo ""

echo -e "${BLUE}Step 3: Create Frontend .env.local file${NC}"
echo "Create 'frontend/.env.local' with:"
echo ""
cat << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001/api
EOF
echo ""

echo "=========================================="
echo ""

echo -e "${BLUE}Step 4: Start Backend${NC}"
echo "In Terminal 1, run:"
echo ""
echo -e "${YELLOW}cd backend${NC}"
echo -e "${YELLOW}npm run start:dev${NC}"
echo ""
echo -e "${GREEN}✓ Backend will start on http://localhost:3001${NC}"
echo ""
echo "Expected output:"
echo "  Backend server running on http://localhost:3001"
echo ""

echo "=========================================="
echo ""

echo -e "${BLUE}Step 5: Start Frontend${NC}"
echo "In Terminal 2, run:"
echo ""
echo -e "${YELLOW}cd frontend${NC}"
echo -e "${YELLOW}npm run dev${NC}"
echo ""
echo -e "${GREEN}✓ Frontend will start on http://localhost:3000${NC}"
echo ""
echo "Expected output:"
echo "  ▲ Next.js - Local: http://localhost:3000"
echo ""

echo "=========================================="
echo ""

echo -e "${BLUE}Step 6: Verify Setup${NC}"
echo "Open browser and:"
echo ""
echo "  1. Go to http://localhost:3000"
echo "  2. Try logging in or adding items to cart"
echo "  3. Open DevTools (F12) → Network tab"
echo "  4. Verify API calls go to http://localhost:3001/api"
echo ""

echo "=========================================="
echo ""

echo -e "${GREEN}Test Commands (in new terminal):${NC}"
echo ""
echo "# Get all products"
echo "curl http://localhost:3001/api/products"
echo ""
echo "# User login"
echo "curl -X POST http://localhost:3001/api/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"user@example.com\",\"password\":\"password123\"}'"
echo ""
echo "# Register new user"
echo "curl -X POST http://localhost:3001/api/auth/register \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\":\"newuser\",\"email\":\"user@example.com\",\"password\":\"password123\"}'"
echo ""

echo "=========================================="
echo ""

echo -e "${GREEN}✅ Migration Complete!${NC}"
echo ""
echo "Documentation:"
echo "  - QUICK_START.md          - Detailed setup guide"
echo "  - BACKEND_MIGRATION.md    - Architecture details"
echo "  - MIGRATION_COMPLETE.md   - Completion summary"
echo ""
echo "Happy coding!"
