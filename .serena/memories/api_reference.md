# API Reference - Utils Classes

## PriceAnalyticsUtils

**Location**: `utils/05_priceAnalytics.utils.ts`

Intelligent price analysis and tracking system.

### Constructor
```typescript
constructor(maxHistoryEntries: number = 200)
```
- `maxHistoryEntries`: Maximum number of timeslot entries to keep (default: 200)

### Public Methods

#### loadHistory()
```typescript
public loadHistory(): PriceHistory
```
- Loads price history from `data/price-history.json`
- Auto-migrates from old format (separate fuel/co2 arrays)
- Creates new file if doesn't exist
- Returns PriceHistory object

#### saveHistory()
```typescript
public saveHistory(history: PriceHistory): void
```
- Saves price history to JSON file
- Updates `lastUpdated` timestamp
- Throws error on failure

#### addPriceEntry()
```typescript
public addPriceEntry(type: 'fuel' | 'co2', price: number): void
```
- Adds current price to history
- Rounds to 30-minute timeslot
- Updates existing timeslot or creates new one
- Auto-trims to maxHistoryEntries
- Use for real-time price tracking

#### addExternalPriceEntries()
```typescript
public addExternalPriceEntries(
  type: 'fuel' | 'co2',
  entries: Array<{ timestamp: string; price: number }>
): void
```
- Bulk import of external price data (e.g., from chart scraping)
- Merges with existing timeslots
- Sorts by timestamp and trims to max entries
- Use for historical data ingestion

#### getStatistics()
```typescript
public getStatistics(type: 'fuel' | 'co2', currentPrice: number): PriceStatistics
```
- Calculates comprehensive price statistics
- Returns 24h/7d averages, min/max, trend, recommendation, confidence
- Use for decision-making

#### shouldBuyNow()
```typescript
public shouldBuyNow(
  type: 'fuel' | 'co2',
  currentPrice: number,
  maxPrice: number,
  holding: number,
  emergencyThreshold: number
): { shouldBuy: boolean; reason: string; stats: PriceStatistics }
```
- Main decision engine for purchases
- Factors: price analysis, holdings, emergency threshold
- Returns buy decision + detailed reason + statistics
- Use as primary buy/wait logic

**Decision Logic**:
1. Emergency check: If holding < emergencyThreshold AND price < maxPrice * 2 → BUY
2. Intelligent check (if confidence ≥50%): Use statistical recommendation
3. Fallback: Simple threshold check (price < maxPrice)

#### checkDataQuality()
```typescript
public checkDataQuality(type: 'fuel' | 'co2'): number
```
- Returns data quality score 0-100
- Based on count, timespan, gap-free, day coverage
- Use to determine if enough data for intelligent decisions

#### generatePriceReport()
```typescript
public generatePriceReport(type: 'fuel' | 'co2'): string
```
- Generates formatted console report with emojis
- Includes all statistics and recommendation
- Use for logging/debugging

#### getData()
```typescript
public getData(type: 'fuel' | 'co2'): Array<{ timestamp: string }>
```
- Returns timeslot entries with valid prices for the type
- Use for gap analysis

---

## FuelUtils

**Location**: `utils/01_fuel.utils.ts`

Fuel and CO2 purchasing with intelligent price analysis.

### Constructor
```typescript
constructor(page: Page)
```
- Reads `MAX_FUEL_PRICE` and `MAX_CO2_PRICE` from env
- Initializes PriceAnalyticsUtils
- Logs max prices

### Public Methods

#### buyFuel()
```typescript
public async buyFuel(): Promise<void>
```
**Flow**:
1. Check if storage is full → skip if full
2. Get current price, holding, empty capacity
3. Scrape fuel chart data (first run only)
4. Use `priceAnalytics.shouldBuyNow()` for decision
5. If buy decision: Determine amount (emergency: 2M, normal: 5M)
6. Execute purchase: Fill input, click buy, confirm
7. Add current price to analytics history

**Emergency Logic**: If holding < 2M, buy 2M. Otherwise buy 5M.

**Chart Scraping**: Calls `scrapeFuelChart()` to extract historical data from Highcharts.

#### buyCo2()
```typescript
public async buyCo2(): Promise<void>
```
Same logic as `buyFuel()` but for CO2:
- Emergency threshold: 250k
- Emergency purchase: 250k
- Normal purchase: 1M
- Scrapes CO2 chart on first run

### Private Methods

#### scrapeFuelChart()
Extracts fuel price data from Highcharts DOM.

#### scrapeCO2Chart()
Extracts CO2 price data from Highcharts DOM.

#### extractHighchartsData()
Generic Highcharts data extractor used by both fuel/CO2 scrapers.

---

## FleetUtils

**Location**: `utils/04_fleet.utils.ts`

Fleet operations: automated departures and flight tracking.

### Constructor
```typescript
constructor(page: Page)
```

### Public Methods

#### departPlanes()
```typescript
public async departPlanes(): Promise<void>
```
**Flow**:
1. Navigate through all fleet pages (using pagination)
2. For each plane with "Depart" button:
   - Extract FleetID from detail page URL
   - Click "Depart All" button
   - Track FleetID in `startedFleetIds` array
3. After all pages: Save FleetIDs to `started-flights.json`

**FleetID Extraction**: Parses URL like `/route?id=123456` to get `123456`.

**Output**: Creates `started-flights.json` with `{ fleetIds: string[] }`.

---

## FetchPlanesUtils

**Location**: `utils/fleet/fetchPlanes.utils.ts`

Full fleet data collection with optional detailed scraping.

### Constructor
```typescript
constructor(page: Page)
```

### Public Methods

#### getAllPlanes()
```typescript
public async getAllPlanes(maxDetailsToFetch: number = 5): Promise<PlaneInfo[]>
```
**Parameters**:
- `5` (default): First 5 planes with details + flight history
- `0`: ALL planes with details (slow! ~1-2 min)
- `-1`: ONLY basic data, no details (fast! ~20 sec)

**Flow**:
1. Navigate to fleet page
2. Iterate through all pagination pages
3. For each plane row:
   - Extract basic info from list view
   - If details requested: Navigate to detail page, scrape full data
4. Return PlaneInfo[] array

**Performance**:
- Basic mode (~20 sec): Only list data
- Detail mode (~1-2 min): Opens each plane's detail page

---

## UpdatePlanesUtils

**Location**: `utils/fleet/updatePlanes.utils.ts`

Incremental plane updates for started flights.

### Constructor
```typescript
constructor(page: Page)
```

### Public Methods

#### updateSpecificPlanes()
```typescript
public async updateSpecificPlanes(fleetIds: string[]): Promise<PlaneInfo[]>
```
**Flow**:
1. Load existing `data/planes.json`
2. For each FleetID in input:
   - Find plane in existing data by FleetID
   - Navigate to detail page
   - Scrape updated flight data
   - Update entry in array
3. Save updated array to `data/planes.json`
4. Return updated planes

**Use Case**: Called by `updateStartedPlanes.spec.ts` after bot starts flights.

---

## CampaignUtils

**Location**: `utils/02_campaign.utils.ts`

Campaign management (eco-friendly, airline reputation).

### Constructor
```typescript
constructor(page: Page)
```

### Public Methods

#### checkAndCreateEcoFriendlyCampaign()
```typescript
public async checkAndCreateEcoFriendlyCampaign(): Promise<void>
```
- Checks if eco-friendly campaign is active
- Starts new campaign if not running

#### checkAndCreateAirlineReputationCampaign()
```typescript
public async checkAndCreateAirlineReputationCampaign(): Promise<void>
```
- Checks if reputation campaign is active
- Starts new campaign if not running

---

## MaintenanceUtils

**Location**: `utils/03_maintenance.utils.ts`

Aircraft maintenance operations.

### Constructor
```typescript
constructor(page: Page)
```

### Public Methods

#### checkPlanes()
```typescript
public async checkPlanes(): Promise<void>
```
- Checks planes for required maintenance

#### repairPlanes()
```typescript
public async repairPlanes(): Promise<void>
```
- Executes repairs on planes needing maintenance
- Handles both regular repairs and A-Checks

---

## GeneralUtils

**Location**: `utils/00_general.utils.ts`

General utilities: login, sleep, page interactions.

### Constructor
```typescript
constructor(page: Page)
```

### Public Methods

#### login()
```typescript
public async login(page: Page): Promise<void>
```
- Navigates to AM4 login page
- Reads `EMAIL` and `PASSWORD` from env
- Performs login
- Waits for successful authentication

### Static Methods

#### sleep()
```typescript
public static async sleep(ms: number): Promise<void>
```
- Async sleep utility
- Use for waiting between operations
