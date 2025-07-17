#!/bin/bash

echo "Testing gamepad API mock..."

# Run the gamepad API test first
cd /home/kah211/jaiabot/src/web
echo "1. Running gamepad API verification test..."
npm test -- tests/gamepad-api.test.ts --silent

if [ $? -eq 0 ]; then
    echo "✅ Gamepad API mock test passed!"
    
    echo "2. Running CommandControl test..."
    npm test -- --testPathPattern='CommandControl.test.tsx' --silent
    
    if [ $? -eq 0 ]; then
        echo "✅ CommandControl test passed! Gamepad errors are fixed."
    else
        echo "❌ CommandControl test still failing."
    fi
else
    echo "❌ Gamepad API mock test failed."
fi

echo "Test completed."
