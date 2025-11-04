# Suggested Commands

## System Commands (Windows)
The project runs on Windows, use these PowerShell/CMD commands:
- `dir` or `ls` - List directory contents
- `cd <path>` - Change directory
- `type <file>` - Display file contents
- `del <file>` - Delete file
- `mkdir <dir>` - Create directory

## NPM Scripts

### Testing
```bash
npm test                      # Run all Playwright tests
npm run test:airline          # Run airline bot (headless)
npm run test:airline:headed   # Run airline bot (with visible browser)
npm run test:planes           # Run planes fetcher (headless)
npm run test:planes:headed    # Run planes fetcher (with visible browser)
npm run test:headed           # Run all tests with visible browser
```

### Installation
```bash
npm ci                        # Clean install dependencies (CI/production)
npm install                   # Install dependencies (development)
npm run install:browsers      # Install Playwright browsers (Chromium)
```

## PowerShell Scripts

### Local Workflow Execution (Recommended)
```powershell
.\scripts\run-local-workflow.ps1           # Interactive workflow selector (headless)
.\scripts\run-local-workflow.ps1 --headed  # Interactive workflow selector (with browser)
```

Features:
- Interactive menu to select workflow
- Automatic dependency installation
- Browser installation
- Artifact handling simulation

## Playwright Commands

### Direct Test Execution
```bash
npx playwright test                                      # Run all tests
npx playwright test tests/airlineManager.spec.ts        # Run specific test
npx playwright test --headed                            # Show browser
npx playwright test --reporter=list                     # List reporter
npx playwright test --ui                                # UI mode for debugging
```

### Browser Management
```bash
npx playwright install                    # Install all browsers
npx playwright install chromium           # Install Chromium only
npx playwright install --with-deps        # Install with system dependencies
```

## Development Workflow

### First Time Setup
```bash
npm ci
npm run install:browsers
# Create .env file with credentials
.\scripts\run-local-workflow.ps1
```

### Daily Development
```bash
npm run test:airline:headed    # Test main bot with browser visible
npm run test:planes:headed     # Test plane scraper with browser visible
```

## GitHub Actions (Remote Only)
These run automatically on schedule:
- Every 30 minutes at :01 and :31 - Main bot + incremental updates
- Daily at 3am - Full plane scan
- Manual trigger via workflow_dispatch

## Environment Setup
Required `.env` variables:
```env
EMAIL=<game-email>
PASSWORD=<game-password>
MAX_FUEL_PRICE=550
MAX_CO2_PRICE=120
TELEGRAM_BOT_TOKEN=<optional>
```
