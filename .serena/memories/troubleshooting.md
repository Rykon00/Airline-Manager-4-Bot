# Troubleshooting Guide

## Common Issues and Solutions

### Login Issues

#### "Email or password is incorrect"

**Symptoms**:
- Test fails during login step
- Error message: "Login failed"
- Browser shows login error

**Causes**:
1. Wrong credentials in `.env` (local) or GitHub Secrets (CI)
2. AM4 login page changed
3. Account locked/banned

**Solutions**:
```bash
# 1. Verify credentials locally
cat .env | grep EMAIL
cat .env | grep PASSWORD

# 2. Test manual login
# Open browser and try logging in with same credentials
# If fails → credentials wrong
# If works → selector issue

# 3. Check GitHub Secrets
# Settings → Secrets → Verify EMAIL and PASSWORD values

# 4. Update login selectors if AM4 changed
# Edit utils/00_general.utils.ts login() method
```

#### "Timeout waiting for login"

**Symptoms**:
- Test times out during login
- No error message, just timeout

**Causes**:
- AM4 website slow/down
- Network issues
- Selector changed

**Solutions**:
```typescript
// Increase timeout in login method
await page.waitForSelector('#selector', { timeout: 60000 }); // 60s
```

---

### Price Analytics Issues

#### "No price history available"

**Symptoms**:
- Warning: "📝 Creating new price history file"
- Confidence: 0%
- Recommendations based on simple threshold logic

**Causes**:
- First run (no history yet)
- `data/price-history.json` deleted
- CI artifact not downloaded

**Solutions**:
```bash
# Local: Let bot run multiple times to build history
# Each run adds 1-2 entries
# After 20+ entries (10+ hours), intelligent analysis activates

# CI: Check artifact download step in workflow logs
# Should see: "✅ Price history loaded from previous run"
# If not: Verify workflow YAML artifact download configuration
```

#### "Price data quality low"

**Symptoms**:
- Data quality score <50
- Inconsistent recommendations
- Missing timeslots

**Causes**:
- Bot hasn't run enough times
- Large gaps in schedule (e.g., disabled for days)
- Chart scraping failed

**Solutions**:
```bash
# Check data quality
cat data/price-history.json | jq '.timeslots | length'
# Should have 20+ entries for good quality

# Fill gaps with chart scraping
# Chart scraping runs automatically on first fuel/CO2 popup
# Adds ~96 entries (48 timeslots × 2 types)
```

#### "Chart scraping failed"

**Symptoms**:
- Error: "❌ Failed to scrape fuel chart"
- No external price entries added

**Causes**:
- AM4 changed Highcharts implementation
- Highcharts DOM structure different
- JavaScript disabled

**Solutions**:
```typescript
// Debug chart scraping
// Add logging in extractHighchartsData() method
// utils/01_fuel.utils.ts

// Check if Highcharts exists
const hasHighcharts = await page.evaluate(() => {
  return typeof (window as any).Highcharts !== 'undefined';
});
console.log('Highcharts available:', hasHighcharts);

// Update selectors if structure changed
```

---

### Fleet Management Issues

#### "No planes found"

**Symptoms**:
- `fetchPlanes` returns empty array
- Error: "Found 0 route rows"

**Causes**:
- Selector changed
- No planes in fleet (new account)
- Wrong page loaded

**Solutions**:
```typescript
// Debug selectors
// tests/fetchPlanes.spec.ts

// Take screenshot before scraping
await page.screenshot({ path: 'fleet-page.png' });

// Check row count
const rows = await page.locator('div[id^="routeMainList"]').count();
console.log('Found rows:', rows);

// If 0 rows but planes exist → selector changed
// Update selector in fetchPlanes.utils.ts
```

#### "FleetID extraction failed"

**Symptoms**:
- Warning: "Failed to extract FleetID"
- `started-flights.json` has null/empty IDs

**Causes**:
- URL format changed
- Detail page URL different

**Solutions**:
```typescript
// Debug URL extraction
// utils/04_fleet.utils.ts

const url = await detailLink.getAttribute('href');
console.log('Detail URL:', url);

// Expected format: /route?id=123456
// If different, update regex in extractFleetId()
```

#### "Incremental update fails"

**Symptoms**:
- `updateStartedPlanes` test fails
- Error: "Plane with FleetID not found"

**Causes**:
- `started-flights.json` has wrong IDs
- `planes.json` doesn't have those planes
- FleetID mismatch

**Solutions**:
```bash
# Check started-flights.json
cat started-flights.json | jq '.fleetIds'

# Check planes.json for those IDs
cat data/planes.json | jq '.[] | select(.fleetId == "123456")'

# If not found → full scan needed
npm run test:planes

# Delete started-flights.json to skip update
rm started-flights.json
```

---

### GitHub Actions Issues

#### "Workflow not running on schedule"

**Symptoms**:
- No automatic runs at :01/:31
- Manual runs work fine

**Causes**:
- Workflows disabled
- Repository inactive (no commits for 60 days)
- GitHub Actions load (delays up to 15 min)

**Solutions**:
```yaml
# Check workflow status
# Actions tab → Workflows → Should show "Active"

# Re-enable if needed
# Actions tab → Enable workflow

# For inactive repo: Make a commit to reactivate
git commit --allow-empty -m "Keep workflow active"
git push
```

#### "Artifact download failed"

**Symptoms**:
- Warning: "No artifact found"
- Error in download step

**Causes**:
- First run (no previous artifacts)
- Artifact expired (>90 days)
- Workflow name mismatch

**Solutions**:
```yaml
# Check artifact download config
# .github/workflows/01_airlineManager.yml

# Should have:
if_no_artifact_found: warn  # Don't fail on first run

# Verify workflow name matches
workflow: 01_airlineManager.yml  # Must match filename

# For first run: Ignore warnings, second run will work
```

#### "Test timeout in CI"

**Symptoms**:
- Test passes locally
- Fails in CI with timeout

**Causes**:
- CI network slower than local
- Headless mode differences
- GitHub runner load

**Solutions**:
```typescript
// Increase timeout for CI
test('All Operations', async ({ page }) => {
  test.setTimeout(process.env.CI ? 120000 : 60000); // 2min on CI
  // ...
});

// Add more wait time for CI
if (process.env.CI) {
  await GeneralUtils.sleep(2000);
}
```

#### "Browser installation timeout"

**Symptoms**:
- Step "Install Playwright Browsers" times out
- Error downloading chromium

**Causes**:
- GitHub runner network issues
- Playwright CDN slow

**Solutions**:
```yaml
# Use browser cache (already in workflow)
- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}

# If persistent: Retry workflow manually
```

---

### Data Integrity Issues

#### "Price history corrupted"

**Symptoms**:
- JSON parse error
- Empty file
- Invalid structure

**Causes**:
- File write interrupted
- Disk full
- Concurrent writes

**Solutions**:
```bash
# Validate JSON
cat data/price-history.json | jq .

# If invalid: Delete and rebuild
rm data/price-history.json

# CI: Delete artifact and let workflow recreate
# Actions → Select run → Artifacts → Delete price-history
```

#### "Planes data has duplicates"

**Symptoms**:
- Multiple entries with same FleetID
- File size growing unexpectedly

**Causes**:
- Bug in update logic
- Incremental update didn't deduplicate

**Solutions**:
```bash
# Check for duplicates
cat data/planes.json | jq 'group_by(.fleetId) | map(select(length > 1))'

# Fix: Force full scan (replaces file completely)
npm run test:planes

# CI: Trigger workflow with manual dispatch
# Actions → Run workflow (forces full scan)
```

#### "started-flights.json not deleted"

**Symptoms**:
- File persists after incremental update
- Every run tries to update same planes

**Causes**:
- Update test failed before cleanup
- File permissions

**Solutions**:
```bash
# Manual cleanup
rm started-flights.json

# CI: Check logs for update test errors
# Fix root cause, then cleanup happens automatically
```

---

### Performance Issues

#### "fetchPlanes takes too long"

**Symptoms**:
- Test timeout (>180s)
- Stuck on pagination

**Causes**:
- Too many planes
- Detail fetching enabled for all planes
- Network slow

**Solutions**:
```typescript
// Reduce detail fetching
// tests/fetchPlanes.spec.ts:26
const planes = await fetchPlanesUtils.getAllPlanes(-1); // No details

// Or limit to first few
const planes = await fetchPlanesUtils.getAllPlanes(5); // First 5 only
```

#### "Bot run too slow"

**Symptoms**:
- `airlineManager` test takes >60s
- Timeouts

**Causes**:
- Too many sleep() calls
- AM4 website slow
- Network latency

**Solutions**:
```typescript
// Reduce sleep times (carefully!)
await GeneralUtils.sleep(500); // Reduced from 1000

// But ensure stability - too fast may break
// Test multiple times before reducing
```

---

### Selector Issues (AM4 Website Changes)

#### "Element not found"

**Symptoms**:
- Error: "Timeout waiting for selector"
- Error: "Element is not visible"

**Causes**:
- AM4 updated UI
- Selector no longer matches
- Element moved in DOM

**Solutions**:
```typescript
// Debug: Take screenshot
await page.screenshot({ path: 'debug.png' });

// Inspect element in headed mode
npm run test:airline:headed
// Right-click → Inspect

// Update selector
// Old: await page.locator('#oldId').click();
// New: await page.locator('#newId').click();

// Use more resilient selectors
await page.getByRole('button', { name: 'Buy' }); // Text-based
await page.getByText('Total price'); // Content-based
```

---

### Development Issues

#### "TypeScript errors"

**Symptoms**:
- Red squiggles in IDE
- `tsc` command fails

**Causes**:
- Type mismatch
- Missing type definitions
- Wrong TypeScript version

**Solutions**:
```bash
# Check TypeScript version
npx tsc --version

# Reinstall type definitions
npm install @types/node@latest --save-dev

# Clear cache
rm -rf node_modules package-lock.json
npm ci
```

#### "Import errors"

**Symptoms**:
- Cannot find module
- Path resolution fails

**Causes**:
- Wrong import path
- File doesn't exist
- tsconfig misconfigured

**Solutions**:
```typescript
// Use relative paths
import { FuelUtils } from '../utils/01_fuel.utils'; // ✓
// Not absolute paths
import { FuelUtils } from 'utils/01_fuel.utils'; // ✗

// Check tsconfig.json
// Should have: "moduleResolution": "node"
```

---

## Debugging Tools

### Local Debugging

```typescript
// 1. Pause execution
await page.pause(); // Opens Playwright Inspector

// 2. Verbose logging
console.log('Current state:', await page.content());

// 3. Screenshots
await page.screenshot({ path: `debug-${Date.now()}.png` });

// 4. Video recording
// playwright.config.ts
use: {
  video: 'on' // Record all tests
}
```

### CI Debugging

```yaml
# 1. Enable debug logging
- name: Run test
  run: DEBUG=pw:api npx playwright test

# 2. Upload screenshots on failure
- uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: screenshots
    path: test-results/**/*.png

# 3. Upload full test results
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: test-results
    path: test-results/
```

### Data Inspection

```bash
# Pretty-print JSON
cat data/price-history.json | jq .

# Count entries
cat data/price-history.json | jq '.timeslots | length'

# Filter by date
cat data/price-history.json | jq '.timeslots[] | select(.timestamp > "2025-11-01")'

# Check file size
ls -lh data/
```

---

## Getting Help

### Before Asking

1. Check this troubleshooting guide
2. Review error logs carefully
3. Try headed mode locally to see what's happening
4. Search GitHub issues

### When Reporting Issues

Include:
- Error message (full stack trace)
- Console logs
- Screenshots (if relevant)
- Environment (local vs CI, OS, Node version)
- Steps to reproduce

### Contact

- GitHub Issues: https://github.com/YOUR_USERNAME/Airline-Manager-4-Bot/issues
- Discord: `muhittin852` (original author)
