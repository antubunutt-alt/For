#!/bin/bash
# Quick test script for DarkNet Chat

echo "Testing DarkNet Chat Server..."
echo ""

# Test health endpoint
echo "[1] Testing health endpoint..."
curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || echo "Health check failed"
echo ""

# Test register
echo "[2] Testing registration..."
curl -s -X POST http://localhost:3000/api/register   -H "Content-Type: application/json"   -d '{"username":"testuser","password":"testpass","display_name":"Test User"}' | python3 -m json.tool 2>/dev/null || echo "Register failed"
echo ""

# Test login
echo "[3] Testing login..."
curl -s -X POST http://localhost:3000/api/login   -H "Content-Type: application/json"   -d '{"username":"admin","password":"admin123"}' | python3 -m json.tool 2>/dev/null || echo "Login failed"
echo ""

echo "Tests complete."
