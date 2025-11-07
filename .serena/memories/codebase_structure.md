# Codebase Structure

## Root Directory Layout
```
Airline-Manager-4-Bot/
├── .github/workflows/     # GitHub Actions workflow definitions
├── .serena/               # Serena (MCP) memories
│   └── memories/         # Knowledge base markdown files
├── data/                  # Runtime data files (price history, planes data, cache)
├── docs/                  # Project documentation (currently empty)
├── scripts/               # PowerShell scripts for local development
├── tests/                 # Playwright test files
│   └── dev/              # Development/isolated tests
├── utils/                 # Utility classes organized by functionality
│   └── fleet/            # Fleet-specific utilities
├── .env                   # Environment configuration (local only, git-ignored)
├── .env.example           # Environment template with documentation
├── config.ts              # Central configuration (non-security settings only)
├── package.json           # Node.js dependencies and scripts
├── playwright.config.ts   # Playwright test configuration
├── tsconfig.json          # TypeScript compiler configuration
└── README.md              # User documentation
```

---

## Configuration Files

### `config.ts` - Central Configuration
**Purpose**: Single source of truth for all non-security configuration
- Type-safe configuration with exported types
- Sensible defaults for all operations
- Overridable via environment variables
- **DOES NOT CONTAIN**: Authentication credentials (security-critical)

**Sections**:
```typescript
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

**Usage**:
```typescript
import { BOT_CONFIG } from './config';
const maxFuel = BOT_CONFIG.fuel.maxFuelPrice;
```

**Design Pattern**: Configuration Object with Environment Override

### `.env` / `.env.example` - Environment Variables
**Purpose**: Security-critical configuration and local overrides
- Authentication credentials (EMAIL, PASSWORD)
- Environment-specific overrides for config.ts defaults
- **Git-ignored**: Never committed to repository

**Security Model**:
- Credentials read ONLY from `process.env.*` (not via config.ts)
- Never passed through config.ts
- No defaults for security-critical values
- Explicit error if missing

**Example** (`.env.example`):
```env
# ============================================
# Authentication (Required)
# ============================================
EMAIL=your-email@example.com
PASSWORD=your-password

# ============================================
# Fuel & CO2 Purchase Limits
# ============================================
MAX_FUEL_PRICE=550
MAX_CO2_PRICE=120

# ============================================
# Fleet Management Configuration
# ============================================
FLEET_PERCENTAGE=0.10
FLEET_MIN_DELAY=1000
FLEET_MAX_DELAY=2000
FLEET_MOCK_MODE=false
MAX_DEPARTURES_OVERRIDE=1
```

---

## Utils Directory Structure

**Pattern**: Numbered files (00-05) indicate logical execution order

### Core Utilities (`utils/`)

**00_general.utils.ts** - General utilities (login, sleep, page interactions)
- **Auth**: Reads EMAIL/PASSWORD directly from `process.env`
- Throws error if credentials missing
- `GeneralUtils` class with static helpers

**01_fuel.utils.ts** - Fuel & CO2 purchasing with chart scraping
- `FuelUtils` class
- Methods: `buyFuel()`, `buyCo2()`, `scrapeFuelChart()`, `scrapeCO2Chart()`
- Integrates with PriceAnalyticsUtils
- Chart scraping via Highcharts extraction

**02_campaign.utils.ts** - Campaign management (eco, reputation)
- `CampaignUtils` class
- Methods: `checkAndCreateEcoFriendlyCampaign()`, `checkAndCreateAirlineReputationCampaign()`
- Prevents duplicate campaigns

**03_maintenance.utils.ts** - Maintenance operations (repairs, A-Checks)
- `MaintenanceUtils` class
- Methods: `checkPlanes()`, `repairPlanes()`
- Automated repairs and scheduling

**04_fleet.utils.ts** - Fleet operations facade (RE-EXPORT FILE!)
- **Design Pattern**: Facade Pattern
- **Purpose**: Maintain numbered sequence (00-05) while organizing implementation in subdirectory
- **Content**: Re-exports from `utils/fleet/` subdirectory
```typescript
// Re-export all fleet-related utilities
export { SmartFleetUtils } from './fleet/smartFleetUtils';
export { FetchPlanesUtils } from './fleet/fetchPlanes.utils';
export { UpdatePlanesUtils } from './fleet/updatePlanes.utils';

// Re-export types and utilities
export * from './fleet/fleetTypes';
export * from './fleet/timestampUtils';
```

**Benefits of Facade**:
- Clean imports (users don't need subdirectory paths)
- Maintains chronological numbering
- Easy to extend (add new exports)

**05_priceAnalytics.utils.ts** - Price analytics engine
- `PriceAnalyticsUtils` class
- Methods: `addPriceEntry()`, `getStatistics()`, `shouldBuyNow()`, `generatePriceReport()`
- Historical tracking, trend detection, buy recommendations

### Fleet Subdirectory (`utils/fleet/`)

**Purpose**: Organize complex fleet management logic separately while maintaining clean imports

**smartFleetUtils.ts** (895 lines) - Main Smart Fleet orchestrator
- `SmartFleetUtils` class (27 methods)
- Unified workflow: depart + scrape in single pass
- Key methods:
  - `navigateToFleetOverview()` - Phase 1: Setup
  - `getFleetSizeAndCalculateLimit()` - Phase 2: Count & Calculate
  - `processLandedPlanes()` - Phase 3: Depart & Scrape (unified)
  - `saveCache()` / `loadCache()` - Cache management
  - `savePlanesData()` / `loadPlanesData()` - Data persistence
- Private methods:
  - `departPlanes()` - FIFO departure logic
  - `scrapeDepartedPlanes()` - Incremental scraping
  - `scrapeFlightHistoryIncremental()` - Smart history collection

**fetchPlanes.utils.ts** - Full plane data scraping (daily)
- `FetchPlanesUtils` class
- Method: `getAllPlanes(maxDetailsToFetch)` - Complete fleet scan
- Modes: -1 (basic), N (first N detailed), 0 (all detailed)
- Used by: `tests/dev/fetchPlanes.spec.ts` (daily 3am run)

**updatePlanes.utils.ts** - Legacy incremental updater (DEPRECATED)
- `UpdatePlanesUtils` class
- **Status**: ⚠️ Still exists but NOT used in workflows
- **Replaced by**: SmartFleetUtils (incremental updates built-in)
- **Migration Path**: Will be removed in future cleanup

**fleetTypes.ts** - TypeScript type definitions
- 9 comprehensive interfaces:
  - `FlightHistoryEntry` - Flight with timestamp precision
  - `DeliveredDate` - Delivery date with precision
  - `PlaneCurrentMetrics` - Current plane stats
  - `PlaneMetadata` - Scraping metadata
  - `PlaneData` - Complete plane record (main structure)
  - `FleetComposition` - Fleet distribution snapshot
  - `PlaneSnapshot` - Lightweight cache entry
  - `LastScrapeCache` - Cache file structure
  - `DepartureConfig` - Configuration interface
- **Design Pattern**: Data Transfer Objects (DTOs)

**timestampUtils.ts** (185 lines) - Timestamp conversion utilities
- `TimestampUtils` class (5 static methods)
- Key methods:
  - `convertRelativeToAbsolute()` - "5 hours ago" → ISO-8601
  - `roundToNearestSlot()` - Round to 30-min slot
  - `getCurrentTimeSlot()` - Get current slot
  - `isNewer()` - Compare timestamps
  - `generatePlaneHash()` - Change detection hash
- Types: `ConvertedTimestamp`, `PrecisionLevel`

**FLEET_SCRAPING_STRATEGY.md** - Comprehensive documentation
- Strategy guide (~850 lines, 16 sections)
- Core principles (FIFO, percentage-based, incremental)
- Execution phases detailed
- Performance characteristics
- Migration notes

---

## Test Files

**Pattern**: Production tests in `tests/`, development tests in `tests/dev/`

### Production Tests (`tests/`)

**airlineManager.spec.ts** - Main bot workflow (runs every 30 min)
- **Timeout**: 180 seconds (3 minutes for Smart Fleet)
- **Operations** (sequential):
  1. Login
  2. Fuel/CO2 purchase
  3. Campaign management
  4. Maintenance
  5. Smart Fleet operations (integrated!)
- **Output**: Updated price history, planes data, cache
- **Execution Time**: ~30-40 seconds (incremental)

### Development Tests (`tests/dev/`)

**Purpose**: Isolated testing with controlled configuration

**fetchPlanes.spec.ts** - Full fleet scan (daily 3am)
- **Timeout**: 180 seconds
- **Operation**: Complete fleet data collection
- **Configuration**: `getAllPlanes(5)` - first 5 planes detailed
- **Output**: Replaces `data/planes.json` entirely
- **Execution Time**: ~60 seconds (5 planes)
- **Used by**: Workflow (daily refresh)

**smartFleet.spec.ts** - Smart Fleet isolated test
- **Timeout**: 180 seconds
- **Purpose**: Development testing with override
- **Configuration**: `maxDeparturesOverride: 1` (always 1 plane)
- **Output**: Same as airlineManager.spec.ts (Smart Fleet section)
- **Execution Time**: ~10 seconds (predictable)
- **Usage**: Local development (`npm run test:smartFleet:headed`)

---

## Data Files (`data/`)

Runtime-generated, persisted via GitHub Actions artifacts:

**price-history.json** - Historical price data for analytics
- Structure: `PriceHistory` interface
- Content: Unified timeslot entries (fuel + CO2)
- Size: ~200 entries (trimmed automatically)
- Retention: 90 days (GitHub artifact)

**planes.json** - Aircraft fleet information
- Structure: `PlaneData[]` array
- Content: Complete fleet with flight history
- Size: ~1 entry per plane (~700 KB for 100 planes)
- Retention: 90 days (GitHub artifact)
- **Merge Strategy**: Deduplicates by timestamp, sorts newest-first

**last-scrape.json** - Smart Fleet cache (NEW!)
- Structure: `LastScrapeCache` interface
- Content: Fleet size, composition, plane snapshots
- Size: ~20 KB (100 planes)
- Retention: 90 days (GitHub artifact)
- **Purpose**: Avoid re-counting fleet, enable incremental scraping

**cookies.json** - Browser session cookies (legacy, optional)
- Purpose: Faster login (reuse session)
- Status: Not currently generated by new code
- May be removed in future

---

## GitHub Workflows (`.github/workflows/`)

**01_airlineManager.yml** - Main orchestration workflow
- **Schedule**: 
  - Every 30 minutes (:01, :31) → `airlineManager.spec.ts`
  - Daily 3am UTC → `tests/dev/fetchPlanes.spec.ts`
- **Artifacts**:
  - price-history (90 days)
  - planes-data (90 days)
  - smart-fleet-cache (90 days) ← NEW!
- **Environment**: Secrets + Variables → `.env`

---

## Scripts Directory (`scripts/`)

**run-local-workflow.ps1** - PowerShell workflow selector
- Interactive prompt for workflow selection
- Handles dependencies and browsers automatically
- Supports headless/headed modes
- Git operations for fetchPlanes workflow

---

## Directory Conventions

### Git-Ignored Directories
```
data/                 # Runtime data files
node_modules/         # Dependencies
playwright-report/    # Test reports
test-results/         # Test artifacts
.env                  # Local environment
```

### Committed Directories
```
.github/              # Workflows
.serena/              # Serena memories
scripts/              # Helper scripts
tests/                # All tests (production + dev)
utils/                # All utilities
```

### Empty Directories (Placeholders)
```
docs/                 # Future: Project documentation
```

---

## Import Patterns

### Clean Facade Imports
```typescript
// ✅ GOOD - Uses facade
import { SmartFleetUtils } from '../utils/04_fleet.utils';

// ❌ AVOID - Direct subdirectory import
import { SmartFleetUtils } from '../utils/fleet/smartFleetUtils';
```

**Why**: Facade pattern maintains clean API, easier refactoring

### Configuration Imports
```typescript
// ✅ GOOD - Centralized config
import { BOT_CONFIG } from '../config';
const maxFuel = BOT_CONFIG.fuel.maxFuelPrice;

// ❌ AVOID - Direct environment access (except for auth)
const maxFuel = parseInt(process.env.MAX_FUEL_PRICE || '550');
```

**Exception**: Authentication credentials (EMAIL, PASSWORD) read directly from `process.env`

### Type Imports
```typescript
// ✅ GOOD - Import types from facade
import { PlaneData, FleetComposition } from '../utils/04_fleet.utils';

// ✅ ALSO GOOD - Direct type import (types only)
import { PlaneData } from '../utils/fleet/fleetTypes';
```

---

## File Naming Conventions

### Utility Files
- **Pattern**: `{NN}_{feature}.utils.ts`
- **NN**: 00-05 (execution order)
- **Example**: `01_fuel.utils.ts`

### Fleet Subdirectory
- **Pattern**: `{feature}{Type}.ts` or `{feature}.utils.ts`
- **Examples**: 
  - `smartFleetUtils.ts` (main util)
  - `fleetTypes.ts` (types)
  - `timestampUtils.ts` (helper util)

### Test Files
- **Production**: `{feature}.spec.ts` in `tests/`
- **Development**: `{feature}.spec.ts` in `tests/dev/`
- **Example**: `tests/airlineManager.spec.ts`, `tests/dev/smartFleet.spec.ts`

---

## Codebase Size

### Lines of Code

| Category | Files | Approx Lines |
|----------|-------|--------------|
| Utils (core) | 6 | ~2,000 |
| Utils (fleet) | 4 | ~1,500 |
| Tests | 3 | ~300 |
| Config | 1 | ~50 |
| **Total** | **14** | **~3,850** |

### Key Files by Size

1. `smartFleetUtils.ts` - 895 lines (largest file)
2. `05_priceAnalytics.utils.ts` - ~560 lines
3. `01_fuel.utils.ts` - ~390 lines
4. `fetchPlanes.utils.ts` - ~420 lines
5. `timestampUtils.ts` - 185 lines

---

## Architecture Evolution

### Phase 1 (Original)
```
utils/
  ├── 00_general.utils.ts
  ├── 01_fuel.utils.ts
  ├── 02_campaign.utils.ts
  ├── 03_maintenance.utils.ts
  └── 04_fleet.utils.ts (simple "depart all" logic)

tests/
  ├── airlineManager.spec.ts
  └── updateStartedPlanes.spec.ts (separate workflow)
```

### Phase 2 (Smart Fleet Integration - Current)
```
utils/
  ├── 00_general.utils.ts
  ├── 01_fuel.utils.ts
  ├── 02_campaign.utils.ts
  ├── 03_maintenance.utils.ts
  ├── 04_fleet.utils.ts (FACADE - re-exports from fleet/)
  ├── 05_priceAnalytics.utils.ts
  └── fleet/
      ├── smartFleetUtils.ts (unified workflow)
      ├── fetchPlanes.utils.ts
      ├── updatePlanes.utils.ts (deprecated)
      ├── fleetTypes.ts
      ├── timestampUtils.ts
      └── FLEET_SCRAPING_STRATEGY.md

tests/
  ├── airlineManager.spec.ts (Smart Fleet integrated)
  └── dev/
      ├── fetchPlanes.spec.ts (daily full scan)
      └── smartFleet.spec.ts (isolated testing)

data/
  ├── price-history.json
  ├── planes.json
  └── last-scrape.json (cache)
```

**Key Changes**:
- ✅ Fleet utilities organized in subdirectory
- ✅ Facade pattern for clean imports
- ✅ Smart Fleet integrated into main workflow
- ✅ Development tests separated
- ✅ Cache-based optimization
- ❌ Removed: `updateStartedPlanes.spec.ts` (obsolete)

---

## Future Structure Plans

### Potential Reorganization
```
utils/
  ├── core/
  │   ├── general.utils.ts
  │   ├── fuel.utils.ts
  │   ├── campaign.utils.ts
  │   └── maintenance.utils.ts
  ├── fleet/
  │   └── (existing structure)
  └── analytics/
      └── priceAnalytics.utils.ts

config/
  ├── bot.config.ts
  ├── fleet.config.ts
  └── fuel.config.ts

docs/
  ├── architecture/
  ├── api/
  └── guides/
```

**Benefits**:
- Clearer categorization
- Easier navigation
- Scalable for new features

**Consideration**: Breaking change, requires import updates
