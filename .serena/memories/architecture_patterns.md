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
5. `04_fleet.utils.ts` - Fleet operations
6. `05_priceAnalytics.utils.ts` - Analytics engine (used by others)

### 3. Page Object Pattern
Playwright's `Page` object is shared across utils:
- Passed to constructors
- Used for all browser interactions
- Enables navigation between game sections

### 4. Data Persistence Strategy
**File-based persistence with GitHub Actions artifacts**:
- Local files in `data/` directory during execution
- Uploaded as artifacts after workflow completion
- Downloaded before next workflow run
- Enables stateful behavior in stateless CI environment

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

### Fleet Management
**Two-tier approach**:
1. **Full Scan** (`FetchPlanesUtils`): Complete fleet data collection (daily)
2. **Incremental Update** (`UpdatePlanesUtils`): Track started flights only (every 30 min)

**Rationale**: Reduces execution time for frequent runs while maintaining data freshness

### Test File Organization
**Pattern**: One test per major workflow
- `airlineManager.spec.ts` - Main bot operations (sequential util calls)
- `fetchPlanes.spec.ts` - Full data collection
- `updateStartedPlanes.spec.ts` - Incremental tracking

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

## Configuration Management

### Environment-based Configuration
- `.env` file for local development
- GitHub Secrets/Variables for CI
- Runtime injection via constructors

### Hardcoded Constants
Used for game-specific thresholds:
- Emergency purchase thresholds
- Confidence levels for buy decisions
- Retry limits

## Testing Philosophy
- **E2E Tests Only**: No unit tests, only full integration tests
- **Real Browser Automation**: Tests interact with actual game website
- **Headless by Default**: Visible browser available for debugging
- **Artifact Validation**: Tests verify data file creation and format

## Extension Points
To add new functionality:
1. Create new util class (e.g., `06_newfeature.utils.ts`)
2. Follow constructor injection pattern
3. Add to main test orchestration (`airlineManager.spec.ts`)
4. Consider data persistence needs
