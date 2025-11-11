# Smart Fleet Management System

## Overview

The Smart Fleet system is a sophisticated, unified workflow for automated plane departures and flight data collection. It replaces the old "depart all" approach with intelligent, percentage-based limiting and incremental data updates.

**Location**: `utils/fleet/smartFleetUtils.ts` (895 lines, 27 methods)

**Documentation**: `utils/fleet/FLEET_SCRAPING_STRATEGY.md` (comprehensive strategy guide)

## Architecture

### Single Unified Workflow

**Old System** (REMOVED):
```
Bot Run → Depart ALL planes → Write started-flights.json
  ↓
30 min later → updateStartedPlanes.spec.ts → Update only started planes
```

**New System** (CURRENT):
```
Bot Run → Smart Fleet Processing:
  1. Calculate percentage-based limit
  2. Depart top N planes (FIFO)
  3. Scrape ONLY departed planes
  4. Save cache + merged data
  
30 min later → Repeat (incremental updates built-in)
```

**Benefits**:
- Single workflow (no separate update step)
- Incremental scraping built-in
- Percentage-based safety
- Faster execution (skip unchanged data)

### Facade Pattern

**File**: `utils/04_fleet.utils.ts` (25 lines)

**Purpose**: Maintains chronological numbering (00-05) while organizing implementation in subdirectory.

```typescript
// Re-export pattern
export { SmartFleetUtils } from './fleet/smartFleetUtils';
export { FetchPlanesUtils } from './fleet/fetchPlanes.utils';
export { UpdatePlanesUtils } from './fleet/updatePlanes.utils';
export * from './fleet/fleetTypes';
export * from './fleet/timestampUtils';
```

**Usage**:
```typescript
import { SmartFleetUtils } from '../utils/04_fleet.utils';
```

**Benefits**:
- Clean imports (users don't need to know subdirectory structure)
- Maintains numbered sequence (00-05)
- Easy to extend (add new exports)

## Core Classes

### SmartFleetUtils (Main Orchestrator)

**Constructor**:
```typescript
constructor(page: Page, config: Partial<DepartureConfig> = {})
```

**Key Methods**:

| Method | Purpose | Returns |
|--------|---------|---------|
| `navigateToFleetOverview()` | Navigate to Landed tab | void |
| `getFleetSizeAndCalculateLimit()` | Count fleet & calc departures | FleetInfo |
| `processLandedPlanes(max)` | Complete depart + scrape workflow | ProcessResult |
| `saveCache(...)` | Save cache to last-scrape.json | void |
| `savePlanesData(...)` | Merge & save planes.json | void |
| `loadCache()` | Load cache from file | LastScrapeCache |
| `loadPlanesData()` | Load planes from file | PlaneData[] |

**Internal Phases**:
- `departPlanes()` - FIFO departure from Landed tab
- `scrapeDepartedPlanes()` - Switch to Inflight & scrape
- `scrapePanelData()` - Extract panel metrics
- `scrapeDetailPage()` - Extract detail page data
- `scrapeFlightHistoryIncremental()` - Smart flight history scraping

### TimestampUtils (Timestamp Conversion)

**Purpose**: Convert relative timestamps ("6 months ago") to absolute ISO-8601 with precision tracking.

**Key Methods**:

| Method | Purpose | Returns |
|--------|---------|---------|
| `convertRelativeToAbsolute(text)` | Convert "5 hours ago" → ISO-8601 | ConvertedTimestamp |
| `roundToNearestSlot(date)` | Round to 30-min slot | Date |
| `getCurrentTimeSlot()` | Get current 30-min slot | string |
| `isNewer(ts1, ts2)` | Compare timestamps | boolean |
| `generatePlaneHash(...)` | Generate change hash | string |

**Precision Levels**:
```typescript
type PrecisionLevel = 'slot' | 'day' | 'week' | 'month' | 'year';
```

**Rounding Rules**:
- `slot`: Nearest 30-min (:00 or :30)
- `day`: Start of day (00:00)
- `week`: Start of week (Monday 00:00)
- `month`: Start of month (1st, 00:00)
- `year`: Start of year (Jan 1, 00:00)

### FetchPlanesUtils (Full Scan)

**Purpose**: Complete fleet data collection (daily at 3am).

**Usage**:
```typescript
const fetchUtils = new FetchPlanesUtils(page);
const planes = await fetchUtils.getAllPlanes(5);  // First 5 with details
```

**Modes**:
- `-1`: Basic data only (no details, ~20 sec)
- `5`: First 5 with details (default, ~60 sec)
- `0`: ALL planes with details (~120-180 sec)

**When to Use**: Daily full scan (workflow scheduled at 3am UTC)

### UpdatePlanesUtils (DEPRECATED)

**Status**: ⚠️ Still exists but NOT used in workflows

**Purpose**: Was used for incremental updates (replaced by SmartFleetUtils)

**Migration Path**: Will be removed in future cleanup

## Configuration

### DepartureConfig Interface

```typescript
interface DepartureConfig {
  percentage: number;              // e.g., 0.10 for 10%
  minDelay: number;                // Min delay between actions (ms)
  maxDelay: number;                // Max delay between actions (ms)
  mockMode: boolean;               // If true, don't actually depart
  maxDeparturesOverride?: number;  // OVERRIDE: hardcode max departures
}
```

### Defaults (smartFleetUtils.ts:37-43)

```typescript
{
  percentage: 0.10,            // 10% of total fleet
  minDelay: 1000,              // 1 second
  maxDelay: 2000,              // 2 seconds
  mockMode: true,              // SAFE: Mock by default!
  maxDeparturesOverride: undefined
}
```

### Environment Variables (config.ts)

```env
FLEET_PERCENTAGE=0.10
FLEET_MIN_DELAY=1000
FLEET_MAX_DELAY=2000
FLEET_MOCK_MODE=false
MAX_DEPARTURES_OVERRIDE=1        # Global safety limit
```

### The Global Override

**Purpose**: Safety limiter to prevent runaway automation

**Behavior**:
```typescript
const finalMax = config.maxDeparturesOverride ?? calculatedMax;
```

**Example** (100-plane fleet, 10% config):
- Without override: 10 planes (10% × 100)
- With override=1: 1 plane (ALWAYS)
- With override=5: 5 planes (ALWAYS)

**Default**: `1` (ultra-conservative, must explicitly increase)

**Rationale**:
- Prevents accidental mass departures
- Allows safe testing with small batches
- Forces conscious decision to increase throughput

## Execution Flow

### Phase 1: Initial Setup (~1 second)

```typescript
await smartFleetUtils.navigateToFleetOverview();
```

**Actions**:
1. Click "Landed" tab button
2. Verify sidebar is visible
3. Wait for list to load

### Phase 2: Count & Calculate (~1-10 seconds)

```typescript
const {
  totalFleetSize,
  fleetComposition,
  currentLanded,
  maxDepartures
} = await smartFleetUtils.getFleetSizeAndCalculateLimit();
```

**Actions**:
1. **Try cache first** (fast path):
   - Load `data/last-scrape.json`
   - Use cached totalFleetSize
   - Skip expensive counting
2. **Fallback: Count across all tabs** (slow path):
   - Click each tab: Inflight, Landed, Parked, Pending
   - Count planes in each
   - Sum = total fleet size
3. **Count currently landed** (always fresh)
4. **Calculate max departures**:
   ```typescript
   calculated = Math.floor(totalFleetSize × percentage);
   actual = Math.min(calculated, currentLanded);
   final = maxDeparturesOverride ?? actual;
   ```

**Performance**:
- With cache: ~1 second
- Without cache: ~10 seconds (first run only)

### Phase 3: Depart & Scrape (~20-50 seconds for 5 planes)

```typescript
const {
  processedCount,
  departedCount,
  planesData
} = await smartFleetUtils.processLandedPlanes(maxDepartures);
```

#### Phase 3A: Depart Planes (FIFO)

**Strategy**: Always depart the TOP plane from the list

**Loop**:
```typescript
while (departedCount < maxDepartures) {
  // ALWAYS index 0 (top plane)
  const row = landedRows.nth(0);
  
  // Extract Fleet ID
  const fleetId = row.getAttribute('id').replace('flightStatus', '');
  
  // Depart
  await row.click();
  await departButton.click();
  
  // Track
  departedFleetIds.push(fleetId);
  
  // Return to list
  await returnToListAfterDeparture();
}
```

**Why FIFO Works**:
- After each departure, plane disappears
- Next plane becomes index 0 automatically
- Natural queue behavior
- Fair rotation of all planes

**Duration**: ~2 seconds per departure

#### Phase 3B: Scrape Departed Planes

**Strategy**: Switch to Inflight tab, scrape ONLY departed planes

**Steps**:
1. Switch to Inflight tab
2. For each departed Fleet ID:
   - Find plane in Inflight list
   - Click → Scrape panel data (wear, route)
   - Click "Details" → Scrape full page
   - **Scrape flight history (INCREMENTAL!)**:
     ```typescript
     const lastKnown = cache.planesSnapshot[fleetId]?.lastFlightTimestamp;
     
     for (flight of flightHistory, newest first) {
       if (TimestampUtils.isNewer(flight.timestamp, lastKnown)) {
         newFlights.push(flight);  // NEW
       } else {
         break;  // STOP - reached old data
       }
     }
     ```
   - Close popup
3. Return data array

**Incremental Magic**:
- First scrape: ~20 flights, ~5 seconds
- Next scrape: ~1-2 new flights, ~1 second
- **80-90% speedup!**

**Duration**:
- First run: ~5 seconds/plane
- Incremental: ~1-2 seconds/plane

### Phase 4: Save Data (~1 second)

```typescript
smartFleetUtils.saveCache(totalFleetSize, fleetComposition, planesData);
smartFleetUtils.savePlanesData(planesData);
```

#### Save Cache (`data/last-scrape.json`)

**Structure**:
```json
{
  "lastRunTimestamp": "2025-01-05T14:30:00.000Z",
  "totalFleetSize": 100,
  "departurePercentage": 0.10,
  "fleetComposition": {
    "inflight": 25,
    "landed": 60,
    "parked": 10,
    "pending": 5
  },
  "planesSnapshot": {
    "105960065": {
      "registration": "LU-002-2",
      "lastFlightTimestamp": "2025-01-05T12:30:00.000Z",
      "lastFlightRoute": "ELQ-FRA",
      "totalFlights": 5,
      "hash": "a1b2c3d4..."
    }
  }
}
```

**Purpose**:
- Avoid re-counting fleet (saves 10 seconds)
- Track last known flight per plane (enables incremental scraping)
- Detect changes via hash (future optimization)

#### Save Planes Data (`data/planes.json`)

**Merge Logic**:
```typescript
for (newPlane of planesData) {
  existingIndex = planes.findIndex(p => p.fleetId === newPlane.fleetId);
  
  if (existingIndex >= 0) {
    // MERGE flights
    oldFlights = planes[existingIndex].flightHistory;
    newFlights = newPlane.flightHistory;
    
    // Combine & deduplicate by timestamp
    allFlights = [...newFlights, ...oldFlights];
    uniqueFlights = deduplicateByTimestamp(allFlights);
    
    // Sort descending (newest first)
    uniqueFlights.sort((a, b) => b.timestamp - a.timestamp);
    
    // Update
    planes[existingIndex].flightHistory = uniqueFlights;
  } else {
    // NEW plane
    planes.push(newPlane);
  }
}
```

**Key Features**:
- Merges new data with existing
- Deduplicates by timestamp (prevents duplicates)
- Sorts newest-first (consistent ordering)
- Updates metadata (lastScraped, totalFlights)

## Data Files

### Input Files (Optional)

1. **`data/last-scrape.json`**:
   - Cache from previous run
   - Created after first run
   - Enables incremental scraping

2. **`data/planes.json`**:
   - Existing planes data
   - Merged with new scrapes
   - Created after first run

### Output Files

1. **`data/last-scrape.json`**:
   - Updated cache with latest snapshots
   - Used by next run

2. **`data/planes.json`**:
   - Merged planes data (new + old)
   - Deduplicated flight history

### GitHub Actions Artifacts

**Uploaded** (with `if: always()`):
- **smart-fleet-cache** (90 days): `data/last-scrape.json`
- **planes-data** (90 days): `data/planes.json`

**Downloaded** (before each run):
- Previous run's cache and planes data
- Enables persistence across CI runs

## Performance Characteristics

### Typical Execution Times

| Scenario | Duration | Notes |
|----------|----------|-------|
| First run (5 planes) | ~47s | No cache, full scraping |
| Incremental run (5 planes) | ~20s | Cache + incremental scraping |
| First run (1 plane) | ~20s | Testing/safe mode |
| Incremental run (1 plane) | ~8s | Fastest possible |

### Breakdown (5 planes, incremental)

```
Phase 1: Navigate           1s
Phase 2: Count (cached)     1s
Phase 3A: Depart (5×2s)    10s
Phase 3B: Scrape (5×1.5s)   7.5s
Phase 4: Save               0.5s
---
Total:                     20s
```

### Speedup Analysis

**Incremental vs Full Scraping** (per plane):
- Full: ~5 seconds (20 flights)
- Incremental: ~1.5 seconds (1-2 new flights)
- **70% faster**

**With Cache vs Without** (Phase 2):
- Without: ~10 seconds (count all tabs)
- With: ~1 second (load from cache)
- **90% faster**

**Combined Benefit** (5 planes):
- First run: 47 seconds
- Incremental: 20 seconds
- **57% faster**

## Testing

### Development Test

**Location**: `tests/dev/smartFleet.spec.ts`

**Purpose**: Isolated testing with controlled departures

**Config Override**:
```typescript
const testConfig = {
  ...BOT_CONFIG.fleet,
  maxDeparturesOverride: 1  // ALWAYS depart exactly 1 plane
};
```

**Run**:
```bash
npm run test:smartFleet:headed
```

**Duration**: ~10 seconds

### Production Integration

**Location**: `tests/airlineManager.spec.ts`

**Config**: Uses `BOT_CONFIG.fleet` from environment

**Default**: `maxDeparturesOverride = 1` (safe)

**Schedule**: Every 30 minutes (:01 and :31)

**Run**:
```bash
npm run test:airline:headed
```

**Duration**: ~30-40 seconds (includes fuel, campaigns, maintenance)

## Safety Features

### 1. Global Departure Limit

**Default**: 1 plane per run

**Override Required**: Must explicitly set `MAX_DEPARTURES_OVERRIDE` to increase

**Prevents**: Accidental mass departures

### 2. Mock Mode by Default

**Default**: `mockMode: true` (no actual departures)

**Override Required**: Must set `FLEET_MOCK_MODE=false` in production

**Prevents**: Accidental departures during development

### 3. FIFO Fairness

**Benefit**: All planes get equal flight time (no starvation)

**Mechanism**: Always depart top plane (natural rotation)

### 4. Incremental Scraping

**Benefit**: Reduces load on AM4 servers (fewer requests)

**Mechanism**: Stop scraping when reaching known data

### 5. Change Detection (Future)

**Hash-Based**: Detect if plane data changed

**Skip Scraping**: If hash unchanged, skip detail page navigation

**Benefit**: 50% further speedup

## Common Operations

### Increase Departure Limit

**Local** (`.env`):
```env
MAX_DEPARTURES_OVERRIDE=5
```

**CI** (GitHub Variables):
```
Settings → Variables → MAX_DEPARTURES_OVERRIDE = 5
```

### Disable Mock Mode

**Local** (`.env`):
```env
FLEET_MOCK_MODE=false
```

**CI** (GitHub Variables):
```
Settings → Variables → FLEET_MOCK_MODE = false
```

### Adjust Percentage

**Local** (`.env`):
```env
FLEET_PERCENTAGE=0.25  # 25% of fleet
```

**CI** (GitHub Variables):
```
Settings → Variables → FLEET_PERCENTAGE = 0.25
```

## Troubleshooting

### "No planes departed"

**Cause**: Either no landed planes OR `mockMode=true`

**Solution**:
1. Check if planes are actually landed
2. Verify `FLEET_MOCK_MODE=false` in production

### "Scraping taking too long"

**Cause**: Cache missing OR first run

**Solution**:
1. Verify `data/last-scrape.json` exists
2. First run will always be slow (~47s)
3. Subsequent runs should be faster (~20s)

### "Departed wrong number of planes"

**Cause**: `maxDeparturesOverride` active

**Solution**:
1. Check `MAX_DEPARTURES_OVERRIDE` value
2. Remove override to use percentage calculation
3. Remember: Default is 1 plane per run

### "Flight history duplicates"

**Cause**: Merge logic failed OR timestamp inconsistency

**Solution**:
1. Check `savePlanesData()` deduplication logic
2. Verify timestamps are ISO-8601 format
3. Delete `data/planes.json` to reset (caution: loses history)

## Migration from Old System

### What Was Removed

- ❌ `tests/updateStartedPlanes.spec.ts` - Separate update workflow
- ❌ `started-flights.json` - Temporary tracking file
- ❌ "Depart all" logic - No percentage limiting
- ❌ Separate incremental update step

### What Was Added

- ✅ `utils/fleet/smartFleetUtils.ts` - Unified workflow
- ✅ `utils/fleet/timestampUtils.ts` - Timestamp conversion
- ✅ `utils/fleet/fleetTypes.ts` - TypeScript interfaces
- ✅ `data/last-scrape.json` - Persistent cache
- ✅ FIFO departure strategy
- ✅ Incremental scraping built-in
- ✅ Percentage-based limiting
- ✅ Global safety override

### Why Better

1. **Simpler**: 1 workflow instead of 2
2. **Faster**: Incremental scraping built-in (57% faster)
3. **Safer**: Percentage limiting + global override
4. **Smarter**: Cache-based optimization
5. **Maintainable**: Single source of truth

## Future Enhancements

### 1. Parallel Scraping

**Current**: Sequential scraping (one plane at a time)

**Future**: Parallel scraping (multiple planes simultaneously)

**Challenge**: AM4 rate limiting

### 2. Hash-Based Skip

**Current**: Always scrape detail page

**Future**: Skip if hash unchanged (no new flights)

**Benefit**: 50% further speedup

### 3. Dynamic Percentage

**Current**: Fixed percentage (e.g., 10%)

**Future**: Adjust based on time of day, fuel, routes

**Benefit**: Optimized throughput

### 4. Route Optimization

**Current**: Depart planes as-is

**Future**: Analyze profitability, suggest route changes

**Benefit**: Increased revenue

### 5. Predictive Maintenance

**Current**: React to maintenance needs

**Future**: Predict A-Check timing, schedule proactively

**Benefit**: Minimize downtime
