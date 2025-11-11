# Smart Fleet Scraping Strategy

## Overview

The Smart Fleet system implements an intelligent, percentage-based departure and scraping strategy that balances automation with safety while minimizing execution time through incremental updates.

## Core Principles

### 1. Fleet-Based Percentage Limiting

**Rationale**: Departure decisions should be based on **total fleet size**, not just currently landed planes.

**Example**:
- Total Fleet: 100 planes
- Percentage: 10%
- Max Departures: 10 planes (regardless of how many are currently landed)

**Why This Matters**:
- Prevents over-automation when many planes land simultaneously
- Provides consistent, predictable behavior
- Allows safe scaling as fleet grows

### 2. FIFO Departure Strategy

**Implementation**: Always depart the **top plane** from the Landed tab list.

**Benefits**:
- Fairest distribution of flight time
- Prevents "starvation" of planes at bottom of list
- Matches natural user behavior
- Simplifies tracking (no complex sorting logic)

**Code Location**: `smartFleetUtils.ts:191-283` (`departPlanes()`)

### 3. Incremental Flight History Scraping

**Problem**: Scraping all 20 flights for every plane on every run is wasteful (30 min intervals).

**Solution**: Track last known flight timestamp per plane, only scrape **new** flights.

**Mechanism**:
```typescript
// Cache structure (last-scrape.json)
{
  planesSnapshot: {
    "105960065": {
      lastFlightTimestamp: "2025-01-05T14:30:00.000Z",
      lastFlightRoute: "ELQ-FRA",
      totalFlights: 5
    }
  }
}

// On next scrape:
// 1. Load cache
// 2. Scrape flights from top of history
// 3. STOP when reaching lastFlightTimestamp
// 4. Only add NEW flights to data
```

**Benefits**:
- Reduces scraping time by 80-90%
- Minimizes duplicate data
- Handles pagination naturally (always scrapes newest flights first)

**Code Location**: `smartFleetUtils.ts:535-633` (`scrapeFlightHistoryIncremental()`)

### 4. Hash-Based Change Detection

**Purpose**: Quickly detect if a plane's data has changed without deep comparison.

**Hash Components**:
- Registration (user can change)
- Last flight timestamp
- Total flight count

**Algorithm**:
```typescript
hash = MD5(registration + lastFlightTimestamp + totalFlights)
```

If hash unchanged → no new flights → skip scraping (future optimization).

**Code Location**: `timestampUtils.ts:170-184` (`generatePlaneHash()`)

## Timestamp Precision Tracking

### Problem

AM4 displays relative timestamps with varying precision:
- "5 hours ago" → precise to ~30 min slot
- "6 days ago" → precise to ~day
- "2 months ago" → precise to ~month

### Solution

**Store TWO pieces of information**:
1. **Absolute timestamp** (ISO-8601) - for sorting and deduplication
2. **Precision level** - for knowing how accurate the timestamp is

**Precision Levels**:
```typescript
type PrecisionLevel = 'slot' | 'day' | 'week' | 'month' | 'year';
```

**Conversion Table**:

| Original Text    | Precision | Rounded To                   | Example Timestamp          |
| ---------------- | --------- | ---------------------------- | -------------------------- |
| "30 minutes ago" | slot      | Nearest 30-min slot          | `2025-01-05T14:30:00.000Z` |
| "5 hours ago"    | slot      | Nearest 30-min slot          | `2025-01-05T09:30:00.000Z` |
| "2 days ago"     | day       | Start of day (00:00)         | `2025-01-03T00:00:00.000Z` |
| "1 week ago"     | week      | Start of week (Monday 00:00) | `2024-12-29T00:00:00.000Z` |
| "3 months ago"   | month     | Start of month               | `2024-10-01T00:00:00.000Z` |
| "1 year ago"     | year      | Start of year                | `2024-01-01T00:00:00.000Z` |

**Code Location**: `timestampUtils.ts:21-101` (`convertRelativeToAbsolute()`)

### Slot-Based Rounding Rules

**Definition**: A "slot" is a 30-minute interval aligned to :00 or :30.

**Rules**:
- Minutes 0-14 → Round to :00
- Minutes 15-44 → Round to :30
- Minutes 45-59 → Round to next hour :00

**Examples**:
```
14:07 → 14:00
14:22 → 14:30
14:51 → 15:00
```

**Why 30-minute slots?**:
- AM4 updates prices every 30 minutes
- Provides good balance between precision and data size
- Aligns with game mechanics
- Natural deduplication boundary

**Code Location**: `timestampUtils.ts:107-126` (`roundToNearestSlot()`)

## Cache Architecture

### Cache File: `data/last-scrape.json`

**Structure**:
```typescript
interface LastScrapeCache {
  lastRunTimestamp: string;        // When cache was last updated
  totalFleetSize: number;          // Total fleet count (saves re-counting)
  departurePercentage: number;     // Config used (for audit)
  fleetComposition: {              // Snapshot of fleet distribution
    inflight: number;
    landed: number;
    parked: number;
    pending: number;
  };
  planesSnapshot: {
    [fleetId: string]: {
      registration: string;
      lastFlightTimestamp: string | null;
      lastFlightRoute: string | null;
      totalFlights: number;
      hash: string;                 // For quick change detection
    }
  }
}
```

**Purpose**:
1. **Avoid re-counting fleet** on every run (expensive operation)
2. **Track last known flight** per plane (enables incremental scraping)
3. **Detect changes** via hash comparison (future optimization)
4. **Audit trail** (what config was used, when)

**Persistence**:
- Uploaded as GitHub Actions artifact (`smart-fleet-cache`, 90-day retention)
- Downloaded before each run
- Updated after each successful scrape

**Code Location**:
- Save: `smartFleetUtils.ts:714-754` (`saveCache()`)
- Load: `smartFleetUtils.ts:759-770` (`loadCache()`)

## Departure Configuration

### Configuration Options

```typescript
interface DepartureConfig {
  percentage: number;              // e.g., 0.10 for 10%
  minDelay: number;                // Min delay between actions (ms)
  maxDelay: number;                // Max delay between actions (ms)
  mockMode: boolean;               // If true, don't actually depart
  maxDeparturesOverride?: number;  // OVERRIDE: hardcode max departures
}
```

**Defaults** (`smartFleetUtils.ts:37-43`):
```typescript
{
  percentage: 0.10,            // 10% of total fleet
  minDelay: 1000,              // 1 second
  maxDelay: 2000,              // 2 seconds
  mockMode: true,              // SAFE: Mock by default!
  maxDeparturesOverride: undefined
}
```

**Environment Variable Overrides** (`config.ts`):
```env
FLEET_PERCENTAGE=0.10
FLEET_MIN_DELAY=1000
FLEET_MAX_DELAY=2000
FLEET_MOCK_MODE=false
MAX_DEPARTURES_OVERRIDE=1
```

### Safety: Global Departure Limit

**The Override**:
```typescript
maxDeparturesOverride: parseInt(process.env.MAX_DEPARTURES_OVERRIDE || '1')
```

**Effect**:
- If set: **ALWAYS** use this value (ignores percentage calculation)
- If unset: Use percentage calculation
- **Default: 1 plane per run** (ultra-conservative)

**Example** (100-plane fleet, 10% config, override = 5):
```
Calculated: 10 planes (10% × 100)
OVERRIDE: 5 planes   ← ACTUALLY USED
```

**Rationale**:
- Prevents runaway automation
- Allows testing with small batches
- Users must explicitly increase for higher throughput
- Safety-first approach

**Code Location**: `smartFleetUtils.ts:390` (`processLandedPlanes()`)

## Execution Phases

### Phase 1: Initial Setup (`navigateToFleetOverview()`)

**Purpose**: Ensure we're on the Landed tab in the fleet sidebar.

**Steps**:
1. Click "Landed" tab button (`#flightStatusLanded`)
2. Wait for tab to activate
3. Verify sidebar is visible (fallback: open Overview first)

**Duration**: ~1 second

**Code**: `smartFleetUtils.ts:49-75`

---

### Phase 2: Count & Calculate (`getFleetSizeAndCalculateLimit()`)

**Purpose**: Determine how many planes to depart based on total fleet size.

**Steps**:
1. **Try loading from cache** (fast path):
   - If cache exists → use totalFleetSize from cache
   - Saves ~10 seconds
2. **Fallback: Count across all tabs** (slow path):
   - Click each tab (Inflight, Landed, Parked, Pending)
   - Count `.flight-list-sorting` elements
   - Sum = total fleet size
3. **Count currently landed planes** (always fresh):
   - Count in Landed tab
4. **Calculate max departures**:
   ```typescript
   maxDepartures = Math.floor(totalFleetSize × percentage)
   actualDepartures = Math.min(maxDepartures, currentLanded)
   ```
5. **Apply override if configured**:
   ```typescript
   finalDepartures = maxDeparturesOverride ?? actualDepartures
   ```

**Duration**:
- With cache: ~1 second
- Without cache: ~10 seconds (first run)

**Code**: `smartFleetUtils.ts:81-134`

---

### Phase 3A: Depart Planes (`departPlanes()`)

**Purpose**: Depart the top N planes from the Landed tab.

**FIFO Strategy**:
```typescript
while (departedCount < maxDepartures) {
  // ALWAYS take the FIRST plane (index 0)
  const row = landedRows.nth(0);

  // Extract Fleet ID
  const fleetId = extractFleetId(row);

  // Click plane → Click "Depart" → Wait
  await row.click();
  await departButton.click();

  // Remember Fleet ID
  departedFleetIds.push(fleetId);

  // Return to list (no popup after departure!)
  await returnToListAfterDeparture();
}
```

**Why ALWAYS index 0?**:
- After each departure, plane disappears from list
- Next plane automatically becomes index 0
- Natural FIFO behavior
- No need to increment index

**Output**: Array of departed Fleet IDs

**Duration**: ~2 seconds per departure (includes random delay)

**Code**: `smartFleetUtils.ts:191-283`

---

### Phase 3B: Scrape Departed Planes (`scrapeDepartedPlanes()`)

**Purpose**: Switch to Inflight tab and scrape data for planes that just departed.

**Steps**:
1. **Switch to Inflight tab**
2. **For each departed Fleet ID**:
   - Find plane by ID in Inflight list
   - Click plane → Scrape sidebar panel data
   - Click "Details" → Scrape full detail page
   - **Scrape flight history (INCREMENTAL!)**:
     ```typescript
     for (each flight in history, newest first) {
       if (flight.timestamp > lastKnownTimestamp) {
         // NEW flight → add to data
       } else {
         // OLD flight → STOP scraping
         break;
       }
     }
     ```
   - Merge panel + detail data
   - Close detail popup
3. **Return scraped data array**

**Incremental Benefit**:
- First run: Scrapes all ~20 flights (~5 seconds)
- Subsequent runs: Scrapes only 1-2 new flights (~1 second)
- **80-90% time savings**

**Duration**:
- ~5 seconds per plane (first scrape)
- ~1-2 seconds per plane (incremental)

**Code**: `smartFleetUtils.ts:288-376`

---

### Phase 4: Save Data

**Purpose**: Persist cache and planes data for next run.

**Saves Two Files**:

1. **Cache** (`data/last-scrape.json`):
   ```typescript
   saveCache(totalFleetSize, fleetComposition, planesData);
   ```
   - Updates plane snapshots with latest flight info
   - Stores fleet composition for next run

2. **Planes Data** (`data/planes.json`):
   ```typescript
   savePlanesData(planesData);
   ```
   - **MERGES** new data with existing
   - Deduplicates flights by timestamp
   - Sorts flights newest-first
   - Updates total flight count

**Merge Logic**:
```typescript
for (each newPlane) {
  existingPlane = find by fleetId;

  if (exists) {
    // Merge flights: new + old
    allFlights = [...newFlights, ...oldFlights];

    // Deduplicate by timestamp
    uniqueFlights = deduplicateByTimestamp(allFlights);

    // Sort descending
    uniqueFlights.sort((a, b) => b.timestamp - a.timestamp);

    // Update plane
    existingPlane.flightHistory = uniqueFlights;
  } else {
    // New plane → add to array
    planesData.push(newPlane);
  }
}
```

**Duration**: <1 second

**Code**:
- Cache: `smartFleetUtils.ts:714-754`
- Planes: `smartFleetUtils.ts:789-836`

## Performance Characteristics

### Execution Time Breakdown

| Phase                      | Duration                                           | Notes                          |
| -------------------------- | -------------------------------------------------- | ------------------------------ |
| Phase 1: Navigate          | ~1s                                                | One-time setup                 |
| Phase 2: Count & Calculate | ~1s (cached)<br>~10s (first run)                   | Counting all tabs is expensive |
| Phase 3A: Depart Planes    | ~2s/plane                                          | Includes random delay          |
| Phase 3B: Scrape Planes    | ~1-2s/plane (incremental)<br>~5s/plane (first run) | 80% faster when incremental    |
| Phase 4: Save Data         | <1s                                                | Fast I/O                       |

**Example** (5 planes, incremental scraping):
```
Total: ~1 + 1 + (5×2) + (5×1.5) + 1 = ~20 seconds
```

**Example** (5 planes, first run):
```
Total: ~1 + 10 + (5×2) + (5×5) + 1 = ~47 seconds
```

### Bottlenecks

1. **Tab switching** (Phase 2, first run): ~10 seconds
2. **Departures**: 2 seconds per plane (unavoidable - game animations)
3. **Detail page navigation**: ~1 second per plane (popup load time)

### Optimization Opportunities

1. **Use cache aggressively**: Avoid re-counting fleet
2. **Limit max departures**: Use override for testing (e.g., 1-2 planes)
3. **Skip scraping if hash unchanged** (future enhancement)
4. **Parallel scraping** (risky - might trigger rate limiting)

## Data Files

### Input Files

1. **`data/last-scrape.json`** (optional):
   - Cache from previous run
   - Enables incremental scraping
   - Created after first run

2. **`data/planes.json`** (optional):
   - Existing planes data
   - Merged with new scrapes
   - Created after first run

### Output Files

1. **`data/last-scrape.json`**:
   - Updated cache with latest snapshots
   - Used by next run for incremental scraping

2. **`data/planes.json`**:
   - Merged planes data (new + old)
   - Deduplicated flight history
   - Sorted by timestamp descending

### Artifact Upload (GitHub Actions)

All files uploaded with `if: always()` (even on failure):

- **smart-fleet-cache** (90 days): `data/last-scrape.json`
- **planes-data** (90 days): `data/planes.json`

## Testing Strategy

### Development Tests

**Location**: `tests/dev/smartFleet.spec.ts`

**Purpose**: Isolated testing with override to depart exactly 1 plane.

**Config**:
```typescript
const testConfig = {
  ...BOT_CONFIG.fleet,
  maxDeparturesOverride: 1  // ALWAYS depart exactly 1 plane
};
```

**Benefits**:
- Predictable behavior
- Fast execution (~10 seconds)
- Safe for testing (no mass departures)
- Validates full workflow

### Production Integration

**Location**: `tests/airlineManager.spec.ts`

**Config**: Uses `BOT_CONFIG.fleet` (respects environment variables)

**Default**: `maxDeparturesOverride = 1` (safe for production)

**Override in CI**:
```yaml
# .github/workflows/01_airlineManager.yml
MAX_DEPARTURES_OVERRIDE: 5  # Depart up to 5 planes per run
```

## Future Enhancements

### 1. Hash-Based Scraping Skip

**Current**: Always scrape detail page, even if no new flights.

**Future**:
```typescript
const cachedHash = cache.planesSnapshot[fleetId]?.hash;
const currentHash = generateHash(registration, ...);

if (cachedHash === currentHash) {
  console.log('No changes detected, skipping detail scrape');
  continue;  // Skip this plane
}
```

**Benefit**: 50% further speedup (avoid detail page navigation)

### 2. Batch Scraping

**Current**: Scrape planes one by one (sequential).

**Future**: Scrape multiple planes in parallel (careful with rate limiting).

**Challenge**: AM4 might throttle rapid requests.

### 3. Smart Percentage Adjustment

**Current**: Fixed percentage (e.g., 10%).

**Future**: Dynamic adjustment based on:
- Time of day (more departures during peak hours)
- Fuel availability
- Route profitability
- Maintenance schedules

### 4. Route Optimization

**Current**: Depart planes as-is (uses existing routes).

**Future**: Analyze route profitability, suggest changes.

### 5. Predictive Maintenance

**Current**: React to wear/maintenance needs.

**Future**: Predict when A-Check needed, schedule proactively.

## Migration Notes

### From Old Fleet System

**Old Architecture** (removed):
- `utils/04_fleet.utils.ts` - Simple "depart all" logic
- `utils/fleet/updatePlanes.utils.ts` - Separate incremental updater
- `tests/updateStartedPlanes.spec.ts` - Standalone update test
- `started-flights.json` - Temporary tracking file

**New Architecture** (current):
- `utils/04_fleet.utils.ts` - Facade (re-exports only)
- `utils/fleet/smartFleetUtils.ts` - Unified scrape & depart logic
- `tests/airlineManager.spec.ts` - Smart Fleet integrated
- `data/last-scrape.json` - Persistent cache

**Key Changes**:
1. **Unified workflow**: Depart + scrape in one pass (no separate update run)
2. **Incremental scraping**: Built into core logic (not separate util)
3. **Cache-based**: Uses persistent cache (not temp tracking file)
4. **Percentage-based**: Limits by fleet size (not "depart all")

**Why Better**:
- Fewer moving parts (1 workflow instead of 2)
- Faster execution (incremental scraping built-in)
- Safer (percentage-based limiting)
- Easier to maintain (single source of truth)
