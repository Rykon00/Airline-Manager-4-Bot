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

### Fleet Data

#### FlightHistory
Historical flight data for a single flight.

```typescript
interface FlightHistory {
  timeAgo: string | null;            // e.g., "10 hours ago"
  route: string | null;              // e.g., "ELQ-FRA" (ICAO codes)
  routeName: string | null;          // e.g., "L-0008" (route management identifier)
  quotas: number | null;             // Quota points earned
  passengers: {
    economy: number | null;          // Y class passengers
    business: number | null;         // J class passengers
    first: number | null;            // F class passengers
    total: number | null;            // Total passengers
  };
  cargoWeightLbs: number | null;     // Cargo weight in pounds
  revenueUSD: number | null;         // Flight revenue in USD
}
```

#### PlaneInfo
Complete aircraft information from fleet management.

```typescript
interface PlaneInfo {
  // Unique Identifiers
  fleetId: string | null;           // PRIMARY KEY - never changes (e.g., "105960065")
  registration: string | null;      // User-changeable registration (e.g., "LU-002-2")
  detailPageUrl: string | null;     // URL to plane detail page

  // Basic Info
  aircraftType: string | null;      // Aircraft model (e.g., "Airbus A380-800")
  planeType: string | null;         // Size category (e.g., "Large", "Medium")
  delivered: string | null;         // Delivery date

  // Technical Specs
  range: string | null;             // Range in nm
  minRunway: string | null;         // Minimum runway length

  // Current Status
  rawRouteText: string | null;      // Raw route assignment text
  departureAirport: string | null;  // Current/home airport
  arrivalAirport: string | null;    // Destination (if flying)

  // Maintenance
  hoursToCheck: string | null;      // Hours until next check
  flightHoursCycles: string | null; // Total flight hours/cycles
  wear: string | null;              // Wear percentage

  // Optional Details (only if details fetched)
  flightHistory?: FlightHistory[];  // Historical flights
  error?: string;                   // Error message if fetch failed
}
```

**Data Collection Modes** (via `fetchPlanes.utils.ts`):
- `maxDetailsToFetch = 5` (default): First 5 planes with full details + history
- `maxDetailsToFetch = 0`: ALL planes with details (slow! ~1-2 min)
- `maxDetailsToFetch = -1`: ONLY basic data, no details (fast! ~20 sec)

**Storage**:
- `data/planes.json` - Full fleet data
- Updated via `fetchPlanes.spec.ts` (daily at 3am)
- Incrementally updated via `updateStartedPlanes.spec.ts` (every 30 min)

### Runtime Tracking Data

#### StartedFlights
Temporary tracking file for incremental updates.

```typescript
interface StartedFlights {
  fleetIds: string[];  // Array of FleetIDs that were started by the bot
}
```

**Lifecycle**:
- Created by `FleetUtils.departPlanes()` when flights are started
- Written to `started-flights.json` in project root
- Read by `updateStartedPlanes.spec.ts` to determine which planes to update
- Deleted after successful incremental update
- Uploaded as GitHub Actions artifact for debugging (7-day retention)

## File Locations

### Data Directory (`data/`)
- `price-history.json` - PriceHistory object
- `planes.json` - PlaneInfo[] array

### Root Directory
- `started-flights.json` - StartedFlights object (temporary)

### GitHub Actions Artifacts
All artifacts use `actions/upload-artifact@v4`:
- **price-history** (90 days): `data/price-history.json`
- **planes-data** (90 days): `data/planes.json`
- **started-flights** (7 days): `started-flights.json` (debug only)

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

## Data Migration

### Old Format → New Format
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
