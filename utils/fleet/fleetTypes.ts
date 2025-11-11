// TypeScript interfaces for Fleet Scraping Strategy

/**
 * Flight History Entry
 * Represents a single flight in a plane's history
 */
export interface FlightHistoryEntry {
    timestamp: string;                      // ISO-8601 absolute timestamp
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

/**
 * Delivered Date with precision tracking
 */
export interface DeliveredDate {
    timestamp: string;                      // ISO-8601 absolute timestamp
    original: string;                       // Original text like "6 months ago"
    precisionLevel: 'slot' | 'day' | 'week' | 'month' | 'year';
}

/**
 * Current metrics for a plane
 */
export interface PlaneCurrentMetrics {
    hoursToCheck: number | null;
    rangeKm: number | null;
    flightHours: number | null;
    flightCycles: number | null;
    minRunwayFt: number | null;
    wearPercent: number | null;
}

/**
 * Metadata about scraping
 */
export interface PlaneMetadata {
    lastScraped: string;                    // ISO-8601 timestamp
    lastFlightAdded: string | null;         // ISO-8601 timestamp of last flight added
    totalFlightsScrapped: number;
}

/**
 * Full plane data structure for planes.json
 */
export interface PlaneData {
    fleetId: string;
    registration: string;
    aircraftType: string | null;
    deliveredDate: DeliveredDate | null;
    currentMetrics: PlaneCurrentMetrics;
    flightHistory: FlightHistoryEntry[];
    metadata: PlaneMetadata;
}

/**
 * Fleet composition snapshot
 */
export interface FleetComposition {
    inflight: number;
    landed: number;
    parked: number;
    pending: number;
}

/**
 * Plane snapshot in last-scrape cache
 */
export interface PlaneSnapshot {
    registration: string;
    lastFlightTimestamp: string | null;     // ISO-8601
    lastFlightRoute: string | null;
    totalFlights: number;
    hash: string;                           // Simple hash for change detection
}

/**
 * Last scrape cache structure for incremental updates
 */
export interface LastScrapeCache {
    lastRunTimestamp: string;               // ISO-8601
    totalFleetSize: number;
    departurePercentage: number;            // e.g., 0.10 for 10%
    fleetComposition: FleetComposition;
    planesSnapshot: {
        [fleetId: string]: PlaneSnapshot;
    };
}

/**
 * Configuration for departure strategy
 */
export interface DepartureConfig {
    percentage: number;                     // e.g., 0.10 for 10%
    minDelay: number;                       // Min delay between actions (ms)
    maxDelay: number;                       // Max delay between actions (ms)
    mockMode: boolean;                      // If true, don't actually depart
    maxDeparturesOverride?: number;         // Optional: Override calculated max departures (hardcoded for testing)
}
