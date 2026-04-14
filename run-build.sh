#!/bin/bash
npx next build > /Users/salahfarhat/Desktop/BudgetPilot_Live/build-output.log 2>&1
echo "EXIT_CODE=$?" >> /Users/salahfarhat/Desktop/BudgetPilot_Live/build-output.log
