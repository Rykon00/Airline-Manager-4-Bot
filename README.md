# Airline-Manager-4-Bot

This repository contains a bot for Airline Manager 4, built with Playwright and scheduled to run on GitHub Actions. The bot is designed to run every hour at 01 and 31 minutes but the schedule can be changed according to preference.
## Features

### Implemented
- Start an eco-friendly campaign if not already started.
- Buy fuel and CO2 if prices are below specified thresholds.
- Depart all planes.
- Schedule repairs and A-Checks if needed.
- Buy fuel and CO2 at higher prices if supplies are nearly finished.

## Usage Instructions

1. **Fork this repository.**
2. **Set up secrets:**
   - Go to **Settings** > **Actions** > **Secrets and variables**.
   - Create the following repository secrets:
     - `EMAIL`: \<YOUR-EMAIL>
     - `PASSWORD`: \<YOUR-PASSWORD>
3. **Set up variables:**
   - Go to **Settings** > **Actions** > **Variables**.
   - Create the following variables:
     - `MAX_FUEL_PRICE`: 550 (Set your desired price. The bot will buy fuel if the current price is lower.)
     - `MAX_CO2_PRICE`: 120 (Same as fuel.)
4. **Enable workflows:**
   - Go to **Actions** and enable workflows.
5. The workflow will now be triggered twice every hour at 01 and 31 minutes.

## Local Development

### Option 1: Using PowerShell Script (Recommended)
Run the interactive workflow selector:
```powershell
.\scripts\run-local-workflow.ps1           # Headless mode
.\scripts\run-local-workflow.ps1 --headed  # With visible browser
```

The script will:
- Prompt you to select a workflow (Airline Manager Bot or Fetch Planes Data)
- Install dependencies and browsers automatically
- Run the selected test
- Handle git operations for fetchPlanes workflow

### Option 2: Using NPM Scripts
```bash
# Install dependencies
npm ci
npm run install:browsers

# Run tests
npm run test:airline         # Run airline bot (headless)
npm run test:airline:headed  # Run airline bot (with browser)
npm run test:planes          # Run planes fetcher (headless)
npm run test:planes:headed   # Run planes fetcher (with browser)
npm test                     # Run all tests
```

### Prerequisites for Local Testing
1. Create a `.env` file in the root directory:
   ```env
   EMAIL=your-email@example.com
   PASSWORD=your-password
   MAX_FUEL_PRICE=550
   MAX_CO2_PRICE=120
   ```
2. Ensure Node.js LTS is installed

## Project Documentation
- **[CLAUDE.md](CLAUDE.md)**: Comprehensive development documentation, code standards, and architecture guidelines

## Notes
- Trigger times may vary due to heavy loads on GitHub Actions.
- To change the schedule, edit the **cron** expression under **schedule** in `.github/workflows/01_airlineManager.yml`. Use [crontab.guru](https://crontab.guru/) to generate your desired cron expression.
- If you don't want your repo to be public you can clone this project and commit it to your private repo.
- For questions, reach out on Discord: `muhittin852`.