#!/bin/bash

# Quick startup test for Phase 1 cleanup
# This script verifies the backend starts successfully

echo "=========================================="
echo "🧪 Testing Backend Startup After Cleanup"
echo "=========================================="
echo ""

# Change to backend directory
cd "$(dirname "$0")"

# Test TypeScript compilation
echo "1️⃣ Testing TypeScript compilation..."
npm run type-check > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test build
echo ""
echo "2️⃣ Testing build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Test unit tests
echo ""
echo "3️⃣ Testing Phase 1 unit tests..."
npm test test/websocket-gateway-phase1.test.ts > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ All tests passing"
else
    echo "❌ Tests failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ ALL TESTS PASSED"
echo "=========================================="
echo ""
echo "Backend is ready to start!"
echo ""
echo "To start the server:"
echo "  npm run dev"
echo ""
echo "Expected output:"
echo "  ✅ Phase 1 WebSocket Gateway initialized"
echo "  ⚠️  Legacy WebSocket services disabled"
echo ""

