# Codebase Structure

## Root Directory Layout
```
Airline-Manager-4-Bot/
├── .github/workflows/     # GitHub Actions workflow definitions
├── data/                  # Runtime data files (price history, planes data)
├── scripts/               # PowerShell scripts for local development
├── tests/                 # Playwright test files
├── utils/                 # Utility classes organized by functionality
│   └── fleet/            # Fleet-specific utilities
├── .env                   # Environment configuration (local only)
├── package.json           # Node.js dependencies and scripts
├── playwright.config.ts   # Playwright test configuration
├── tsconfig.json          # TypeScript compiler configuration
└── README.md              # User documentation
```

## Utils Directory Structure
Organized numerically for logical execution order:

### Core Utilities (`utils/`)
- `00_general.utils.ts` - General utilities (login, sleep, page interactions)
- `01_fuel.utils.ts` - Fuel & CO2 purchasing with chart scraping
- `02_campaign.utils.ts` - Campaign management (eco, reputation)
- `03_maintenance.utils.ts` - Maintenance operations (repairs, A-Checks)
- `04_fleet.utils.ts` - Fleet operations (departures, plane tracking)
- `05_priceAnalytics.utils.ts` - Price analytics engine (history, statistics, trends)

### Fleet Subdirectory (`utils/fleet/`)
- `fetchPlanes.utils.ts` - Full plane data scraping (daily scan)
- `updatePlanes.utils.ts` - Incremental plane updates (started flights tracking)

## Test Files (`tests/`)
- `airlineManager.spec.ts` - Main bot workflow (runs every 30 min)
- `fetchPlanes.spec.ts` - Full plane data collection (daily 3am)
- `updateStartedPlanes.spec.ts` - Incremental plane updates (every 30 min)

## Data Files (`data/`)
Runtime-generated, persisted via GitHub Actions artifacts:
- `price-history.json` - Historical price data for analytics
- `planes.json` - Aircraft fleet information
- `started-flights.json` - In-flight tracking data

## GitHub Workflows (`.github/workflows/`)
- `01_airlineManager.yml` - Main orchestration workflow with scheduling
