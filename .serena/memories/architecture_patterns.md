# Architecture Patterns and Design Guidelines

## Core Design Principles

### 1. Utility Class Pattern
All functionality is organized into utility classes:
- **Single Responsibility**: Each util class handles one domain
- **Stateful Design**: Classes maintain state (page reference, configuration)
- **Dependency Injection**: Page object and configuration passed via constructor

Example:
```typescript
export class FuelUtils {
    maxFuelPrice: number;
    maxCo2Price: number;
    page: Page;
    private priceAnalytics: PriceAnalyticsUtils;
    
    constructor(page: Page, maxFuelPrice: number, maxCo2Price: number, priceAnalytics: PriceAnalyticsUtils) {
        this.page = page;
        this.maxFuelPrice = maxFuelPrice;
        this.maxCo2Price = maxCo2Price;
        this.priceAnalytics = priceAnalytics;
    }
}
```

### 2. Sequential Execution Order
Utils are numbered to indicate logical execution sequence:
1. `00_general.utils.ts` - Login and setup (always first)
2. `01_fuel.utils.ts` - Fuel/CO2 purchase
3. `02_campaign.utils.ts` - Campaign management
4. `03_maintenance.utils.ts` - Maintenance operations
5. `04_fleet.utils.ts` - Fleet operations (Facade)
6. `05_priceAnalytics.utils.ts` - Analytics engine (used by others)

### 3. Facade Pattern (NEW!)

**Implementation**: `utils/04_fleet.utils.ts`

**Problem**: 
- Fleet management is complex (multiple classes, types, utilities)
- Users need clean imports without knowing subdirectory structure
- Want to maintain numbered sequence (00-05) for execution order

**Solution**: Facade file that re-exports from subdirectory

```typescript
// utils/04_fleet.utils.ts
export { SmartFleetUtils } from './fleet/smartFleetUtils';
export { FetchPlanesUtils } from './fleet/fetchPlanes.utils';
export { UpdatePlanesUtils } from './fleet/updatePlanes.utils';

// Re-export types and utilities
export * from './fleet/fleetTypes';
export * from './fleet/timestampUtils';
```

**Benefits**:
- ✅ Clean imports: `import { SmartFleetUtils } from '../utils/04_fleet.utils'`
- ✅ Maintains chronological numbering (00-05)
- ✅ Hides implementation details (users don't need to know subdirectory structure)
- ✅ Easy to extend (add new exports without changing imports)
- ✅ Single entry point for all fleet-related functionality

**Usage**:
```typescript
// ✅ GOOD - Uses facade
import { SmartFleetUtils, PlaneData } from '../utils/04_fleet.utils';

// ❌ AVOID - Direct subdirectory access
import { SmartFleetUtils } from '../utils/fleet/smartFleetUtils';
import { PlaneData } from '../utils/fleet/fleetTypes';
```

### 4. Page Object Pattern
Playwright's `Page` object is shared across utils:
- Passed to constructors
- Used for all browser interactions
- Enables navigation between game sections

### 5. Data Persistence Strategy
**File-based persistence with GitHub Actions artifacts**:
- Local files in `data/` directory during execution
- Uploaded as artifacts after workflow completion
- Downloaded before next workflow run
- Enables stateful behavior in stateless CI environment

---

## Smart Fleet Design Patterns

### 1. Unified Workflow Pattern

**Problem**: Old architecture had 2 separate workflows:
```
Bot Run → Depart ALL planes → started-flights.json
  ↓ (30 min later)
Separate Run → updateStartedPlanes → Update only started planes
```

**Solution**: Single unified workflow that handles everything in one pass

```typescript
// Smart Fleet Processing (unified)
public async processLandedPlanes(maxDepartures: number) {
  // Phase 3A: Depart planes
  const departedFleetIds = await this.departPlanes(maxDepartures);
  
  // Phase 3B: Immediately scrape departed planes
  const planesData = await this.scrapeDepartedPlanes(departedFleetIds);
  
  return { departedCount, planesData };
}
```

**Benefits**:
- ✅ Single workflow (simpler)
- ✅ No temporary tracking files
- ✅ Immediate data collection (no 30-min delay)
- ✅ Incremental updates built-in
- ✅ Easier to maintain

### 2. FIFO Queue Pattern

**Pattern**: Always process the TOP item from a queue

**Implementation**: Smart Fleet departure strategy

```typescript
while (departedCount < maxDepartures) {
  // ALWAYS take index 0 (the top/first plane)
  const row = landedRows.nth(0);
  
  // Extract Fleet ID
  const fleetId = extractFleetId(row);
  
  // Depart plane
  await row.click();
  await departButton.click();
  
  // Track departed
  departedFleetIds.push(fleetId);
  
  // Return to list (plane disappears, next one becomes index 0)
  await returnToListAfterDeparture();
}
```

**Key Insight**: After each departure, plane disappears from list → next plane automatically becomes index 0

**Benefits**:
- ✅ Fair rotation (no plane "starvation")
- ✅ Simple logic (no complex sorting)
- ✅ Natural queue behavior
- ✅ Matches user expectations

**Why NOT random or percentage of current landed**:
- ❌ Random: Could repeat same planes
- ❌ Percentage of landed: Unfair when many land at once
- ✅ FIFO of total fleet percentage: Predictable, fair, scalable

### 3. Percentage-Based Limiting Pattern

**Pattern**: Base limits on TOTAL resource count, not current availability

**Implementation**: Smart Fleet departure calculation

```typescript
// GOOD - Based on total fleet size
const totalFleetSize = 100;  // From cache or counted
const percentage = 0.10;     // 10%
const maxDepartures = Math.floor(totalFleetSize * percentage);  // 10 planes
const actualDepartures = Math.min(maxDepartures, currentLanded);  // Limited by availability

// With override (safety limit)
const finalDepartures = maxDeparturesOverride ?? actualDepartures;
```

**Why TOTAL fleet, not current landed**:
```
Scenario: 100-plane fleet, 10% strategy, 50 planes land at once

BAD (percentage of landed): 
  50 × 10% = 5 planes depart → Inconsistent behavior

GOOD (percentage of total):
  100 × 10% = 10 planes always → Predictable, fair
```

**Benefits**:
- ✅ Consistent behavior (same limit regardless of landing schedule)
- ✅ Fair distribution of flights
- ✅ Scales with fleet growth
- ✅ Predictable automation

### 4. Incremental Processing Pattern

**Pattern**: Track last known state, only process NEW data

**Implementation**: Smart Fleet flight history scraping

```typescript
// Cache stores last known flight per plane
const lastKnownTimestamp = cache.planesSnapshot[fleetId]?.lastFlightTimestamp;

// Scrape flights from top of history (newest first)
for (const flight of flightHistory) {
  if (TimestampUtils.isNewer(flight.timestamp, lastKnownTimestamp)) {
    newFlights.push(flight);  // NEW - add to data
  } else {
    break;  // OLD - stop scraping
  }
}
```

**Benefits**:
- ✅ 70% faster (1.5s vs 5s per plane)
- ✅ Reduces server load (fewer requests)
- ✅ Natural deduplication
- ✅ Works with pagination (always scrapes newest first)

**Key Requirements**:
1. Data must be **sorted** (newest first)
2. Must have **unique identifier** (timestamp)
3. Must be able to **stop early** (break on known data)

### 5. Cache-First Pattern

**Pattern**: Try cache first, fallback to expensive operation

**Implementation**: Smart Fleet fleet counting

```typescript
let totalFleetSize: number;
let fleetComposition: FleetComposition;

// Try cache first (fast path - ~1s)
const cache = this.loadCache();
if (cache && cache.totalFleetSize > 0) {
  console.log('Loading from cache');
  totalFleetSize = cache.totalFleetSize;
  fleetComposition = cache.fleetComposition;
} else {
  // Fallback: Count across all tabs (slow path - ~10s)
  console.log('First run - counting fleet');
  fleetComposition = await this.countFleetAcrossAllTabs();
  totalFleetSize = sumFleetComposition(fleetComposition);
}
```

**Benefits**:
- ✅ 90% faster when cache exists (1s vs 10s)
- ✅ Graceful degradation (works without cache)
- ✅ Automatic cache refresh (saved after each run)

**When to Use**:
- Expensive operations (counting, API calls)
- Data that changes infrequently
- Operations repeated across runs

### 6. Hash-Based Change Detection Pattern

**Pattern**: Generate lightweight hash to detect changes without deep comparison

**Implementation**: Smart Fleet plane snapshots

```typescript
// Generate hash from key fields
const hash = TimestampUtils.generatePlaneHash(
  registration,        // Can change (user edits)
  lastFlightTimestamp, // Changes with new flights
  totalFlights         // Changes with new flights
);

// Store in cache
planesSnapshot[fleetId] = {
  registration,
  lastFlightTimestamp,
  lastFlightRoute,
  totalFlights,
  hash  // ← Quick comparison
};

// Future: Skip scraping if hash unchanged
const cachedHash = cache.planesSnapshot[fleetId]?.hash;
const currentHash = generateHash(...);
if (cachedHash === currentHash) {
  console.log('No changes - skip scraping');
  continue;  // 50% further speedup!
}
```

**Benefits**:
- ✅ O(1) comparison (vs O(n) deep comparison)
- ✅ Detects all meaningful changes
- ✅ Lightweight (single string)
- ✅ Future optimization ready

**Hash Algorithm**:
```typescript
hash = MD5(registration + lastFlightTimestamp + totalFlights)
```

Simple but effective - any change to these fields → different hash.

### 7. Precision Tracking Pattern

**Pattern**: Store BOTH absolute value AND precision level

**Problem**: Timestamps from AM4 are imprecise:
- "5 hours ago" → precise to ~30 min slot
- "2 days ago" → precise to ~day
- "3 months ago" → precise to ~month

**Solution**: Dual storage with precision metadata

```typescript
interface ConvertedTimestamp {
  timestamp: string;        // Absolute ISO-8601 (for sorting)
  original: string;         // Original "5 hours ago" (for audit)
  precisionLevel: 'slot' | 'day' | 'week' | 'month' | 'year';  // Accuracy
}

// Convert "5 hours ago" → { timestamp, original, precisionLevel }
const converted = TimestampUtils.convertRelativeToAbsolute("5 hours ago");
// Returns: { 
//   timestamp: "2025-01-05T09:30:00.000Z", 
//   original: "5 hours ago",
//   precisionLevel: "slot"
// }
```

**Benefits**:
- ✅ Sortable (ISO-8601 timestamps)
- ✅ Deduplicatable (unique timestamps)
- ✅ Auditable (keep original text)
- ✅ Accuracy-aware (know precision level)

**Use Cases**:
- Flight history timestamps
- Delivery dates
- Any relative time display from game

---

## Configuration Management

### Two-Layer Configuration System

**Layer 1: Security-Critical (`.env` only)**
- Authentication credentials (EMAIL, PASSWORD)
- Read directly via `process.env.*`
- **NEVER** passed through config.ts
- No defaults (throws error if missing)
- Git-ignored, never committed

**Layer 2: General Settings (`config.ts` with .env overrides)**
- Non-security configuration
- Sensible defaults in code
- Overridable via environment variables
- Type-safe exports
- Committed to repository

### config.ts Structure

**Purpose**: Central configuration management
```typescript
import 'dotenv/config';

export const BOT_CONFIG = {
    fuel: {
        maxFuelPrice: parseInt(process.env.MAX_FUEL_PRICE || '550'),
        maxCo2Price: parseInt(process.env.MAX_CO2_PRICE || '120')
    },
    
    fleet: {
        percentage: parseFloat(process.env.FLEET_PERCENTAGE || '0.10'),
        minDelay: parseInt(process.env.FLEET_MIN_DELAY || '1000'),
        maxDelay: parseInt(process.env.FLEET_MAX_DELAY || '2000'),
        mockMode: process.env.FLEET_MOCK_MODE === 'true',
        maxDeparturesOverride: process.env.MAX_DEPARTURES_OVERRIDE 
            ? parseInt(process.env.MAX_DEPARTURES_OVERRIDE) 
            : 1  // Safe default: only 1 departure per run
    }
};

// Type exports for IDE support
export type BotConfig = typeof BOT_CONFIG;
export type FleetConfig = typeof BOT_CONFIG.fleet;
export type FuelConfig = typeof BOT_CONFIG.fuel;
```

**Benefits**:
- Single source of truth for non-security config
- Type-safe access throughout codebase
- Easy to extend for new features
- Clear separation of concerns
- Environment-specific overrides

**Usage Pattern**:
```typescript
import { BOT_CONFIG } from './config';

// In constructor or method
const maxFuel = BOT_CONFIG.fuel.maxFuelPrice;
const fleetPercent = BOT_CONFIG.fleet.percentage;
```

### Security Model

**Authentication Flow**:
```typescript
// In utils/00_general.utils.ts
import 'dotenv/config';  // Load .env variables

export class GeneralUtils {
    username: string;
    password: string;
    
    constructor(page: Page) {
        // Direct process.env access - NO config.ts
        if (!process.env.EMAIL || !process.env.PASSWORD) {
            console.error('ERROR: Umgebungsvariablen EMAIL oder PASSWORD fehlen!');
            console.error('Bitte erstelle eine .env Datei mit EMAIL und PASSWORD (siehe .env.example)');
            throw new Error('Missing required environment variables: EMAIL and/or PASSWORD');
        }
        this.username = process.env.EMAIL;
        this.password = process.env.PASSWORD;
        this.page = page;
    }
}
```

**Why This Matters**:
- Credentials never in committed code
- No accidental exposure in version control
- Clear error if .env missing
- Industry best practice

### Configuration Extension

**Adding New Config Section**:
```typescript
// 1. Add to config.ts
export const BOT_CONFIG = {
    // ... existing config
    
    newFeature: {
        enabled: process.env.NEW_FEATURE_ENABLED === 'true',
        threshold: parseInt(process.env.NEW_FEATURE_THRESHOLD || '100')
    }
};

// 2. Add type export
export type NewFeatureConfig = typeof BOT_CONFIG.newFeature;

// 3. Update .env.example
// NEW_FEATURE_ENABLED=false
// NEW_FEATURE_THRESHOLD=100

// 4. Use in code
import { BOT_CONFIG } from './config';
if (BOT_CONFIG.newFeature.enabled) {
    // Feature logic
}
```

---

## Key Architectural Components

### Price Analytics Engine (`PriceAnalyticsUtils`)
**Design**: Standalone analytics service
- Loads historical price data from JSON
- Provides statistical analysis (24h/7d averages, trends)
- Makes buy/no-buy recommendations
- Saves updated history after each run

**Integration**: Injected into `FuelUtils` for intelligent purchasing decisions

### Chart Scraping System
**Pattern**: Direct DOM manipulation to extract Highcharts data
- `extractHighchartsData()` - Generic chart data extraction
- `scrapeFuelChart()` - Fuel-specific scraping
- `scrapeCO2Chart()` - CO2-specific scraping
- Adds external data to PriceAnalytics via `addExternalPriceEntries()`

### Smart Fleet Management System

**Architecture**: Unified workflow with multiple design patterns

**Key Components**:
1. **SmartFleetUtils** (Main orchestrator)
   - Unified workflow (depart + scrape)
   - FIFO departure strategy
   - Incremental scraping
   - Cache management
   
2. **TimestampUtils** (Conversion utility)
   - Relative → absolute timestamps
   - Precision tracking
   - Slot-based rounding
   - Change detection hashing

3. **FetchPlanesUtils** (Full scan utility)
   - Complete fleet data collection
   - Used for daily refresh (3am UTC)

**Design Patterns Used**:
- ✅ Unified Workflow Pattern
- ✅ FIFO Queue Pattern
- ✅ Percentage-Based Limiting
- ✅ Incremental Processing
- ✅ Cache-First Pattern
- ✅ Hash-Based Change Detection
- ✅ Precision Tracking Pattern
- ✅ Facade Pattern (exports)

### Test File Organization
**Pattern**: One test per major workflow
- `airlineManager.spec.ts` - Main bot operations (Smart Fleet integrated)
- Development tests in `tests/dev/` directory
  - `fetchPlanes.spec.ts` - Daily full scan
  - `smartFleet.spec.ts` - Isolated Smart Fleet testing

---

## Error Handling Strategy

### Graceful Degradation
- Continue execution if non-critical operations fail
- Log errors for debugging
- Use try-catch around external operations (I/O, network)

### Emergency Mode
Example in `FuelUtils`:
- If fuel critically low, buy at higher prices
- Overrides normal analytics-based decisions
- Prevents game penalties

### Configuration Validation
```typescript
// GeneralUtils throws on missing credentials
if (!process.env.EMAIL || !process.env.PASSWORD) {
    throw new Error('Missing required environment variables');
}

// Config.ts provides defaults for non-critical settings
maxFuelPrice: parseInt(process.env.MAX_FUEL_PRICE || '550')
```

---

## Testing Philosophy

- **E2E Tests Only**: No unit tests, only full integration tests
- **Real Browser Automation**: Tests interact with actual game website
- **Headless by Default**: Visible browser available for debugging
- **Artifact Validation**: Tests verify data file creation and format
- **Development Isolation**: `tests/dev/` for controlled testing

---

## Safety Features

### 1. Global Departure Limit
**Default**: `MAX_DEPARTURES_OVERRIDE = 1`
- Only 1 plane departs per run unless explicitly configured
- Prevents accidental mass departures
- Users must consciously increase for higher throughput
- Overrides percentage-based calculation

**Configuration**:
```typescript
// config.ts
maxDeparturesOverride: process.env.MAX_DEPARTURES_OVERRIDE 
    ? parseInt(process.env.MAX_DEPARTURES_OVERRIDE) 
    : 1  // Conservative default
```

**Rationale**:
- Safety first: Avoid unintended automation
- Explicit opt-in for aggressive automation
- Balances automation with control

### 2. Mock Mode by Default
**Default**: `mockMode: true` in development

**Purpose**: Prevent real departures during testing

**Override**: Set `FLEET_MOCK_MODE=false` in production

### 3. Percentage-Based Limiting
**Benefit**: Prevents over-automation when many planes land at once

**Formula**: `maxDepartures = floor(totalFleetSize × percentage)`

### 4. FIFO Fairness
**Benefit**: All planes get equal flight time (no starvation)

**Mechanism**: Always depart top plane (natural rotation)

### 5. Incremental Scraping
**Benefit**: Reduces load on AM4 servers (fewer requests)

**Mechanism**: Stop scraping when reaching known data

---

## Extension Points

To add new functionality:
1. Create new util class (e.g., `06_newfeature.utils.ts`)
2. Follow constructor injection pattern
3. Add configuration to `config.ts` if needed
4. Add to main test orchestration (`airlineManager.spec.ts`)
5. Consider data persistence needs
6. Update `.env.example` with new variables
7. If complex, consider subdirectory with facade (like fleet/)

**Facade Pattern Example**:
```typescript
// utils/06_routes.utils.ts (facade)
export { RouteAnalyzer } from './routes/analyzer';
export { RouteOptimizer } from './routes/optimizer';
export * from './routes/types';
```

---

## Performance Optimization Patterns

### 1. Cache-First, Fallback-Second
```typescript
const cached = loadFromCache();
if (cached) return cached;

const fresh = await expensiveOperation();
saveToCache(fresh);
return fresh;
```

### 2. Incremental Processing
```typescript
const lastKnown = getLastProcessed();

for (const item of items) {
  if (isNewer(item, lastKnown)) {
    process(item);
  } else {
    break;  // Stop early
  }
}
```

### 3. Hash-Based Skip
```typescript
const cachedHash = getHash(item);
const currentHash = calculateHash(item);

if (cachedHash === currentHash) {
  continue;  // Skip unchanged
}

process(item);
```

### 4. Batch Operations
```typescript
// GOOD - Batch depart, then batch scrape
const departedIds = await departPlanes(maxCount);
const planesData = await scrapePlanes(departedIds);

// BAD - Interleave depart and scrape
for (const plane of planes) {
  await depart(plane);
  await scrape(plane);  // Unnecessary switching
}
```

---

## Anti-Patterns to Avoid

### ❌ Deep Directory Access
```typescript
// BAD
import { SmartFleetUtils } from '../utils/fleet/smartFleetUtils';

// GOOD - Use facade
import { SmartFleetUtils } from '../utils/04_fleet.utils';
```

### ❌ Configuration in Code
```typescript
// BAD
const maxDepartures = 10;  // Hardcoded

// GOOD - Use config
const maxDepartures = BOT_CONFIG.fleet.maxDeparturesOverride ?? calculated;
```

### ❌ Credentials in Config
```typescript
// BAD - Security risk!
export const BOT_CONFIG = {
  auth: {
    email: process.env.EMAIL || 'default@example.com'
  }
};

// GOOD - Direct access only
if (!process.env.EMAIL) throw new Error('EMAIL required');
const email = process.env.EMAIL;
```

### ❌ Polling Without Cache
```typescript
// BAD - Count fleet every time
const fleetSize = await countFleet();  // 10 seconds

// GOOD - Cache-first
const fleetSize = cache?.totalFleetSize ?? await countFleet();  // 1s or 10s
```

### ❌ Full Scraping Every Run
```typescript
// BAD - Scrape all flights always
const flights = await scrapeAllFlights(plane);  // 20 flights, 5s

// GOOD - Incremental scraping
const newFlights = await scrapeUntilKnown(plane, lastKnown);  // 1-2 flights, 1s
```

---

## Summary of Design Patterns Used

| Pattern | Location | Benefit |
|---------|----------|---------|
| Utility Class | All utils | Single responsibility, stateful |
| Facade | 04_fleet.utils.ts | Clean imports, hide complexity |
| Page Object | Shared `Page` | Browser interaction abstraction |
| Dependency Injection | All constructors | Testability, flexibility |
| Configuration Object | config.ts | Centralized, type-safe config |
| FIFO Queue | Smart Fleet departures | Fair rotation |
| Percentage-Based Limiting | Smart Fleet calculation | Consistent behavior |
| Incremental Processing | Flight history scraping | 70% speedup |
| Cache-First | Fleet counting | 90% speedup |
| Hash-Based Detection | Plane snapshots | O(1) comparison |
| Precision Tracking | Timestamps | Accuracy awareness |
| Unified Workflow | Smart Fleet | Simplicity, single pass |

**Philosophy**: Simple, predictable, maintainable, performant
