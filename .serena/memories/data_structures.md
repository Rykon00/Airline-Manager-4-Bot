# Data Structures and Interfaces

## Core Data Models

### Price Analytics Data

#### TimeslotEntry
Represents a 30-minute price timeslot with both fuel and CO2 prices.

```typescript
interface TimeslotEntry {
  timestamp: string;  // ISO 8601 UTC timestamp (rounded to :00 or :30)
  fuel: number;      // Fuel price in $ (0 if not available)
  co2: number;       // CO2 price in $ (0 if not available)
}
```

**Timeslot Logic**:
- All timestamps are rounded to nearest 30-minute slot (e.g., 14:00 or 14:30)
- Uses UTC time (AM4 standard)
- Deduplication: Only one entry per timeslot
- Updates overwrite existing prices for the same timeslot

#### PriceHistory
Container for all historical price data.

```typescript
interface PriceHistory {
  timeslots: TimeslotEntry[];  // Sorted array of price entries
  lastUpdated: string;          // ISO 8601 timestamp of last modification
}
```

**Persistence**:
- Stored in `data/price-history.json`
- Uploaded as GitHub Actions artifact (90-day retention)
- Automatically migrates from old format (separate fuel/co2 arrays)
- Trimmed to last 200 entries (configurable via constructor)

#### PriceStatistics
Calculated statistics and recommendations for a price type.

```typescript
interface PriceStatistics {
  current: number;                           // Current price
  avg24h: number;                            // 24-hour average
  avg7d: number;                             // 7-day average
  min24h: number;                            // 24-hour minimum
  max24h: number;                            // 24-hour maximum
  min7d: number;                             // 7-day minimum
  max7d: number;                             // 7-day maximum
  trend: 'rising' | 'falling' | 'stable';   // Price trend
  recommendation: 'buy' | 'wait' | 'emergency';
  confidence: number;                        // Confidence score 0-100
}
```

**Trend Detection**:
- Compares last 5 entries vs. previous 5 entries
- Rising: >5% increase
- Falling: >5% decrease
- Stable: -5% to +5%

**Buy Recommendation Logic**:
- **buy**: Price ≤ 85% of 24h average OR falling trend + below average
- **wait**: Price above threshold
- **emergency**: Price ≥ 150% of 24h average (not currently used for auto-buy)

**Confidence Calculation**:
- 50% if ≥20 data points in 24h
- 30% if ≥100 data points in 7d
- 20% if clear trend detected (not stable)

---

## Smart Fleet Data Structures

**Location**: `utils/fleet/fleetTypes.ts`

### FlightHistoryEntry
Historical flight data for a single flight with precision tracking.

```typescript
interface FlightHistoryEntry {
  timestamp: string;                      // ISO-8601 absolute timestamp
  timeAgoOriginal: string;                // Original "5 hours ago" text
  precisionLevel: 'slot' | 'day' | 'week' | 'month' | 'year';  // Precision of timestamp
  route: string;                          // e.g., "ELQ-FRA"
  routeName: string | null;               // e.g., "L-0008" (route management name)
  quotas: number | null;
  passengers: {
    economy: number | null;
    business: number | null;
    first: number | null;
    total: number | null;
  };
  cargoWeightLbs: number | null;
  revenueUSD: number | null;
}
```

**Key Features**:
- Dual timestamp storage (absolute + original)
- Precision tracking (how accurate the timestamp is)
- Complete flight metrics
- Nullable fields (graceful degradation)

**Precision Levels**:
- `slot`: ±15 minutes (e.g., "5 hours ago")
- `day`: ±12 hours (e.g., "2 days ago")
- `week`: ±3.5 days (e.g., "1 week ago")
- `month`: ±15 days (e.g., "3 months ago")
- `year`: ±6 months (e.g., "1 year ago")

### DeliveredDate
Delivered date with precision tracking.

```typescript
interface DeliveredDate {
  timestamp: string;                      // ISO-8601 absolute timestamp
  original: string;                       // Original text like "6 months ago"
  precisionLevel: 'slot' | 'day' | 'week' | 'month' | 'year';
}
```

**Usage**: Tracks when plane was delivered to airline.

### PlaneCurrentMetrics
Current metrics for a plane.

```typescript
interface PlaneCurrentMetrics {
  hoursToCheck: number | null;
  rangeKm: number | null;
  flightHours: number | null;
  flightCycles: number | null;
  minRunwayFt: number | null;
  wearPercent: number | null;
}
```

**Extracted from**: Detail page scraping

### PlaneMetadata
Metadata about scraping operations.

```typescript
interface PlaneMetadata {
  lastScraped: string;                    // ISO-8601 timestamp
  lastFlightAdded: string | null;         // ISO-8601 timestamp of last flight added
  totalFlightsScrapped: number;
}
```

**Purpose**: Track scraping history and data freshness.

### PlaneData
Full plane data structure for planes.json.

```typescript
interface PlaneData {
  fleetId: string;
  registration: string;
  aircraftType: string | null;
  deliveredDate: DeliveredDate | null;
  currentMetrics: PlaneCurrentMetrics;
  flightHistory: FlightHistoryEntry[];
  metadata: PlaneMetadata;
}
```

**Key Identifiers**:
- `fleetId`: **IMMUTABLE** - Primary key, never changes
- `registration`: User-changeable, not safe for matching

**Storage**: `data/planes.json` as array of PlaneData

**Merge Logic**: 
- Matched by `fleetId`
- Flight history deduplicated by timestamp
- Sorted newest-first

### FleetComposition
Snapshot of fleet distribution across tabs.

```typescript
interface FleetComposition {
  inflight: number;
  landed: number;
  parked: number;
  pending: number;
}
```

**Purpose**: Track fleet status, cached for performance.

### PlaneSnapshot
Lightweight plane snapshot for cache.

```typescript
interface PlaneSnapshot {
  registration: string;
  lastFlightTimestamp: string | null;     // ISO-8601
  lastFlightRoute: string | null;
  totalFlights: number;
  hash: string;                           // Simple hash for change detection
}
```

**Purpose**: Enables incremental scraping (track last known state).

**Hash Algorithm**:
```typescript
hash = MD5(registration + lastFlightTimestamp + totalFlights)
```

### LastScrapeCache
Cache structure for incremental updates.

```typescript
interface LastScrapeCache {
  lastRunTimestamp: string;               // ISO-8601
  totalFleetSize: number;
  departurePercentage: number;            // e.g., 0.10 for 10%
  fleetComposition: FleetComposition;
  planesSnapshot: {
    [fleetId: string]: PlaneSnapshot;
  };
}
```

**Storage**: `data/last-scrape.json`

**Purpose**:
- Avoid re-counting fleet (saves ~10 seconds)
- Enable incremental scraping (80-90% speedup)
- Track configuration used (audit trail)

**Persistence**: GitHub Actions artifact (90-day retention)

### DepartureConfig
Configuration for departure strategy.

```typescript
interface DepartureConfig {
  percentage: number;                     // e.g., 0.10 for 10%
  minDelay: number;                       // Min delay between actions (ms)
  maxDelay: number;                       // Max delay between actions (ms)
  mockMode: boolean;                      // If true, don't actually depart
  maxDeparturesOverride?: number;         // Optional: Override calculated max departures
}
```

**Defaults**:
```typescript
{
  percentage: 0.10,            // 10%
  minDelay: 1000,              // 1 second
  maxDelay: 2000,              // 2 seconds
  mockMode: true,              // SAFE: Mock by default
  maxDeparturesOverride: 1     // SAFE: Only 1 plane per run
}
```

**Environment Overrides**:
```env
FLEET_PERCENTAGE=0.10
FLEET_MIN_DELAY=1000
FLEET_MAX_DELAY=2000
FLEET_MOCK_MODE=false
MAX_DEPARTURES_OVERRIDE=5
```

---

## Timestamp Conversion Types

**Location**: `utils/fleet/timestampUtils.ts`

### ConvertedTimestamp
Result of timestamp conversion.

```typescript
interface ConvertedTimestamp {
  timestamp: string;                      // ISO-8601 absolute
  original: string;                       // Original "5 hours ago"
  precisionLevel: PrecisionLevel;
}
```

**Usage**: Return type of `convertRelativeToAbsolute()`

### PrecisionLevel
Precision level for timestamps.

```typescript
type PrecisionLevel = 'slot' | 'day' | 'week' | 'month' | 'year';
```

**Mapping**:

| Original Text | PrecisionLevel | Rounded To |
|--------------|----------------|------------|
| "30 minutes ago" | `slot` | Nearest 30-min slot |
| "5 hours ago" | `slot` | Nearest 30-min slot |
| "2 days ago" | `day` | Start of day (00:00) |
| "1 week ago" | `week` | Start of week (Monday) |
| "3 months ago" | `month` | Start of month (1st) |
| "1 year ago" | `year` | Start of year (Jan 1) |

---

## Legacy Data Structures

### FlightHistory (DEPRECATED)
**Status**: ⚠️ Still exists in `fetchPlanes.utils.ts` and `updatePlanes.utils.ts`

```typescript
interface FlightHistory {
  timeAgo: string | null;            // e.g., "10 hours ago"
  route: string | null;              // e.g., "ELQ-FRA"
  routeName: string | null;          // e.g., "L-0008"
  quotas: number | null;
  passengers: {
    economy: number | null;
    business: number | null;
    first: number | null;
    total: number | null;
  };
  cargoWeightLbs: number | null;
  revenueUSD: number | null;
}
```

**Difference from FlightHistoryEntry**:
- ❌ No `timestamp` (only `timeAgo`)
- ❌ No `precisionLevel` tracking
- ❌ Not used by Smart Fleet

**Migration Path**: Will be replaced by `FlightHistoryEntry` in future cleanup.

### PlaneInfo (DEPRECATED)
**Status**: ⚠️ Still exists in `fetchPlanes.utils.ts` and `updatePlanes.utils.ts`

```typescript
interface PlaneInfo {
  fleetId: string | null;
  registration: string | null;
  detailPageUrl: string | null;
  aircraftType: string | null;
  planeType: string | null;
  delivered: string | null;
  range: string | null;
  minRunway: string | null;
  rawRouteText: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  hoursToCheck: string | null;
  flightHoursCycles: string | null;
  wear: string | null;
  flightHistory?: FlightHistory[];
  error?: string;
}
```

**Difference from PlaneData**:
- ❌ Flat structure (no `currentMetrics` grouping)
- ❌ No `metadata` tracking
- ❌ No `deliveredDate` with precision
- ❌ Uses `FlightHistory` instead of `FlightHistoryEntry`

**Migration Path**: Being replaced by `PlaneData` in Smart Fleet.

---

## File Locations

### Data Directory (`data/`)
- `price-history.json` - PriceHistory object
- `planes.json` - PlaneData[] array
- `last-scrape.json` - LastScrapeCache object (Smart Fleet)

### GitHub Actions Artifacts
All artifacts use `actions/upload-artifact@v4`:

| Artifact Name | File Path | Retention | Purpose |
|--------------|-----------|-----------|---------|
| **price-history** | `data/price-history.json` | 90 days | Price analytics data |
| **planes-data** | `data/planes.json` | 90 days | Complete fleet data |
| **smart-fleet-cache** | `data/last-scrape.json` | 90 days | Incremental scraping cache |

---

## Data Quality Scoring

Price data quality is scored 0-100 based on:

### Count (20 points)
- Full points: ≥20 data points
- Partial: Proportional to count/20

### Timespan (25 points)
- Full points: Oldest entry ≥24h ago
- Partial: Proportional to age/24h

### Gap-free (30 points)
- Full points: Largest gap in last 24h <3h
- Partial: 15 points if gap <6h
- Zero: Gap ≥6h

### Day Coverage (25 points)
- Full points: All 4 daily quarters covered (0-6h, 6-12h, 12-18h, 18-24h)
- Partial: 6.25 points per quarter
- Based on UTC time

---

## Data Migration

### Price History: Old Format → New Format
Automatically migrates on first load:

**Old Format**:
```json
{
  "fuel": [{"timestamp": "...", "price": 550}],
  "co2": [{"timestamp": "...", "price": 120}]
}
```

**New Format**:
```json
{
  "timeslots": [
    {"timestamp": "...", "fuel": 550, "co2": 120}
  ],
  "lastUpdated": "..."
}
```

Migration logic: Merges both arrays by timestamp into unified timeslots.

---

## Data Validation

### FleetID Validation
```typescript
// Valid FleetID format: numeric string
const fleetIdRegex = /^\d+$/;
const isValid = fleetIdRegex.test(fleetId);
```

**Properties**:
- Immutable (never changes)
- Unique per plane
- Primary key for matching

### Timestamp Validation
```typescript
// Valid ISO-8601 format
const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isValid = timestampRegex.test(timestamp);
```

**Properties**:
- Always UTC (trailing Z)
- Millisecond precision
- Sortable (string comparison works)

---

## Data Deduplication

### Flight History Deduplication
```typescript
// Deduplicate by timestamp
const uniqueFlights = Array.from(
  new Map(flights.map(f => [f.timestamp, f])).values()
);

// Sort descending (newest first)
uniqueFlights.sort((a, b) => 
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
);
```

**Applied in**:
- `SmartFleetUtils.savePlanesData()` - Merge new + old flights
- `PriceAnalyticsUtils.addPriceEntry()` - Merge timeslot entries

### Timeslot Deduplication
```typescript
// Only one entry per 30-min slot
const slotKey = TimestampUtils.getCurrentTimeSlot(timestamp);
// Example: "2025-01-05T14:30:00.000Z"

// Later entry overwrites earlier entry for same slot
timeslots[slotKey] = { timestamp: slotKey, fuel, co2 };
```

---

## Data Persistence Strategy

### Local Development
```typescript
// Files persist in data/ directory
data/
  ├── price-history.json      (grows to ~200 entries)
  ├── planes.json             (one entry per plane)
  └── last-scrape.json        (cache, updated each run)
```

**Behavior**:
- Files created automatically on first run
- Updated on each subsequent run
- Not git-tracked (in .gitignore)

### CI/CD (GitHub Actions)
```yaml
# Download artifacts before run
- name: Download previous cache
  uses: dawidd6/action-download-artifact@v3
  with:
    name: smart-fleet-cache
    if_no_artifact_found: warn  # OK if first run

# Upload artifacts after run (even on failure)
- name: Upload cache
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: smart-fleet-cache
    path: data/last-scrape.json
    retention-days: 90
```

**Behavior**:
- Artifacts downloaded before each run
- Artifacts uploaded after each run (even failures)
- Provides stateful behavior in stateless CI

---

## Memory Usage

### Price History
```
200 entries × ~100 bytes = ~20 KB
```

### Planes Data
```
100 planes × (1 KB base + 20 flights × 300 bytes) = ~700 KB
```

### Last Scrape Cache
```
100 planes × ~200 bytes snapshot = ~20 KB
```

**Total**: ~740 KB (negligible)

---

## Data Access Patterns

### Read Performance

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Load price history | O(1) | Single file read |
| Load planes data | O(1) | Single file read |
| Find plane by FleetID | O(n) | Linear search in array |
| Get last N flights | O(1) | Already sorted |
| Check cache for plane | O(1) | Hash map lookup |

### Write Performance

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Save price history | O(n) | Serialize + write |
| Save planes data | O(n) | Merge + dedupe + write |
| Update cache | O(n) | Rebuild snapshots |

**Bottleneck**: None - all operations <1 second for typical data sizes.

---

## Future Enhancements

### 1. Database Migration
**Current**: JSON files
**Future**: SQLite or PostgreSQL
**Benefits**: Faster queries, transactions, relationships

### 2. Compression
**Current**: Plain JSON
**Future**: gzip compression
**Benefits**: 70-80% size reduction, faster uploads

### 3. Incremental Saves
**Current**: Full file rewrite
**Future**: Append-only log + periodic compaction
**Benefits**: Faster writes, durability

### 4. Schema Versioning
**Current**: Ad-hoc migration
**Future**: Explicit version field + migration scripts
**Benefits**: Easier upgrades, rollback support
