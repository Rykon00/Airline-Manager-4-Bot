# GitHub Actions Workflow Details

## Main Workflow: `01_airlineManager.yml`

**Location**: `.github/workflows/01_airlineManager.yml`

### Trigger Schedule

Uses **two cron schedules**:

```yaml
schedule:
  - cron: "01,31 * * * *"  # Every 30 minutes (bot + incremental update)
  - cron: "0 3 * * *"      # Daily at 3am UTC (full scan)
```

**Time Breakdown**:
- **:01 and :31 minutes**: Regular bot operations + incremental plane updates
- **3:00am daily**: Full plane data collection (slow operation)

**Manual Trigger**: Also supports `workflow_dispatch` for manual runs.

### Job Configuration

```yaml
timeout-minutes: 10
runs-on: ubuntu-22.04
```

- 10-minute timeout prevents hanging
- Uses Ubuntu 22.04 LTS runner

### Execution Flow

#### 1. Setup Phase
```yaml
- Checkout repository
- Create data directory
- Download previous artifacts (price-history, planes-data)
- Verify artifact contents
- Cache Playwright browsers
- Setup Node.js LTS
- Install dependencies (npm ci)
- Install Playwright browsers (chromium only)
- Create .env file from secrets/variables
```

**Secrets Required**:
- `EMAIL`: AM4 login email
- `PASSWORD`: AM4 login password
- `TELEGRAM_BOT_TOKEN`: (optional) For notifications

**Variables Required**:
- `MAX_FUEL_PRICE`: Price threshold (e.g., 550)
- `MAX_CO2_PRICE`: Price threshold (e.g., 120)

#### 2. Test Execution Phase

**Conditional Logic**:

```yaml
# Runs on every 30-minute schedule (NOT at 3am)
- Run Airline Manager Bot
  if: github.event.schedule != '0 3 * * *'
  run: npx playwright test tests/airlineManager.spec.ts

- Update started planes (incremental)
  if: github.event.schedule != '0 3 * * *'
  run: npx playwright test tests/updateStartedPlanes.spec.ts

# Runs ONLY at 3am OR on manual dispatch
- Full plane scan (daily at 3am)
  if: github.event_name == 'workflow_dispatch' || github.event.schedule == '0 3 * * *'
  run: npx playwright test tests/fetchPlanes.spec.ts
```

**Execution Patterns**:

| Time        | Bot Run | Incremental Update | Full Scan |
|-------------|---------|-------------------|-----------|
| :01 & :31   | ✅      | ✅                | ❌        |
| 3:00am      | ❌      | ❌                | ✅        |
| Manual      | ❌      | ❌                | ✅        |

#### 3. Artifact Upload Phase

All uploads use `if: always()` to ensure data is saved even on failures.

```yaml
- Upload price-history
  retention-days: 90
  path: data/price-history.json

- Upload planes-data
  retention-days: 90
  path: data/planes.json

- Upload started-flights (debug)
  retention-days: 7
  path: started-flights.json
  if-no-files-found: ignore
```

**Retention Strategy**:
- Price history & planes: 90 days (long-term data)
- Started flights: 7 days (temporary tracking)

### Artifact Download Logic

Uses `dawidd6/action-download-artifact@v3` with:
```yaml
workflow: 01_airlineManager.yml
if_no_artifact_found: warn  # Don't fail on first run
```

**Bootstrap Behavior**:
- First run: No artifacts exist → warnings logged, empty files created
- Subsequent runs: Previous artifacts downloaded and used

### Environment Variables in .env

Created at runtime from GitHub secrets/variables:
```bash
EMAIL=${{ secrets.EMAIL }}
PASSWORD=${{ secrets.PASSWORD }}
MAX_FUEL_PRICE=${{ vars.MAX_FUEL_PRICE }}
MAX_CO2_PRICE=${{ vars.MAX_CO2_PRICE }}
TELEGRAM_BOT_TOKEN=${{ secrets.TELEGRAM_BOT_TOKEN }}
```

### Browser Caching

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}
```

**Benefits**:
- Faster browser installation (cached across runs)
- Invalidated on dependency changes (package-lock.json hash)

## Test Execution Details

### airlineManager.spec.ts

**Timeout**: 60 seconds
**Operations**:
1. Login
2. Navigate to Fuel section
3. Buy fuel (intelligent analysis)
4. Buy CO2 (intelligent analysis)
5. Navigate to Campaign section
6. Check/create eco-friendly campaign
7. Check/create reputation campaign
8. Navigate to Maintenance section
9. Check planes for maintenance
10. Repair planes if needed
11. Navigate to Fleet section
12. Depart all ready planes
13. Close page

**Output**:
- Updated `data/price-history.json` (new fuel/CO2 entries)
- Created `started-flights.json` (if flights departed)

### updateStartedPlanes.spec.ts

**Timeout**: Default (30 seconds)
**Operations**:
1. Check if `started-flights.json` exists → skip if not
2. Read FleetIDs from file
3. Login
4. Update each plane's data in `data/planes.json`
5. Delete `started-flights.json` on success

**Output**:
- Updated `data/planes.json` (flight data for started planes)

### fetchPlanes.spec.ts

**Timeout**: 180 seconds (3 minutes)
**Operations**:
1. Login
2. Fetch all planes (default: 5 with details)
3. Write to `data/planes.json`

**Output**:
- Completely replaced `data/planes.json`

**Configuration** (`tests/fetchPlanes.spec.ts:26`):
```typescript
const planes = await fetchPlanesUtils.getAllPlanes(5);
```
Change parameter to adjust detail level:
- `5`: First 5 planes with details (default)
- `0`: ALL planes with details (slow)
- `-1`: No details (fast)

## Workflow Variables vs Secrets

### When to Use Secrets
- Sensitive data (passwords, tokens)
- Not visible in logs
- Encrypted at rest

### When to Use Variables
- Non-sensitive config (price thresholds)
- Visible in workflow runs
- Easy to change without re-entering

## Common Issues

### Schedule Timing Variance
- GitHub Actions may delay scheduled runs by 1-15 minutes during high load
- Not guaranteed to run at exact :01/:31
- Solution: Accept variance or use external cron (e.g., cloud functions)

### Artifact Download Failures
- Symptom: "No artifact found" error
- Cause: First run OR artifact expired (>90 days)
- Solution: Workflow handles via `if_no_artifact_found: warn`

### Browser Installation Timeout
- Symptom: Timeout during Playwright install
- Cause: GitHub runner network issues
- Solution: Retry workflow manually

### Test Timeout
- Symptom: "Test timeout of 60000ms exceeded"
- Cause: AM4 website slow/unavailable
- Solution: Automatic retry on next scheduled run (every 30 min)

## Monitoring and Debugging

### View Workflow Runs
**Settings** → **Actions** → Select workflow run

### Check Logs
- Each step has expandable logs
- Look for emoji markers in custom logs (🔄, ✅, ❌, 📊, etc.)

### Download Artifacts
- Workflow run page → "Artifacts" section
- Download price-history.json, planes.json for inspection

### Screenshots on Failure
Playwright config includes:
```typescript
screenshot: 'only-on-failure'
```
Failed tests will have screenshots in test results.

### Manual Testing
Use `workflow_dispatch` to trigger runs outside schedule:
- **Actions** tab → Select workflow → **Run workflow** button
