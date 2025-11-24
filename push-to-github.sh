#!/bin/bash
# Bash script to push changes to GitHub
# Usage: ./push-to-github.sh "Your commit message"

COMMIT_MESSAGE=${1:-"Update: Auto commit from local changes"}

echo "Checking git status..."
git status

echo ""
echo "Adding all changes..."
git add .

echo "Committing changes..."
git commit -m "$COMMIT_MESSAGE"

echo "Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "Successfully pushed to GitHub!"
else
    echo ""
    echo "Error pushing to GitHub. Please check the error message above."
fi

