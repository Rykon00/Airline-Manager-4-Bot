#!/usr/bin/env pwsh
# Script to run 01_airlineManager.yml workflow locally using existing .env file

Write-Host "Starting Airline Manager Bot workflow locally..." -ForegroundColor Green

# Check if .env file exists
if (-not (Test-Path -Path ".env")) {
    Write-Host ".env file not found. Please ensure it exists in the root directory." -ForegroundColor Red
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path -Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies." -ForegroundColor Red
        exit 1
    }
}

# Install Playwright browsers if needed
Write-Host "Installing Playwright browsers..." -ForegroundColor Yellow
npx playwright install --with-deps chromium
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install Playwright browsers." -ForegroundColor Red
    exit 1
}

# Run the Airline Manager Bot test
Write-Host "Running Airline Manager Bot..." -ForegroundColor Green
npx playwright test tests/airlineManager.spec.ts --reporter=list
if ($LASTEXITCODE -ne 0) {
    Write-Host "Airline Manager Bot test encountered errors." -ForegroundColor Red
    exit 1
}

Write-Host "Workflow completed successfully." -ForegroundColor Green
