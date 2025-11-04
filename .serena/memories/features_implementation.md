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

### 6. Fleet Operations

**Status**: ✅ Fully Implemented

**Implementation**: `utils/04_fleet.utils.ts`

#### Automated Departures

**Flow**:
```typescript
1. Navigate through all fleet pages (pagination)
2. For each plane with "Depart" button:
   a. Extract FleetID from detail page link
   b. Click "Depart All" button
   c. Track FleetID in array
3. Save all FleetIDs to started-flights.json
```

**FleetID Extraction**:
```typescript
const url = await detailLink.getAttribute('href');
// Example: /route?id=105960065
const match = url.match(/id=(\d+)/);
const fleetId = match[1]; // "105960065"
```

**Output**:
```json
{
  "fleetIds": ["105960065", "105960123", "105960456"]
}
```

**Purpose**: Enables incremental updates by tracking which planes were started.

---

### 7. Full Fleet Data Collection

**Status**: ✅ Fully Implemented

**Implementation**: `utils/fleet/fetchPlanes.utils.ts`

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
- FleetID (unique identifier)
- Registration (user-changeable)
- Aircraft type
- Current route/status
- Basic stats

**Details (Detail Page)**:
- Full flight history (up to 20 flights)
- Per-flight data:
  - Route (ICAO codes)
  - Route name (management ID)
  - Quotas earned
  - Passengers (Y/J/F/total)
  - Cargo weight
  - Revenue

#### Pagination Handling

```typescript
while (hasNextPage) {
  // Process current page
  const rows = await page.locator('div[id^="routeMainList"]').count();

  // Check for next page button
  const nextButton = page.locator('button.next-page');
  hasNextPage = await nextButton.isEnabled();

  if (hasNextPage) {
    await nextButton.click();
  }
}
```

---

### 8. Incremental Fleet Updates

**Status**: ✅ Fully Implemented

**Implementation**: `utils/fleet/updatePlanes.utils.ts`

#### Purpose

Efficiently update only planes that were started by the bot, avoiding full scans every 30 minutes.

#### Process

```typescript
1. Read started-flights.json
2. Extract FleetIDs array
3. Load existing planes.json
4. For each FleetID:
   a. Find plane in array by FleetID
   b. Navigate to detail page
   c. Scrape updated flight data
   d. Replace plane entry in array
5. Save updated planes.json
6. Delete started-flights.json
```

#### Performance

**vs Full Scan**:
- Full scan: 120-180s for 100+ planes
- Incremental: 5-15s per plane
- Example: 5 started planes = ~60s (vs 180s)

#### Data Integrity

**Matching by FleetID**:
```typescript
const planeIndex = planes.findIndex(p => p.fleetId === targetFleetId);

if (planeIndex >= 0) {
  planes[planeIndex] = updatedPlane;
}
```

**FleetID is immutable**: Safe for matching across updates.

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

### Fleet Management Dependencies

**Required**:
- `planes.json` (for incremental updates)
- `started-flights.json` (for tracking)

**Optional**:
- FleetID tracking (improves efficiency)

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

### Fleet Detail Level

**File**: `tests/fetchPlanes.spec.ts`

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

5. **Competitor Analysis**
   - Track competitor prices
   - Market share analysis
   - Benchmarking

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
| Fleet departures | 10-20s | Every 30 min |
| Full plane scan | 120-180s | Daily (3am) |
| Incremental update | 5-15s/plane | Every 30 min |

### Bottlenecks

1. **Network latency**: AM4 response times
2. **DOM scraping**: Waiting for elements
3. **Pagination**: Multiple page loads
4. **Detail fetching**: N × page load time

### Optimization Strategies

1. **Reduce waits**: Minimize `sleep()` calls
2. **Conditional details**: Fetch only when needed
3. **Caching**: Reuse data when possible
4. **Parallel operations**: Where safe (not implemented yet)

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
- Validates FleetIDs
- Handles missing planes gracefully
- Skips corrupted entries

### Retry Logic

**Not Implemented**: No automatic retries within tests.

**Handled by Schedule**: Failed run → next run in 30 min.

**Manual Retry**: Use `workflow_dispatch` to retry immediately.
