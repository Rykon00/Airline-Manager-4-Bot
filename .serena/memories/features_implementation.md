# Features and Implementation Details

## Feature Overview

### 1. Intelligent Price Analytics

**Status**: ✅ Fully Implemented

**Implementation**: `utils/05_priceAnalytics.utils.ts`

#### Core Capabilities

**Historical Tracking**:
- 30-minute timeslot deduplication
- Unified fuel + CO2 price storage
- Automatic migration from old format
- Configurable history size (default: 200 entries)

**Statistical Analysis**:
- 24-hour averages, min/max
- 7-day averages, min/max
- Trend detection (rising/falling/stable)
- Confidence scoring (0-100%)

**Smart Recommendations**:
- Buy if price ≤ 85% of 24h average
- Buy on falling trend if below average
- Wait if price too high
- Emergency flag if price ≥ 150% of average (not used for auto-buy)

**Data Quality Scoring**:
- Count score (20 pts): ≥20 data points
- Timespan score (25 pts): ≥24h history
- Gap-free score (30 pts): Max gap <3h in 24h
- Coverage score (25 pts): All 4 daily quarters

#### Integration

Used by `FuelUtils`:
```typescript
const analysis = this.priceAnalytics.shouldBuyNow(
  'fuel',
  currentPrice,
  maxPrice,
  currentHolding,
  emergencyThreshold
);

if (analysis.shouldBuy) {
  // Execute purchase
}
```

#### Data Flow

```
AM4 Price → buyFuel()/buyCo2() → addPriceEntry() → price-history.json
                                      ↓
Chart Data → scrapeFuelChart() → addExternalPriceEntries() → price-history.json
                                      ↓
                              getStatistics() → shouldBuyNow() → Buy Decision
```

---

### 2. Chart Scraping

**Status**: ✅ Fully Implemented

**Implementation**: `utils/01_fuel.utils.ts` (private methods)

#### Mechanism

**Highcharts Data Extraction**:
- Executes JavaScript in browser context
- Accesses `window.Highcharts.charts[]`
- Extracts series data from chart objects
- Converts timestamps to ISO 8601 UTC

**Data Retrieved**:
- Last ~48 timeslots from AM4 charts
- Both fuel and CO2 historical prices
- Timestamps already in 30-min slots

**Execution**:
- Runs ONCE per bot session (first fuel popup)
- Controlled by `chartsScraped` flag
- Adds ~96 entries to price history (48 fuel + 48 CO2)

#### Code Flow

```typescript
if (!this.chartsScraped) {
  const fuelChartData = await this.scrapeFuelChart();
  this.priceAnalytics.addExternalPriceEntries('fuel', fuelChartData);

  const co2ChartData = await this.scrapeCO2Chart();
  this.priceAnalytics.addExternalPriceEntries('co2', co2ChartData);

  this.chartsScraped = true;
}
```

**Benefits**:
- Bootstraps price history quickly (from 0 to 96 entries)
- Improves data quality score immediately
- Enables intelligent decisions on first run

---

### 3. Fuel & CO2 Purchasing

**Status**: ✅ Fully Implemented

**Implementation**: `utils/01_fuel.utils.ts`

#### Decision Logic

**Priority Order**:
1. **Storage Check**: Skip if full
2. **Emergency Purchase**: If holding critically low AND price acceptable
3. **Intelligent Analysis**: If confidence ≥50%, use statistics
4. **Fallback**: Simple threshold check

#### Emergency Thresholds

**Fuel**:
- Emergency level: 2M liters
- Emergency purchase: 2M liters
- Normal purchase: 5M liters

**CO2**:
- Emergency level: 250k quota
- Emergency purchase: 250k quota
- Normal purchase: 1M quota

#### Purchase Amounts

Determined dynamically:
```typescript
let purchaseAmount: string;

if (curHolding < 2000000) {
  purchaseAmount = '2000000'; // Emergency: 2M
} else {
  purchaseAmount = '5000000'; // Normal: 5M
}
```

#### Execution Flow

```typescript
1. Get current price, holding, capacity
2. Log current state
3. Scrape chart (first run only)
4. Analyze price with shouldBuyNow()
5. If buy decision:
   a. Determine purchase amount
   b. Fill input field
   c. Click "Buy" button
   d. Confirm purchase
   e. Add price to history
6. If wait decision:
   a. Log reason
   b. Skip purchase
```

---

### 4. Campaign Management

**Status**: ✅ Fully Implemented

**Implementation**: `utils/02_campaign.utils.ts`

#### Campaigns Managed

1. **Eco-Friendly Campaign**
   - Reduces environmental impact
   - Improves airline rating

2. **Airline Reputation Campaign**
   - Increases reputation
   - Attracts more passengers

#### Logic

```typescript
public async checkAndCreateEcoFriendlyCampaign() {
  // Check if campaign already running
  const isActive = await this.isCampaignActive('eco');

  if (!isActive) {
    // Start new campaign
    await this.startCampaign('eco');
  }
}
```

**Behavior**:
- Checks campaign status before starting
- Only starts if not already active
- Prevents duplicate campaigns
- Handles both campaign types sequentially

---

### 5. Maintenance Operations

**Status**: ✅ Fully Implemented

**Implementation**: `utils/03_maintenance.utils.ts`

#### Operations

**Check Planes**:
- Inspects all planes for maintenance needs
- Identifies planes requiring repairs or A-Checks

**Repair Planes**:
- Executes repairs automatically
- Handles both regular repairs and A-Checks
- Processes all planes needing maintenance

#### Execution Flow

```typescript
1. Navigate to Maintenance section
2. Check planes for issues
3. Repair all planes needing maintenance
4. Close maintenance popup
```

**Note**: Implementation details minimal as feature is straightforward.

---

### 6. Smart Fleet Management

**Status**: ✅ Fully Implemented

**Implementation**: `utils/fleet/smartFleetUtils.ts` (895 lines, 27 methods)

**Documentation**: See `smart_fleet_system` memory for comprehensive details

#### Overview

**Unified Workflow**: Combines percentage-based departures with incremental flight data collection in a single pass.

**Architecture**:
```
Bot Run (every 30 min):
  1. Calculate percentage-based departure limit
  2. Depart top N planes (FIFO strategy)
  3. Scrape ONLY departed planes (incremental)
  4. Save cache + merged data
```

**Benefits**:
- Single workflow (no separate update step)
- 57% faster execution via incremental scraping
- Percentage-based safety limiting
- Cache-optimized fleet counting

#### Key Features

**1. FIFO Departure Strategy**:
- Always depart the TOP plane from Landed tab
- Fair rotation ensures all planes get flight time
- Natural queue behavior (no complex sorting)

**2. Percentage-Based Limiting**:
```typescript
maxDepartures = Math.floor(totalFleetSize × percentage);
// Example: 100 planes × 10% = 10 max departures
```

**3. Incremental Flight History**:
- Tracks last known flight timestamp per plane
- Only scrapes NEW flights (stops when reaching known data)
- 80-90% faster than full scraping (~1.5s vs ~5s per plane)

**4. Global Safety Override**:
```typescript
maxDeparturesOverride: 1  // Default: Only 1 plane per run
```
- Prevents runaway automation
- Must explicitly increase for higher throughput
- Overrides percentage calculation when set

**5. Cache-Based Optimization**:
```json
// data/last-scrape.json
{
  "totalFleetSize": 100,
  "planesSnapshot": {
    "105960065": {
      "lastFlightTimestamp": "2025-01-05T12:30:00.000Z",
      "totalFlights": 5,
      "hash": "a1b2c3d4..."
    }
  }
}
```
- Avoids re-counting fleet (saves ~10 seconds)
- Enables incremental scraping
- Change detection via hash

#### Execution Phases

**Phase 1: Navigate to Fleet Overview** (~1s):
- Click "Landed" tab in fleet sidebar
- Verify tab is active

**Phase 2: Count & Calculate** (~1s cached, ~10s first run):
- Try loading fleet size from cache
- Fallback: Count across all tabs (Inflight/Landed/Parked/Pending)
- Calculate max departures based on percentage
- Apply override if configured

**Phase 3A: Depart Planes** (~2s per plane):
```typescript
while (departedCount < maxDepartures) {
  const row = landedRows.nth(0);  // ALWAYS top plane
  const fleetId = extractFleetId(row);
  
  await row.click();
  await departButton.click();
  
  departedFleetIds.push(fleetId);
  await returnToListAfterDeparture();
}
```

**Phase 3B: Scrape Departed Planes** (~1.5s per plane incremental):
```typescript
// Switch to Inflight tab
for (fleetId of departedFleetIds) {
  // Scrape panel data
  const panelData = await scrapePanelData(fleetId);
  
  // Scrape detail page (INCREMENTAL!)
  const detailData = await scrapeDetailPage(fleetId, cache);
  
  // Flight history: stop when reaching lastKnownTimestamp
  for (flight of flightHistory) {
    if (isNewer(flight.timestamp, lastKnown)) {
      newFlights.push(flight);  // NEW
    } else {
      break;  // STOP - reached old data
    }
  }
}
```

**Phase 4: Save Data** (<1s):
- Save cache to `data/last-scrape.json`
- Merge & save planes to `data/planes.json` (deduplicates flights)

#### Configuration

**Environment Variables** (via `config.ts`):
```env
FLEET_PERCENTAGE=0.10           # 10% of total fleet
FLEET_MIN_DELAY=1000            # 1 second between actions
FLEET_MAX_DELAY=2000            # 2 seconds max
FLEET_MOCK_MODE=false           # Enable real departures
MAX_DEPARTURES_OVERRIDE=1       # Global limit (default: 1)
```

**Usage in Tests**:
```typescript
// Production (airlineManager.spec.ts)
const smartFleet = new SmartFleetUtils(page, BOT_CONFIG.fleet);

// Development (tests/dev/smartFleet.spec.ts)
const smartFleet = new SmartFleetUtils(page, {
  ...BOT_CONFIG.fleet,
  maxDeparturesOverride: 1  // Testing: exactly 1 plane
});
```

#### Performance

**Typical Execution** (5 planes, incremental):
```
Phase 1: Navigate             1s
Phase 2: Count (cached)       1s
Phase 3A: Depart (5×2s)      10s
Phase 3B: Scrape (5×1.5s)    7.5s
Phase 4: Save                0.5s
---
Total:                       20s
```

**First Run** (5 planes, no cache):
```
Phase 2: Count (no cache)    10s  (+9s)
Phase 3B: Full scrape (5×5s) 25s  (+17.5s)
---
Total:                       47s
```

**Speedup**:
- Incremental vs Full: 57% faster (20s vs 47s)
- Cached counting: 90% faster (1s vs 10s)
- Incremental scraping: 70% faster per plane (1.5s vs 5s)

#### Data Files

**Input** (optional):
- `data/last-scrape.json` - Cache from previous run
- `data/planes.json` - Existing planes data

**Output**:
- `data/last-scrape.json` - Updated cache with snapshots
- `data/planes.json` - Merged data (deduplicated flights)

**GitHub Actions Artifacts**:
- **smart-fleet-cache** (90 days): `data/last-scrape.json`
- **planes-data** (90 days): `data/planes.json`

#### Safety Features

1. **Global Departure Limit**: Default 1 plane/run (must increase manually)
2. **Mock Mode by Default**: `mockMode: true` (no real departures in dev)
3. **FIFO Fairness**: All planes get equal flight time
4. **Incremental Scraping**: Reduces server load
5. **Change Detection**: Hash-based skip (future enhancement)

#### Migration from Old System

**Removed**:
- ❌ Separate `updateStartedPlanes.spec.ts` workflow
- ❌ `started-flights.json` temporary tracking file
- ❌ "Depart all" logic (no percentage limiting)

**Added**:
- ✅ Unified Smart Fleet workflow
- ✅ Percentage-based limiting
- ✅ Incremental scraping built-in
- ✅ Persistent cache system
- ✅ FIFO departure strategy

**Why Better**:
- Simpler: 1 workflow instead of 2
- Faster: 57% execution time reduction
- Safer: Percentage + global override
- Smarter: Cache-based optimization

---

### 7. Full Fleet Data Collection

**Status**: ✅ Fully Implemented

**Implementation**: `utils/fleet/fetchPlanes.utils.ts`

**Purpose**: Complete fleet scan (scheduled daily at 3am UTC)

#### Collection Modes

**Mode 1: Basic Only** (`maxDetailsToFetch = -1`):
- Scrapes only list view data
- No detail page navigation
- Fast: ~20 seconds
- Data: Basic info only (no flight history)

**Mode 2: Partial Details** (`maxDetailsToFetch = 5`, default):
- First 5 planes: Full details + flight history
- Remaining planes: Basic info only
- Moderate: ~60 seconds
- Balanced performance/detail

**Mode 3: Full Details** (`maxDetailsToFetch = 0`):
- ALL planes: Full details + flight history
- Navigates to every plane's detail page
- Slow: ~120-180 seconds (100+ planes)
- Complete data set

#### Data Collected

**Basic (List View)**:
- FleetID (unique identifier, immutable)
- Registration (user-changeable)
- Aircraft type
- Current route/status
- Basic stats

**Details (Detail Page)**:
- Aircraft specifications (range, runway, wear)
- Full flight history (up to 20 flights per plane)
- Per-flight metrics:
  - Route (ICAO codes)
  - Route name (management ID)
  - Quotas earned
  - Passengers (Y/J/F/total)
  - Cargo weight
  - Revenue (USD)

#### Usage

**Location**: `tests/dev/fetchPlanes.spec.ts`

**Workflow Schedule**: Daily at 3am UTC (full refresh)

**Configuration**:
```typescript
const planes = await fetchPlanesUtils.getAllPlanes(5);  // First 5 detailed
```

**Output**: Completely replaces `data/planes.json`

**When to Use**:
- Daily full refresh (ensures data consistency)
- Initial fleet setup (bootstrap data)
- Data quality check (verify incremental updates)

---

### 8. Timestamp Conversion System

**Status**: ✅ Fully Implemented

**Implementation**: `utils/fleet/timestampUtils.ts` (185 lines)

**Purpose**: Convert relative timestamps from AM4 to absolute ISO-8601 with precision tracking.

#### Problem

AM4 displays times as:
- "5 hours ago" → precise to ~30 min slot
- "6 days ago" → precise to ~day
- "2 months ago" → precise to ~month

We need absolute timestamps for sorting/deduplication, but must track precision to know accuracy.

#### Solution

**Dual Information Storage**:
```typescript
interface ConvertedTimestamp {
  timestamp: string;          // Absolute ISO-8601
  original: string;           // Original "5 hours ago"
  precisionLevel: PrecisionLevel;  // How accurate
}

type PrecisionLevel = 'slot' | 'day' | 'week' | 'month' | 'year';
```

#### Conversion Rules

| Original | Precision | Rounded To | Example |
|----------|-----------|------------|---------|
| "30 minutes ago" | slot | Nearest 30-min | `2025-01-05T14:30:00.000Z` |
| "5 hours ago" | slot | Nearest 30-min | `2025-01-05T09:30:00.000Z` |
| "2 days ago" | day | Start of day | `2025-01-03T00:00:00.000Z` |
| "1 week ago" | week | Monday 00:00 | `2024-12-29T00:00:00.000Z` |
| "3 months ago" | month | 1st of month | `2024-10-01T00:00:00.000Z` |
| "1 year ago" | year | Jan 1 | `2024-01-01T00:00:00.000Z` |

#### Slot Rounding Rules

**Definition**: 30-minute interval aligned to :00 or :30

**Algorithm**:
```typescript
Minutes 0-14  → :00
Minutes 15-44 → :30
Minutes 45-59 → next hour :00

// Examples:
14:07 → 14:00
14:22 → 14:30
14:51 → 15:00
```

**Why 30-minute slots?**:
- AM4 updates prices every 30 minutes
- Good balance between precision and data size
- Natural deduplication boundary
- Aligns with game mechanics

#### Key Methods

**`convertRelativeToAbsolute(text)`**:
```typescript
const converted = TimestampUtils.convertRelativeToAbsolute("5 hours ago");
// Returns: { timestamp: "2025-01-05T09:30:00.000Z", 
//            original: "5 hours ago", 
//            precisionLevel: "slot" }
```

**`roundToNearestSlot(date)`**:
```typescript
const rounded = TimestampUtils.roundToNearestSlot(new Date());
// Returns: Date rounded to nearest :00 or :30
```

**`isNewer(timestamp1, timestamp2)`**:
```typescript
if (TimestampUtils.isNewer(newFlight.timestamp, lastKnownTimestamp)) {
  // This flight is newer - add to data
}
```

**`generatePlaneHash(...)`**:
```typescript
const hash = TimestampUtils.generatePlaneHash(
  registration,
  lastFlightTimestamp,
  totalFlights
);
// Returns: Simple hash for change detection
```

#### Integration

**Used by**:
- `SmartFleetUtils.scrapeFlightHistoryIncremental()` - Convert flight times
- `SmartFleetUtils.scrapeDetailPage()` - Convert delivery dates
- `PriceAnalyticsUtils` - Align price timestamps to slots

**Storage**:
```typescript
// In PlaneData
interface FlightHistoryEntry {
  timestamp: string;           // ISO-8601 absolute
  timeAgoOriginal: string;     // "5 hours ago"
  precisionLevel: PrecisionLevel;  // How accurate
  // ... other fields
}
```

---

## Feature Dependencies

### Price Analytics Dependencies

**Required**:
- `fs` module (file I/O)
- `path` module (file paths)
- `data/` directory (created automatically)

**Optional**:
- Chart scraping (enhances data quality)
- External price sources (can be integrated)

### Smart Fleet Dependencies

**Required**:
- `Page` object (Playwright)
- `data/` directory (for cache and planes data)
- `config.ts` (for configuration)

**Optional but Recommended**:
- `data/last-scrape.json` (cache - created after first run)
- `data/planes.json` (existing data - merged with new)

---

## Configuration Points

### Price Thresholds

**File**: `.env` (local) or GitHub Variables (CI)

```env
MAX_FUEL_PRICE=550
MAX_CO2_PRICE=120
```

**Impact**: Simple fallback threshold when confidence <50%.

### Emergency Levels

**File**: `utils/01_fuel.utils.ts`

```typescript
// Fuel emergency threshold
emergencyThreshold: 2000000

// CO2 emergency threshold
emergencyThreshold: 250000
```

**Impact**: When to buy despite high prices.

### Purchase Amounts

**File**: `utils/01_fuel.utils.ts`

```typescript
// Fuel
emergency: '2000000'
normal: '5000000'

// CO2
emergency: '250000'
normal: '1000000'
```

**Impact**: How much to purchase per buy action.

### Fleet Configuration

**File**: `config.ts` (overridable via `.env`)

```typescript
export const BOT_CONFIG = {
  fleet: {
    percentage: parseFloat(process.env.FLEET_PERCENTAGE || '0.10'),
    minDelay: parseInt(process.env.FLEET_MIN_DELAY || '1000'),
    maxDelay: parseInt(process.env.FLEET_MAX_DELAY || '2000'),
    mockMode: process.env.FLEET_MOCK_MODE === 'true',
    maxDeparturesOverride: process.env.MAX_DEPARTURES_OVERRIDE 
      ? parseInt(process.env.MAX_DEPARTURES_OVERRIDE) 
      : 1  // Safe default
  }
};
```

**Impact**: 
- `percentage`: How many planes to depart (% of total fleet)
- `minDelay`/`maxDelay`: Random delay between actions (avoid detection)
- `mockMode`: Enable/disable real departures
- `maxDeparturesOverride`: Global safety limit (default: 1)

### Full Scan Detail Level

**File**: `tests/dev/fetchPlanes.spec.ts`

```typescript
const planes = await fetchPlanesUtils.getAllPlanes(5);
```

**Options**: -1 (none), 0 (all), N (first N)

**Impact**: Trade-off between speed and detail.

### Price History Size

**File**: `utils/05_priceAnalytics.utils.ts`

```typescript
constructor(maxHistoryEntries: number = 200)
```

**Impact**: Memory usage vs historical depth.

---

## Extension Opportunities

### Potential Enhancements

1. **Telegram Notifications**
   - Send alerts on purchases
   - Daily summary reports
   - Emergency notifications

2. **Advanced Analytics**
   - Machine learning price predictions
   - Seasonal pattern detection
   - Multi-variable optimization

3. **Route Optimization**
   - Analyze profitable routes
   - Suggest route changes
   - Auto-create routes

4. **Financial Tracking**
   - Revenue/expense tracking
   - Profitability analysis
   - Budget management

5. **Hash-Based Scraping Skip**
   - Skip detail scraping if plane unchanged
   - 50% further speedup
   - Reduce server load

### Adding New Features

**Pattern**:
```typescript
// 1. Create new util class
export class NewFeatureUtils {
  constructor(private page: Page) {}

  public async doSomething() {
    // Implementation
  }
}

// 2. Add to main test
const newFeature = new NewFeatureUtils(page);
await newFeature.doSomething();

// 3. Update documentation
```

**File Naming**: `06_newfeature.utils.ts` (continue numbering).

---

## Performance Characteristics

### Execution Times

| Feature | Time | Frequency |
|---------|------|-----------|
| Login | 5-10s | Every run |
| Fuel/CO2 purchase | 10-15s | Every 30 min |
| Campaign check | 5-10s | Every 30 min |
| Maintenance | 5-10s | Every 30 min |
| **Smart Fleet** | **20s** (incremental) | Every 30 min |
| **Smart Fleet** | **47s** (first run) | Once only |
| Full plane scan | 60s (5 planes) | Daily (3am) |
| Full plane scan | 120-180s (all) | Optional |

### Bottlenecks

1. **Network latency**: AM4 response times
2. **DOM scraping**: Waiting for elements
3. **Detail page navigation**: ~1s per plane
4. **Tab switching**: ~1s per tab (Phase 2 first run)

### Optimization Strategies

1. **Cache aggressively**: Reuse fleet size (saves 10s)
2. **Incremental scraping**: Only new flights (70% faster)
3. **Limit departures**: Use override for testing (e.g., 1 plane)
4. **Reduce waits**: Minimize `sleep()` calls
5. **Hash-based skip** (future): Skip unchanged planes (50% faster)

---

## Reliability Features

### Error Handling

**Graceful Degradation**:
- Continue on non-critical failures
- Log errors without crashing
- Skip operations if prerequisites missing

**Example**:
```typescript
try {
  await this.buyCo2();
} catch (error) {
  console.error('CO2 purchase failed:', error);
  // Continue with next operation
}
```

### Data Validation

**Price Analytics**:
- Validates JSON structure
- Migrates old formats automatically
- Creates empty files if missing

**Fleet Data**:
- Validates FleetIDs (immutable identifiers)
- Handles missing planes gracefully
- Deduplicates flights by timestamp
- Merges data intelligently

### Retry Logic

**Not Implemented**: No automatic retries within tests.

**Handled by Schedule**: Failed run → next run in 30 min.

**Manual Retry**: Use `workflow_dispatch` to retry immediately.

### Safety Features

1. **Global Departure Limit**: Default 1 plane per run
2. **Mock Mode**: Safe default (no real departures)
3. **Percentage Limiting**: Prevents over-automation
4. **FIFO Strategy**: Fair rotation (no plane starvation)
5. **Cache Validation**: Graceful fallback if corrupted
