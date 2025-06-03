#!/usr/bin/env pwsh
# Script to run workflows locally using existing .env file

# Parse command line arguments
param(
    [switch]$headed = $false
)

# Workflow selection
$workflows = @(
    @{Name = "01_airlineManager"; Display = "Airline Manager Bot"; Test = "airlineManager.spec.ts"},
    @{Name = "02_fetchPlanes"; Display = "Fetch Planes Data"; Test = "fetchPlanes.spec.ts"}
)

# Display workflow options
Write-Host "Available workflows:" -ForegroundColor Cyan
for ($i = 0; $i -lt $workflows.Count; $i++) {
    Write-Host "[$($i+1)] $($workflows[$i].Display)" -ForegroundColor Yellow
}

# Get user selection
$selection = Read-Host "Select a workflow to run (1-$($workflows.Count))"
$index = [int]$selection - 1

# Validate selection
if ($index -lt 0 -or $index -ge $workflows.Count) {
    Write-Host "Invalid selection. Please run the script again and select a number between 1 and $($workflows.Count)." -ForegroundColor Red
    exit 1
}

$selectedWorkflow = $workflows[$index]
Write-Host "Starting $($selectedWorkflow.Display) workflow locally..." -ForegroundColor Green

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

# Run the selected test
Write-Host "Running $($selectedWorkflow.Display)..." -ForegroundColor Green
$command = "npx playwright test tests/$($selectedWorkflow.Test) --reporter=list"

# Add headed mode if requested
if ($headed) {
    $command += " --headed"
    Write-Host "Running in headed mode (browser will be visible)" -ForegroundColor Yellow
}

# Execute the command
Invoke-Expression $command

if ($LASTEXITCODE -ne 0) {
    Write-Host "$($selectedWorkflow.Display) test encountered errors." -ForegroundColor Red
    exit 1
}

# Special handling for fetchPlanes workflow (git operations)
if ($selectedWorkflow.Name -eq "02_fetchPlanes") {
    Write-Host "Checking for changes in planes data..." -ForegroundColor Yellow
    $gitStatus = git status --porcelain planes.json
    
    if ($gitStatus) {
        Write-Host "Changes detected in planes data, committing..." -ForegroundColor Yellow
        git config --global user.name 'Local Script'
        git config --global user.email 'local@example.com'
        git add planes.json
        git commit -m "Update planes data - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        
        $pushConfirmation = Read-Host "Do you want to push changes to remote repository? (y/n)"
        if ($pushConfirmation -eq "y") {
            git push
            Write-Host "Changes pushed to repository." -ForegroundColor Green
        } else {
            Write-Host "Changes committed locally but not pushed." -ForegroundColor Yellow
        }
    } else {
        Write-Host "No changes detected in planes data." -ForegroundColor Green
    }
}

Write-Host "$($selectedWorkflow.Display) workflow completed successfully." -ForegroundColor Green
