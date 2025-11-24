# PowerShell script to push changes to GitHub
# Usage: .\push-to-github.ps1 "Your commit message"

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Update: Auto commit from local changes"
)

Write-Host "Checking git status..." -ForegroundColor Cyan
git status

Write-Host "`nAdding all changes..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m $CommitMessage

Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccessfully pushed to GitHub!" -ForegroundColor Green
} else {
    Write-Host "`nError pushing to GitHub. Please check the error message above." -ForegroundColor Red
}

