# Testing Guide

## Test Philosophy

**E2E Only**: This project uses **exclusively end-to-end tests** with Playwright.
- No unit tests
- No mocking
- Real browser automation
- Tests interact with actual AM4 website

**Rationale**: The bot's value is in real-world integration, not isolated logic.

## Test Configuration

**File**: `playwright.config.ts`

### Key Settings

```typescript
{
  testDir: './tests',
  fullyParallel: true,           // Tests can run in parallel
  forbidOnly: !!process.env.CI,  // Prevent accidental .only in CI
  retries: 0,                     // No retries (on CI or local)
  workers: process.env.CI ? 1 : undefined,  // Sequential on CI
  reporter: 'html',               // HTML report locally
  use: {
    trace: 'on-first-retry',      // Trace viewer on retry
    screenshot: 'only-on-failure' // Screenshots on failure
  }
}
```

### Browser
- **Chromium only**: Desktop Chrome device emulation
- Headless by default
- `--headed` flag for visible browser

## Test Files

### 1. airlineManager.spec.ts

**Purpose**: Main bot workflow (every 30 min)

**Timeout**: 60 seconds

**Test Flow**:
```
Login
  ↓
Fuel Section
  → Buy Fuel (with intelligent analysis)
  → Buy CO2 (with intelligent analysis)
  ↓
Campaign Section
  → Check/Create Eco-Friendly Campaign
  → Check/Create Reputation Campaign
  ↓
Maintenance Section
  → Check Planes
  → Repair Planes
  ↓
Fleet Section
  → Depart All Ready Planes
  ↓
Close
```

**Data Modified**:
- `data/price-history.json` (appended with new prices)
- `started-flights.json` (created if flights started)

**Run Commands**:
```bash
# Headless
npm run test:airline

# With browser
npm run test:airline:headed

# Via script (recommended)
.\scripts\run-local-workflow.ps1
# Select option 1 (Airline Manager Bot)
```

### 2. fetchPlanes.spec.ts

**Purpose**: Full fleet data collection (daily at 3am)

**Timeout**: 180 seconds (3 minutes)

**Test Flow**:
```
Login
  ↓
Navigate to Fleet
  ↓
Fetch All Planes
  → Iterate pagination
  → Extract basic data
  → (Optional) Fetch details for N planes
  ↓
Write to data/planes.json
  ↓
Close
```

**Configuration**:
```typescript
// Line 26 in tests/fetchPlanes.spec.ts
const planes = await fetchPlanesUtils.getAllPlanes(5);
```

**Options**:
- `5` (default): First 5 planes with details + flight history (~1 min)
- `0`: ALL planes with details (~2-3 min for 100+ planes)
- `-1`: Basic data only, no details (~20 sec)

**Data Modified**:
- `data/planes.json` (completely replaced)

**Run Commands**:
```bash
# Headless
npm run test:planes

# With browser
npm run test:planes:headed

# Via script
.\scripts\run-local-workflow.ps1
# Select option 2 (Fetch Planes Data)
```

### 3. updateStartedPlanes.spec.ts

**Purpose**: Incremental plane updates (every 30 min, after bot run)

**Timeout**: Default (30 seconds)

**Test Flow**:
```
Check started-flights.json exists
  ↓ (if not exists) → Skip test
  ↓
Read FleetIDs
  ↓
Login
  ↓
For each FleetID:
  → Navigate to detail page
  → Scrape updated flight data
  → Update planes.json entry
  ↓
Save planes.json
  ↓
Delete started-flights.json
  ↓
Close
```

**Data Modified**:
- `data/planes.json` (updated entries for started planes)
- `started-flights.json` (deleted)

**Prerequisites**:
- `started-flights.json` must exist (created by `departPlanes()`)

**Run Commands**:
```bash
# Direct execution
npx playwright test tests/updateStartedPlanes.spec.ts --reporter=list
```

## Local Testing Setup

### 1. Environment Configuration

Create `.env` file in project root:
```env
EMAIL=your-email@example.com
PASSWORD=your-password
MAX_FUEL_PRICE=550
MAX_CO2_PRICE=120
```

### 2. Install Dependencies

```bash
npm ci
npm run install:browsers
```

**What gets installed**:
- Node modules (Playwright, TypeScript, etc.)
- Chromium browser (~300MB)
- System dependencies for Chromium

### 3. Run Tests

**Option A: NPM Scripts**
```bash
npm run test:airline         # Bot (headless)
npm run test:airline:headed  # Bot (with browser)
npm run test:planes          # Planes (headless)
npm run test:planes:headed   # Planes (with browser)
npm test                     # All tests
```

**Option B: PowerShell Script (Recommended)**
```powershell
.\scripts\run-local-workflow.ps1

# Options:
.\scripts\run-local-workflow.ps1           # Headless
.\scripts\run-local-workflow.ps1 --headed  # With visible browser
```

**Script Features**:
- Interactive menu
- Auto-installs dependencies if missing
- Auto-installs browsers if missing
- Handles git operations for fetchPlanes

## Test Output

### Console Output

Look for emoji markers:
- 🔄 Operation starting
- ✅ Success
- ❌ Error
- 📊 Statistics/analytics
- 🎯 Intelligent decision
- 🚨 Emergency action
- ⏸️ Skipped/waiting
- 💾 Data saved
- 📝 New data created
- 🟢 Buy recommendation
- 🟡 Wait recommendation
- 🔴 Emergency recommendation

### Artifacts

**Price History** (`data/price-history.json`):
```json
{
  "timeslots": [
    {
      "timestamp": "2025-11-04T10:00:00.000Z",
      "fuel": 545,
      "co2": 118
    }
  ],
  "lastUpdated": "2025-11-04T10:01:23.456Z"
}
```

**Planes Data** (`data/planes.json`):
```json
[
  {
    "fleetId": "105960065",
    "registration": "LU-002-2",
    "aircraftType": "Airbus A380-800",
    "flightHistory": [
      {
        "route": "ELQ-FRA",
        "revenueUSD": 105176
      }
    ]
  }
]
```

**Started Flights** (`started-flights.json`):
```json
{
  "fleetIds": ["105960065", "105960123", "105960456"]
}
```

## Debugging

### Enable Headed Mode

Always use `--headed` flag when debugging:
```bash
npm run test:airline:headed
```

### Playwright Inspector

Add breakpoint in test:
```typescript
await page.pause();  // Opens Playwright Inspector
```

### Screenshots

On test failure, screenshots are automatically saved to:
```
test-results/
  <test-name>/
    test-failed-1.png
```

### Traces

Enable trace recording:
```typescript
// playwright.config.ts
use: {
  trace: 'on'  // Always record trace
}
```

View trace:
```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

### Verbose Logging

Add console.log statements:
```typescript
console.log('Current price:', price);
console.log('Should buy:', analysis.shouldBuy);
```

## Test Data Management

### Reset Price History

Delete file to start fresh:
```bash
rm data/price-history.json
```

Next run will create new file with empty history.

### Reset Planes Data

Delete file to force full scan:
```bash
rm data/planes.json
```

Next `fetchPlanes` run will create new file.

### Clear Started Flights

Normally auto-deleted after incremental update. Manual cleanup:
```bash
rm started-flights.json
```

## CI/CD Testing

### GitHub Actions Environment

**Differences from Local**:
- Headless only (no display)
- Ubuntu 22.04 (vs. Windows/Mac locally)
- Fresh VM each run (no cached data except artifacts)
- Network may be slower
- Scheduled execution (not on-demand)

### Viewing Test Results

1. Go to **Actions** tab in GitHub
2. Select workflow run
3. Click on "test" job
4. Expand steps to see logs

### Downloading Artifacts from CI

1. Workflow run page
2. Scroll to "Artifacts" section
3. Download `price-history`, `planes-data`, or `started-flights`

## Performance Benchmarks

### airlineManager.spec.ts
- **Expected**: 30-45 seconds
- **Operations**: Login, 4 sections, multiple clicks/waits

### fetchPlanes.spec.ts
- **Basic mode** (`-1`): ~20 seconds
- **Default mode** (`5`): ~60 seconds
- **Full mode** (`0` with 100+ planes): ~120-180 seconds

### updateStartedPlanes.spec.ts
- **Expected**: 5-15 seconds per plane
- **Depends on**: Number of FleetIDs in `started-flights.json`

## Best Practices

### DO
- Run headed mode when developing/debugging
- Use console.log liberally for visibility
- Test locally before pushing to CI
- Check data files after runs to verify correctness
- Use PowerShell script for convenience

### DON'T
- Commit `.env` file (git-ignored)
- Run all tests in parallel during development (may conflict)
- Modify Playwright config retries (keep at 0 for predictability)
- Skip error handling (tests should gracefully handle AM4 downtime)
- Hardcode credentials in tests (use env vars)

## Common Test Failures

### "Timeout waiting for element"
**Cause**: AM4 website slow or changed selectors
**Solution**: Increase timeout or update selectors

### "Login failed"
**Cause**: Wrong credentials or AM4 login page changed
**Solution**: Verify `.env` credentials, check login flow

### "Price history not saved"
**Cause**: Permission issue with `data/` directory
**Solution**: Ensure `data/` directory exists and is writable

### "No planes found"
**Cause**: Selectors changed or no planes in fleet
**Solution**: Update selectors in `fetchPlanes.utils.ts`
