# GitHub Actions Workflow Details

## Main Workflow: `01_airlineManager.yml`

**Location**: `.github/workflows/01_airlineManager.yml`

### Trigger Schedule

Uses **two cron schedules**:

```yaml
schedule:
  - cron: "01,31 * * * *"  # Every 30 minutes (bot run)
  - cron: "0 3 * * *"      # Daily at 3am UTC (full scan)
```

**Time Breakdown**:
- **:01 and :31 minutes**: Regular bot operations (Smart Fleet integrated)
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
- Download previous artifacts (price-history, planes-data, smart-fleet-cache)
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
- `FLEET_PERCENTAGE`: Percentage of fleet to depart (e.g., 0.10)
- `FLEET_MIN_DELAY`: Min delay between actions (e.g., 1000ms)
- `FLEET_MAX_DELAY`: Max delay between actions (e.g., 2000ms)
- `FLEET_MOCK_MODE`: Enable/disable real departures (true/false)
- `MAX_DEPARTURES_OVERRIDE`: Global max departures per run (e.g., 1)

#### 2. Test Execution Phase

**Conditional Logic**:

```yaml
# Runs on every 30-minute schedule (NOT at 3am)
- name: Run Airline Manager Bot
  if: github.event.schedule != '0 3 * * *'
  run: npx playwright test tests/airlineManager.spec.ts --reporter=list

# Runs ONLY at 3am OR on manual dispatch
- name: Full plane scan (daily at 3am)
  if: github.event_name == 'workflow_dispatch' || github.event.schedule == '0 3 * * *'
  run: npx playwright test tests/dev/fetchPlanes.spec.ts --reporter=list
```

**Execution Patterns**:

| Time        | Bot Run (airlineManager.spec.ts) | Full Scan (fetchPlanes.spec.ts) |
|-------------|----------------------------------|----------------------------------|
| :01 & :31   | ✅ (Smart Fleet integrated)      | ❌                               |
| 3:00am      | ❌                               | ✅ (Complete refresh)            |
| Manual      | ❌                               | ✅ (On-demand scan)              |

**IMPORTANT CHANGE**: 
- ❌ **REMOVED**: Separate `updateStartedPlanes.spec.ts` workflow
- ✅ **NEW**: Smart Fleet handles incremental updates automatically

#### 3. Artifact Upload Phase

All uploads use `if: always()` to ensure data is saved even on failures.

```yaml
- name: Upload price history as artifact
  retention-days: 90
  path: data/price-history.json

- name: Upload planes data as artifact
  retention-days: 90
  path: data/planes.json

- name: Upload Smart Fleet cache as artifact
  retention-days: 90
  path: data/last-scrape.json
  if-no-files-found: ignore
```

**Retention Strategy**:
- Price history: 90 days (long-term trend analysis)
- Planes data: 90 days (historical fleet records)
- Smart Fleet cache: 90 days (incremental scraping state)

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
MAX_FUEL_PRICE=${{ vars.MAX_FUEL_PRICE || '550' }}
MAX_CO2_PRICE=${{ vars.MAX_CO2_PRICE || '120' }}
FLEET_PERCENTAGE=${{ vars.FLEET_PERCENTAGE || '0.10' }}
FLEET_MIN_DELAY=${{ vars.FLEET_MIN_DELAY || '1000' }}
FLEET_MAX_DELAY=${{ vars.FLEET_MAX_DELAY || '2000' }}
FLEET_MOCK_MODE=${{ vars.FLEET_MOCK_MODE || 'false' }}
MAX_DEPARTURES_OVERRIDE=${{ vars.MAX_DEPARTURES_OVERRIDE || '1' }}
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

---

## Test Execution Details

### airlineManager.spec.ts (Main Bot)

**Location**: `tests/airlineManager.spec.ts`

**Timeout**: 180 seconds (3 minutes for Smart Fleet)

**Operations**:
1. **Login** (GeneralUtils)
2. **Navigate to Fuel section**
3. **Buy fuel** (intelligent analysis with chart scraping)
4. **Buy CO2** (intelligent analysis)
5. **Navigate to Campaign section**
6. **Check/create eco-friendly campaign**
7. **Check/create reputation campaign**
8. **Navigate to Maintenance section**
9. **Check planes for maintenance**
10. **Repair planes if needed**
11. **Smart Fleet Operations** (NEW! Unified workflow):
    - Navigate to Fleet Overview
    - Count & calculate departure limit (percentage-based)
    - Depart top N planes (FIFO strategy)
    - Scrape departed planes (incremental)
    - Save cache and merged data
12. **Close page**

**Output**:
- Updated `data/price-history.json` (new fuel/CO2 entries)
- Updated `data/planes.json` (merged flight data)
- Updated `data/last-scrape.json` (cache with snapshots)

**Execution Time**: ~30-40 seconds (incremental), ~60 seconds (first run)

**Configuration**: Uses `BOT_CONFIG.fleet` from `config.ts` (respects environment variables)

### fetchPlanes.spec.ts (Full Scan)

**Location**: `tests/dev/fetchPlanes.spec.ts` ← **NOTE**: In `dev/` subdirectory!

**Timeout**: 180 seconds (3 minutes)

**Operations**:
1. Login
2. Fetch all planes (default: 5 with details)
3. Write to `data/planes.json` (REPLACES existing file)

**Output**:
- Completely replaced `data/planes.json`

**Configuration** (`tests/dev/fetchPlanes.spec.ts:26`):
```typescript
const planes = await fetchPlanesUtils.getAllPlanes(5);
```

**Change parameter** to adjust detail level:
- `5`: First 5 planes with details (default, ~60s)
- `0`: ALL planes with details (slow, ~120-180s)
- `-1`: No details (fast, ~20s)

**Execution Time**:
- 5 planes: ~60 seconds
- All planes (100+): ~120-180 seconds

### smartFleet.spec.ts (Development Test)

**Location**: `tests/dev/smartFleet.spec.ts`

**Purpose**: Isolated Smart Fleet testing with controlled configuration

**Timeout**: 180 seconds (3 minutes)

**Configuration Override**:
```typescript
const testConfig = {
  ...BOT_CONFIG.fleet,
  maxDeparturesOverride: 1  // ALWAYS depart exactly 1 plane
};
```

**Operations**:
1. Login
2. Navigate to Fleet Overview
3. Count & Calculate (Phase 2)
4. Depart & Scrape (Phase 3) - exactly 1 plane
5. Save cache and data

**Output**: Same as airlineManager.spec.ts (Smart Fleet section)

**Execution Time**: ~10 seconds (predictable, single plane)

**Usage**: Local development and testing

**Run Commands**:
```bash
npm run test:smartFleet          # Headless
npm run test:smartFleet:headed   # With visible browser
```

---

## Workflow Variables vs Secrets

### When to Use Secrets
- Sensitive data (passwords, tokens)
- Not visible in logs
- Encrypted at rest
- Examples: EMAIL, PASSWORD, TELEGRAM_BOT_TOKEN

### When to Use Variables
- Non-sensitive config (price thresholds, percentages)
- Visible in workflow runs
- Easy to change without re-entering
- Examples: MAX_FUEL_PRICE, FLEET_PERCENTAGE, MAX_DEPARTURES_OVERRIDE

---

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
- Symptom: "Test timeout of 180000ms exceeded"
- Cause: AM4 website slow/unavailable OR Smart Fleet processing taking longer
- Solution: Automatic retry on next scheduled run (every 30 min)

### Smart Fleet Not Departing Planes
- Symptom: "Departed: 0 planes"
- Cause 1: `FLEET_MOCK_MODE=true` (mock mode active)
- Cause 2: `MAX_DEPARTURES_OVERRIDE=1` (global limit too low)
- Cause 3: No planes in Landed tab
- Solution: Check configuration and fleet status

---

## Monitoring and Debugging

### View Workflow Runs
**Settings** → **Actions** → Select workflow run

### Check Logs
- Each step has expandable logs
- Look for emoji markers in custom logs (🔄, ✅, ❌, 📊, 🚀, etc.)
- Smart Fleet logs are highly detailed:
  ```
  🚀 Starting Smart Fleet Processing...
  📍 Phase 1: Initial Setup
  📊 Phase 2: Count & Calculate
  ✈️  Departing plane 1/5
  ✅ Departed plane 105960065
  📊 SMART FLEET PROCESSING SUMMARY
  ```

### Download Artifacts
- Workflow run page → "Artifacts" section
- Download files for inspection:
  - `price-history.json` (price analytics data)
  - `planes.json` (complete fleet data)
  - `smart-fleet-cache` (`last-scrape.json` - cache state)

### Screenshots on Failure
Playwright config includes:
```typescript
screenshot: 'only-on-failure'
```
Failed tests will have screenshots in test results.

### Manual Testing
Use `workflow_dispatch` to trigger runs outside schedule:
- **Actions** tab → Select workflow → **Run workflow** button
- Useful for:
  - Testing configuration changes
  - Immediate data refresh
  - Debugging issues

---

## Performance Optimization

### Artifact Caching Strategy

**Price History** (90 days):
- Accumulates over time (~200 entries max)
- Trimmed automatically
- Bootstrap via chart scraping (~96 entries on first run)

**Planes Data** (90 days):
- Grows with fleet size
- One entry per plane
- Merged on each run (deduplication)

**Smart Fleet Cache** (90 days):
- Small file (~20 KB for 100 planes)
- Updated every run
- Critical for performance (avoids re-counting fleet)

### Browser Cache

**Playwright browsers** (~300 MB):
- Cached via `actions/cache@v4`
- Reused across runs (same package-lock.json)
- Saves ~30-60 seconds per run

### Dependency Cache

**node_modules**:
- Not explicitly cached (npm ci is fast enough)
- Could be added for further speedup

---

## Workflow Execution Timelines

### Typical Run (Every 30 Minutes)

```
0:00 - Setup Phase (checkout, download artifacts, install)  ~60s
1:00 - Run airlineManager.spec.ts                           ~40s
  ├─ Login                                                   ~5s
  ├─ Fuel/CO2                                                ~15s
  ├─ Campaigns                                               ~10s
  ├─ Maintenance                                             ~5s
  └─ Smart Fleet                                             ~20s (incremental)
1:40 - Upload Artifacts                                      ~5s
---
Total: ~105 seconds (1 min 45 sec)
```

### Daily Full Scan (3am UTC)

```
0:00 - Setup Phase                                           ~60s
1:00 - Run fetchPlanes.spec.ts (5 planes)                    ~60s
2:00 - Upload Artifacts                                      ~5s
---
Total: ~125 seconds (2 min 5 sec)
```

### First Run (No Cache)

```
0:00 - Setup Phase                                           ~90s (no browser cache)
1:30 - Run airlineManager.spec.ts                            ~70s
  ├─ Smart Fleet (no cache)                                  ~47s (full counting + scraping)
  └─ Other operations                                        ~23s
2:40 - Upload Artifacts                                      ~5s
---
Total: ~165 seconds (2 min 45 sec)
```

---

## Configuration Best Practices

### Development (Local)

**.env**:
```env
EMAIL=your-email@example.com
PASSWORD=your-password
MAX_FUEL_PRICE=550
MAX_CO2_PRICE=120
FLEET_PERCENTAGE=0.10
FLEET_MOCK_MODE=true              # SAFE: Mock by default
MAX_DEPARTURES_OVERRIDE=1         # SAFE: Only 1 plane
```

**Benefits**:
- Safe defaults (mock mode, single plane)
- Can test without real departures
- Quick execution for testing

### Production (GitHub Actions)

**Secrets**:
```
EMAIL → your-email@example.com
PASSWORD → your-password
TELEGRAM_BOT_TOKEN → (optional)
```

**Variables**:
```
MAX_FUEL_PRICE → 550
MAX_CO2_PRICE → 120
FLEET_PERCENTAGE → 0.10
FLEET_MOCK_MODE → false           # ENABLE real departures
MAX_DEPARTURES_OVERRIDE → 5       # Increase for higher throughput
```

**Benefits**:
- Real departures enabled
- Higher throughput (5 planes per run)
- Configurable without code changes

---

## Troubleshooting Checklist

### Workflow Not Running
- [ ] Workflows enabled in repository settings?
- [ ] Cron syntax correct?
- [ ] Repository active (not archived)?

### Authentication Failing
- [ ] EMAIL secret set correctly?
- [ ] PASSWORD secret set correctly?
- [ ] Credentials valid on AM4 website?

### No Planes Departing
- [ ] FLEET_MOCK_MODE = false?
- [ ] MAX_DEPARTURES_OVERRIDE > 0?
- [ ] Planes actually in Landed tab?
- [ ] Check workflow logs for errors

### Artifacts Not Uploading
- [ ] File paths correct?
- [ ] Files created by tests?
- [ ] `if: always()` present in workflow?

### Performance Issues
- [ ] Cache being used (check logs)?
- [ ] Smart Fleet cache exists?
- [ ] Network latency acceptable?
- [ ] AM4 website responsive?

---

## Future Workflow Enhancements

### 1. Parallel Test Execution
**Current**: Sequential test execution
**Future**: Run independent tests in parallel
**Benefit**: 30-40% faster total execution

### 2. Conditional Fleet Operations
**Current**: Always run Smart Fleet
**Future**: Skip if no landed planes (check cache first)
**Benefit**: Save ~20 seconds when nothing to do

### 3. Telegram Notifications
**Current**: No notifications
**Future**: Send summary after each run
**Benefit**: Proactive monitoring without checking logs

### 4. Dynamic Scheduling
**Current**: Fixed 30-minute intervals
**Future**: Adjust based on fuel levels, maintenance needs
**Benefit**: More responsive automation

### 5. Multi-Environment Support
**Current**: Single production environment
**Future**: Separate dev/staging/prod workflows
**Benefit**: Safer testing of changes
