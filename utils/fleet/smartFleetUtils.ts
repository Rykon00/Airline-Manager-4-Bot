import { Page, Locator } from "@playwright/test";
import { GeneralUtils } from '../00_general.utils';
import { TimestampUtils } from './timestampUtils';
import {
    PlaneData,
    FlightHistoryEntry,
    LastScrapeCache,
    FleetComposition,
    PlaneSnapshot,
    DepartureConfig,
    PlaneCurrentMetrics,
    DeliveredDate
} from './fleetTypes';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Smart Fleet Management Utilities
 * Implements the Fleet-Based Departure Limiting Strategy
 * See: utils/fleet/FLEET_SCRAPING_STRATEGY.md
 */
export class SmartFleetUtils {
    private page: Page;
    private cacheFilePath: string;
    private planesDataFilePath: string;
    private departureConfig: DepartureConfig;
    private testStartTime: number;
    private testTimeout: number;

    constructor(
        page: Page,
        config: Partial<DepartureConfig> = {},
        testTimeout: number = 180000 // Default 3 minutes (from airlineManager.spec.ts)
    ) {
        this.page = page;
        this.testStartTime = Date.now();
        this.testTimeout = testTimeout;
        this.cacheFilePath = path.join(process.cwd(), 'data', 'last-scrape.json');
        this.planesDataFilePath = path.join(process.cwd(), 'data', 'planes.json');

        // Default configuration
        this.departureConfig = {
            percentage: config.percentage || 0.10,  // 10% default
            minDelay: config.minDelay || 1000,      // 1 second
            maxDelay: config.maxDelay || 2000,      // 2 seconds
            mockMode: config.mockMode !== undefined ? config.mockMode : true,  // SAFE: Mock by default!
            maxDeparturesOverride: config.maxDeparturesOverride  // Optional override
        };
    }

    /**
     * Parse ingame time like "2h 15m ago" or "1d 3h ago" to hours
     * @param timeText Text like "2h 15m ago"
     * @returns Hours as float (e.g., 2.25)
     */
    private parseIngameTime(timeText: string): number {
        // Extract numbers before 'd', 'h', 'm'
        const dayMatch = timeText.match(/(\d+)d/);
        const hourMatch = timeText.match(/(\d+)h/);
        const minMatch = timeText.match(/(\d+)m/);

        const days = dayMatch ? parseInt(dayMatch[1]) : 0;
        const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
        const minutes = minMatch ? parseInt(minMatch[1]) : 0;

        // Convert all to hours
        return days * 24 + hours + minutes / 60;
    }

    /**
     * Extract departure time from sidebar row text
     * Sidebar shows: "Registration Percent% HH:MM:SS"
     * Example: " LU-002-232.07%00:59:27"
     * Where Percent = flight progress, HH:MM:SS = remaining time until landing
     * @param rowText Full text content of the row
     * @returns Formatted time string like "27 hours ago" or null if not found
     */
    private extractDepartureTime(rowText: string): string | null {
        // Pattern: Percentage (e.g., "32.07%") followed by remaining time (e.g., "00:59:27")
        // Use negative lookbehind to ensure percentage doesn't start with a digit (avoid matching "232.07%" from "LU-002-2")
        const pattern = /(?<!\d)(\d+(?:\.\d+)?)%(\d{2}):(\d{2}):(\d{2})/;
        const match = rowText.match(pattern);

        if (!match) return null;

        const percentComplete = parseFloat(match[1]);
        const remainingHours = parseInt(match[2]);
        const remainingMinutes = parseInt(match[3]);
        const remainingSeconds = parseInt(match[4]);

        // Calculate remaining time in hours
        const remainingTimeHours = remainingHours + remainingMinutes / 60 + remainingSeconds / 3600;

        // Calculate total flight duration
        // If X% is complete and Y hours remain, then total = Y / (1 - X/100)
        const percentRemaining = 100 - percentComplete;
        if (percentRemaining <= 0) {
            // Flight is complete or landing, can't calculate
            return null;
        }

        const totalFlightHours = remainingTimeHours / (percentRemaining / 100);

        // Calculate elapsed time (how long ago departure was)
        const elapsedHours = totalFlightHours * (percentComplete / 100);

        // Format for TimestampUtils.convertRelativeToAbsolute()
        if (elapsedHours >= 24) {
            const elapsedDays = Math.floor(elapsedHours / 24);
            return `${elapsedDays} day${elapsedDays > 1 ? 's' : ''} ago`;
        } else if (elapsedHours >= 1) {
            const hours = Math.floor(elapsedHours);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            // Less than 1 hour, round up
            return `1 hour ago`;
        }
    }

    /**
     * Check if there's enough time remaining before test timeout
     * @param bufferMs Buffer time in milliseconds (default 10 seconds)
     * @returns true if enough time remains
     */
    private hasTimeRemaining(bufferMs: number = 10000): boolean {
        const elapsed = Date.now() - this.testStartTime;
        const remaining = this.testTimeout - elapsed;
        return remaining > bufferMs;
    }

    /**
     * Get remaining time in milliseconds
     * @returns Remaining time before timeout
     */
    private getRemainingTime(): number {
        const elapsed = Date.now() - this.testStartTime;
        return this.testTimeout - elapsed;
    }

    /**
     * Check if we have enough time to continue safely
     * @param minRequired Minimum time required in milliseconds (default 30 seconds)
     * @returns true if we have enough time to continue
     */
    private canContinueSafely(minRequired: number = 30000): boolean {
        const remaining = this.getRemainingTime();
        return remaining > minRequired;
    }

    /**
     * PHASE 1: Initial Setup
     * Navigate to fleet overview and ensure landed tab is active
     */
    public async navigateToFleetOverview(): Promise<void> {
        console.log('📍 Phase 1: Initial Setup - Ensuring Fleet Sidebar is ready');

        // The fleet sidebar on the left is already visible by default!
        // We just need to ensure we're on the "Landed" tab

        // Click the "Landed" tab button at the bottom of the sidebar
        const landedButton = this.page.locator('#flightStatusLanded');

        // Check if it exists and is visible
        if (await landedButton.count() > 0) {
            await landedButton.click();
            await GeneralUtils.sleep(1000);
            console.log('✅ Landed tab activated');
        } else {
            console.log('⚠️ Fleet sidebar not found - trying to open it...');
            // Fallback: Click Overview tab to ensure sidebar is visible
            await this.page.locator('button:has-text("Overview")').first().click();
            await GeneralUtils.sleep(1000);

            // Try clicking Landed tab again
            await this.page.locator('#flightStatusLanded').click();
            await GeneralUtils.sleep(1000);
            console.log('✅ Fleet sidebar opened and Landed tab activated');
        }
    }

    /**
     * PHASE 2: Count & Calculate
     * Get total fleet size and calculate departure limit
     */
    public async getFleetSizeAndCalculateLimit(): Promise<{
        totalFleetSize: number;
        fleetComposition: FleetComposition;
        currentLanded: number;
        maxDepartures: number;
    }> {
        console.log('📊 Phase 2: Count & Calculate');

        let totalFleetSize: number;
        let fleetComposition: FleetComposition;

        // Try to load from cache first
        const cache = this.loadCache();

        if (cache && cache.totalFleetSize > 0) {
            console.log(`✅ Loading fleet size from cache: ${cache.totalFleetSize} planes`);
            totalFleetSize = cache.totalFleetSize;
            fleetComposition = cache.fleetComposition;
        } else {
            console.log('🔄 First run - counting fleet across all tabs...');
            fleetComposition = await this.countFleetAcrossAllTabs();
            totalFleetSize =
                fleetComposition.inflight +
                fleetComposition.landed +
                fleetComposition.parked +
                fleetComposition.pending;

            console.log(`✅ Total fleet size: ${totalFleetSize}`);
            console.log(`   - Inflight: ${fleetComposition.inflight}`);
            console.log(`   - Landed: ${fleetComposition.landed}`);
            console.log(`   - Parked: ${fleetComposition.parked}`);
            console.log(`   - Pending: ${fleetComposition.pending}`);
        }

        // Count current landed planes
        const currentLanded = await this.countLandedPlanes();
        console.log(`✅ Currently landed: ${currentLanded} planes`);

        // Calculate departure limit based on TOTAL FLEET SIZE
        const calculatedMax = Math.floor(totalFleetSize * this.departureConfig.percentage);

        // Apply override if configured
        const maxDepartures = this.departureConfig.maxDeparturesOverride ?? calculatedMax;
        const actualDepartures = Math.min(maxDepartures, currentLanded);

        console.log(`📈 Departure calculation:`);
        console.log(`   - Strategy: ${(this.departureConfig.percentage * 100).toFixed(0)}% of total fleet`);
        console.log(`   - Calculated max: ${calculatedMax} (${(this.departureConfig.percentage * 100).toFixed(0)}% × ${totalFleetSize})`);
        if (this.departureConfig.maxDeparturesOverride !== undefined) {
            console.log(`   - ⚙️  OVERRIDE active: ${this.departureConfig.maxDeparturesOverride} departures (ignoring percentage)`);
        }
        console.log(`   - Max departures: ${maxDepartures}`);
        console.log(`   - Actual departures: ${actualDepartures} (limited by landed: ${currentLanded})`);

        return {
            totalFleetSize,
            fleetComposition,
            currentLanded,
            maxDepartures: actualDepartures
        };
    }

    /**
     * Count planes across all tabs (Inflight, Landed, Parked, Pending)
     */
    private async countFleetAcrossAllTabs(): Promise<FleetComposition> {
        const composition: FleetComposition = {
            inflight: 0,
            landed: 0,
            parked: 0,
            pending: 0
        };

        // Tab button IDs
        const tabs = [
            { name: 'inflight', buttonId: '#flightStatusInflight', listId: '#inflightList' },
            { name: 'landed', buttonId: '#flightStatusLanded', listId: '#landedList' },
            { name: 'parked', buttonId: '#flightStatusParked', listId: '#parkedList' },
            { name: 'pending', buttonId: '#flightStatusPending', listId: '#pendingList' }
        ];

        for (const tab of tabs) {
            try {
                // Click tab button
                await this.page.locator(tab.buttonId).click();
                await GeneralUtils.sleep(1000);

                // Count planes in that tab's list (.flight-list-sorting elements)
                const planeRows = this.page.locator(`${tab.listId} .flight-list-sorting`);
                const count = await planeRows.count();

                composition[tab.name as keyof FleetComposition] = count;
                console.log(`   ${tab.name}: ${count} planes`);
            } catch (error) {
                console.error(`Error counting ${tab.name} tab:`, error);
            }
        }

        // Return to Landed tab
        await this.page.locator('#flightStatusLanded').click();
        await GeneralUtils.sleep(500);

        return composition;
    }

    /**
     * Count currently landed planes (visible in Landed tab)
     */
    private async countLandedPlanes(): Promise<number> {
        const landedRows = this.page.locator('#landedList .flight-list-sorting');
        return await landedRows.count();
    }

    /**
     * PHASE 3A: Depart planes AND immediately scrape them
     * OPTIMIZED: Scrape directly after departure while sidebar is still open
     * This avoids opening each plane's detail page twice!
     */
    private async departAndScrapePlanes(maxDepartures: number): Promise<{ planesData: PlaneData[], timedOut: boolean }> {
        console.log(`\n🛫 Phase 3A: DEPARTING and SCRAPING planes (max: ${maxDepartures})`);

        const cache = this.loadCache();
        const planesData: PlaneData[] = [];
        let timedOut = false;

        // Use a while loop with counter to ensure we stop after maxDepartures successful departures
        let attempts = 0;
        const maxAttempts = maxDepartures * 3; // Safety: max 3 attempts per desired departure

        while (planesData.length < maxDepartures && attempts < maxAttempts) {
            attempts++;

            // ⏰ Check if we have at least 30s remaining before starting another plane
            if (!this.canContinueSafely(30000)) {
                console.log(`⏰ Less than 30s remaining (${Math.round(this.getRemainingTime() / 1000)}s left) - stopping departures to ensure safe data save`);
                timedOut = true;
                break;
            }

            try {
                // ALWAYS take the FIRST (top) plane from the list (FIFO)
                const landedRows = this.page.locator('#landedList .flight-list-sorting');
                const currentCount = await landedRows.count();

                if (currentCount === 0) {
                    console.log('📭 No more landed planes available');
                    break;
                }

                // ALWAYS take index 0 (the top/first plane in the list)
                const row = landedRows.nth(0);

                // Extract fleet ID from row ID (format: flightStatus{FLEETID})
                const rowId = await row.getAttribute('id');
                if (!rowId || !rowId.startsWith('flightStatus')) {
                    continue;
                }

                const fleetId = rowId.replace('flightStatus', '');

                // Extract registration from span (format: flightStatusReg{FLEETID})
                const regSpan = this.page.locator(`#flightStatusReg${fleetId}`);
                const registration = await regSpan.textContent();

                if (!fleetId) {
                    continue;
                }

                // Click plane row to open detail panel
                await row.click();
                await GeneralUtils.sleep(1500);

                // Click "Depart" button
                const departButton = this.page.locator('button:has-text("Depart")').first();
                if (await departButton.count() > 0) {
                    await departButton.click();
                    await GeneralUtils.sleep(2000);

                    console.log(`✅ Departed ${registration || fleetId}`);

                    // === OPTIMIZATION: Scrape IMMEDIATELY while sidebar is still open! ===
                    // The sidebar panel is still showing this plane - we can directly click "Details"

                    // Scrape panel data first
                    const panelData = await this.scrapePanelData(fleetId, registration || 'Unknown');

                    // Click "Details" button to open full page
                    const detailsButton = this.page.locator('button:has-text("Details")').first();
                    if (await detailsButton.count() > 0) {
                        await detailsButton.click();

                        // Wait for popup to load
                        await this.page.locator('#popup .modal-content').waitFor({ state: 'visible', timeout: 10000 });
                        await GeneralUtils.sleep(500);

                        // Scrape detail page
                        const detailPageData = await this.scrapeDetailPage(fleetId, registration || 'Unknown', cache);

                        // Merge data
                        const mergedData: PlaneData = {
                            ...panelData,
                            ...detailPageData,
                            fleetId,
                            registration: registration || 'Unknown',
                            metadata: {
                                lastScraped: new Date().toISOString(),
                                lastFlightAdded: detailPageData.flightHistory.length > 0
                                    ? detailPageData.flightHistory[0].timestamp
                                    : null,
                                totalFlightsScrapped: detailPageData.flightHistory.length
                            }
                        };

                        planesData.push(mergedData);
                        console.log(`   📊 Scraped ${registration || fleetId} (${detailPageData.flightHistory.length} flights)`);

                        // Close detail page popup
                        await this.closeDetailPagePopup();
                    }

                    // Return to list
                    await this.returnToListAfterDeparture();
                } else {
                    // No depart button found, return to list anyway
                    await this.returnToListAfterDeparture();
                }

                // ⏰ Check time after completing this plane - stop if < 30s remaining
                if (!this.canContinueSafely(30000)) {
                    console.log(`⏰ Less than 30s remaining after scraping ${registration || fleetId} (${Math.round(this.getRemainingTime() / 1000)}s left) - stopping to ensure safe data save`);
                    timedOut = true;
                    break;
                }

                // Check if we've reached the limit
                if (planesData.length >= maxDepartures) {
                    break;
                }

                // Delay between departures
                const delay = Math.random() * (this.departureConfig.maxDelay - this.departureConfig.minDelay)
                    + this.departureConfig.minDelay;
                await GeneralUtils.sleep(delay);

            } catch (error) {
                console.error(`❌ Error departing/scraping plane (attempt ${attempts}):`, error);
            }
        }

        console.log(`✅ Departed and scraped ${planesData.length} planes`);

        return { planesData, timedOut };
    }

    /**
     * PHASE 3B (formerly 3C): Scrape remaining inflight planes intelligently
     * Only scrapes planes that likely have new flights AND weren't just departed
     * NOTE: Assumes we are already in the Inflight tab!
     * @param maxToScrape Maximum number of planes to scrape (for time management)
     */
    private async scrapeRemainingInflightPlanes(
        alreadyScrapedIds: string[],
        cache: LastScrapeCache | null,
        maxToScrape?: number
    ): Promise<{ planesData: PlaneData[], timedOut: boolean }> {
        console.log(`\n🔍 Phase 3B: SCRAPING remaining inflight planes (excluding just-departed ones)`);
        if (maxToScrape !== undefined) {
            console.log(`   ⏱️  Time-limited: Will scrape max ${maxToScrape} planes`);
        }

        const planesData: PlaneData[] = [];
        let timedOut = false;

        // Load existing planes data to compare timestamps
        const existingPlanes = this.loadPlanesData();
        console.log(`   Loaded ${existingPlanes.length} existing plane records`);

        // Get all plane rows in Inflight list
        const allRows = this.page.locator('#inflightList .flight-list-sorting');
        const rowCount = await allRows.count();

        console.log(`   Found ${rowCount} planes currently inflight`);

        // Collect planes that need scraping
        const toScrape: Array<{ fleetId: string; registration: string; departureTime: string; hoursSinceDeparture: number }> = [];

        for (let i = 0; i < rowCount; i++) {
            try {
                const row = allRows.nth(i);
                const rowId = await row.getAttribute('id');

                if (!rowId || !rowId.startsWith('flightStatus')) continue;

                const fleetId = rowId.replace('flightStatus', '');

                // Skip if already scraped in this run
                if (alreadyScrapedIds.includes(fleetId)) {
                    continue;
                }

                // Get registration
                const regSpan = this.page.locator(`#flightStatusReg${fleetId}`);
                const registration = await regSpan.textContent();

                // Extract departure time from sidebar (visible WITHOUT clicking!)
                const rowText = await row.textContent();
                const departureTimeText = this.extractDepartureTime(rowText || '');

                let sidebarDepartureTimestamp: string | null = null;
                let hoursSinceDeparture = 0;

                if (departureTimeText) {
                    // Convert relative time to absolute ISO timestamp
                    const converted = TimestampUtils.convertRelativeToAbsolute(departureTimeText);
                    sidebarDepartureTimestamp = converted.timestamp;

                    // Calculate hours since departure
                    const departureDate = new Date(sidebarDepartureTimestamp);
                    const now = new Date();
                    hoursSinceDeparture = (now.getTime() - departureDate.getTime()) / (1000 * 60 * 60);
                }

                // Find this plane in existing data
                const existingPlane = existingPlanes.find(p => p.fleetId === fleetId);

                // SMART Decision logic:
                // 1. New plane (not in data) -> SCRAPE
                // 2. Plane in data + sidebar shows NEWER departure than last known flight -> SCRAPE (new flight!)
                // 3. Plane in data but no sidebar time available + last scraped 8+ hours ago -> SCRAPE (fallback)
                // 4. Otherwise -> SKIP

                let shouldScrape = false;
                let reason = '';

                if (!existingPlane) {
                    // NEW PLANE - never seen before!
                    shouldScrape = true;
                    reason = 'New plane';
                    console.log(`      ✅ SCRAPE: ${reason}`);
                    toScrape.push({
                        fleetId,
                        registration: registration || 'Unknown',
                        departureTime: departureTimeText || reason,
                        hoursSinceDeparture: hoursSinceDeparture || 999
                    });
                } else if (sidebarDepartureTimestamp && existingPlane.flightHistory && existingPlane.flightHistory.length > 0) {
                    // Compare sidebar departure time with last known flight
                    const lastKnownFlight = existingPlane.flightHistory[0].timestamp;

                    if (TimestampUtils.isNewer(sidebarDepartureTimestamp, lastKnownFlight)) {
                        // Sidebar shows NEWER departure than our last known flight -> NEW FLIGHT!
                        shouldScrape = true;
                        reason = `New flight detected!`;
                        console.log(`      ✅ SCRAPE: Sidebar departure (${new Date(sidebarDepartureTimestamp).toLocaleString()}) > Last known flight (${new Date(lastKnownFlight).toLocaleString()})`);
                        toScrape.push({
                            fleetId,
                            registration: registration || 'Unknown',
                            departureTime: departureTimeText || reason,
                            hoursSinceDeparture
                        });
                    } else {
                        console.log(`      ⏭️  SKIP: Sidebar departure <= last known flight`);
                    }
                } else {
                    // No sidebar time OR no flight history → can't determine if new flight, SKIP
                    console.log(`      ⏭️  SKIP: Cannot determine if new flight (no sidebar time or no flight history)`);
                }

            } catch (err) {
                console.error(`Error analyzing plane ${i}:`, err);
            }
        }

        // Sort by departure time (oldest first = highest priority)
        toScrape.sort((a, b) => b.hoursSinceDeparture - a.hoursSinceDeparture);

        // Apply time-based limit if specified
        let planesToScrape = toScrape;
        if (maxToScrape !== undefined && toScrape.length > maxToScrape) {
            console.log(`   📋 Found ${toScrape.length} planes to scrape`);
            console.log(`   ⏱️  Limiting to ${maxToScrape} planes due to time constraints`);
            planesToScrape = toScrape.slice(0, maxToScrape);
        } else {
            console.log(`   📋 Need to scrape: ${toScrape.length} planes (new or with new flights)`);
        }

        // Hide game ad that blocks clicks
        try {
            await this.page.evaluate(() => {
                const ad = document.querySelector('#game-ad');
                if (ad) {
                    (ad as HTMLElement).style.display = 'none';
                    (ad as HTMLElement).style.visibility = 'hidden';
                    (ad as HTMLElement).style.pointerEvents = 'none';
                }
            });
        } catch (err) {
            // Ignore if ad doesn't exist
        }

        // Now scrape the filtered planes (with time-check during execution)
        for (const plane of planesToScrape) {
            try {
                // ⏰ Time-check BEFORE each scrape - require 30s buffer for safe completion
                if (!this.canContinueSafely(30000)) {
                    console.log(`   ⏰ Less than 30s remaining (${Math.round(this.getRemainingTime() / 1000)}s left) - stopping additional scrapes to ensure safe data save`);
                    console.log(`   Scraped ${planesData.length}/${planesToScrape.length} additional planes before timeout`);
                    timedOut = true;
                    break;
                }

                const row = this.page.locator(`#inflightList #flightStatus${plane.fleetId}`);

                if (await row.count() === 0) {
                    continue;
                }

                // Click plane row to open detail panel (force to bypass ad)
                await row.click({ force: true });
                await GeneralUtils.sleep(1500); // Wait for panel animation

                // Scrape panel data (NO waitFor - just like departure!)
                const panelData = await this.scrapePanelData(plane.fleetId, plane.registration);

                // Click "Details" button to open full page
                const detailsButton = this.page.locator('button:has-text("Details")').first();
                if (await detailsButton.count() > 0) {
                    await detailsButton.click();

                    // Wait for popup to load (instead of blind sleep)
                    await this.page.locator('#popup .modal-content').waitFor({ state: 'visible', timeout: 10000 });
                    await GeneralUtils.sleep(500); // Small buffer for content

                    // Scrape detail page
                    const detailPageData = await this.scrapeDetailPage(plane.fleetId, plane.registration, cache);

                    // Merge data
                    const mergedData: PlaneData = {
                        ...panelData,
                        ...detailPageData,
                        fleetId: plane.fleetId,
                        registration: plane.registration,
                        metadata: {
                            lastScraped: new Date().toISOString(),
                            lastFlightAdded: detailPageData.flightHistory.length > 0
                                ? detailPageData.flightHistory[0].timestamp
                                : null,
                            totalFlightsScrapped: detailPageData.flightHistory.length
                        }
                    };

                    planesData.push(mergedData);

                    // Close detail page popup
                    await this.closeDetailPagePopup();

                    // NOW close sidebar (after popup is closed)
                    await this.returnToListAfterDeparture();
                }

                // Delay between planes
                const delay = Math.random() * (this.departureConfig.maxDelay - this.departureConfig.minDelay)
                    + this.departureConfig.minDelay;
                await GeneralUtils.sleep(delay);

            } catch (error) {
                console.error(`❌ Error scraping plane ${plane.fleetId}:`, error);
            }
        }

        console.log(`✅ Scraped ${planesData.length} additional planes`);

        return { planesData, timedOut };
    }

    /**
     * Decide if a plane should be scraped based on cache
     * Returns hours since last flight for prioritization
     */
    private shouldScrapePlane(fleetId: string, cache: LastScrapeCache | null): { shouldScrape: boolean; hoursSince: number } {
        // No cache? Scrape everything
        if (!cache || !cache.planesSnapshot) {
            return { shouldScrape: true, hoursSince: 999 };
        }

        // Not in cache? New plane, scrape it (high priority)
        if (!cache.planesSnapshot[fleetId]) {
            return { shouldScrape: true, hoursSince: 999 };
        }

        // Plane is in cache
        const snapshot = cache.planesSnapshot[fleetId];

        // Check when this plane was LAST SCRAPED (not last flight!)
        if (!snapshot.lastScraped) {
            // Never scraped? Scrape it!
            return { shouldScrape: true, hoursSince: 999 };
        }

        // Plane has been scraped before
        // Strategy: Only scrape planes that were scraped more than 8 hours ago
        const now = new Date();
        const lastScraped = new Date(snapshot.lastScraped);
        const hoursSinceLastScrape = (now.getTime() - lastScraped.getTime()) / (1000 * 60 * 60);

        // Only scrape if it's been 8+ hours since last scrape
        return {
            shouldScrape: hoursSinceLastScrape >= 8,
            hoursSince: hoursSinceLastScrape
        };
    }

    /**
     * PHASE 3: Complete workflow - Depart & Scrape
     * OPTIMIZED: Scrape departed planes immediately (no double-opening of detail pages!)
     * 1. Depart & scrape planes in one go (Phase 3A)
     * 2. Switch to Inflight tab
     * 3. Scrape remaining inflight planes that weren't just departed (Phase 3B)
     */
    public async processLandedPlanes(calculatedMaxDepartures: number): Promise<{
        processedCount: number;
        departedCount: number;
        planesData: PlaneData[];
    }> {
        // Reset timer to start of THIS phase (not constructor time)
        this.testStartTime = Date.now();

        // calculatedMaxDepartures already has override applied from getFleetSizeAndCalculateLimit()
        const maxDepartures = calculatedMaxDepartures;

        console.log(`\n🚀 Phase 3: OPTIMIZED DEPART & SCRAPE workflow`);
        console.log(`   Max departures for this run: ${maxDepartures}`);

        // Phase 3A: Depart planes AND immediately scrape them (while sidebar is still open!)
        const departedResult = await this.departAndScrapePlanes(maxDepartures);

        // ⏰ EMERGENCY EXIT: If Phase 3A timed out, skip all remaining operations and save immediately
        if (departedResult.timedOut) {
            console.log(`\n⚠️  TIMEOUT DETECTED in Phase 3A - Skipping Phase 3B and returning immediately to save data`);
            console.log(`   Scraped ${departedResult.planesData.length} planes before timeout`);
            console.log(`   Remaining time: ${Math.round(this.getRemainingTime() / 1000)}s`);
            return {
                processedCount: departedResult.planesData.length,
                departedCount: departedResult.planesData.length,
                planesData: departedResult.planesData
            };
        }

        // Extract Fleet IDs for Phase 3B exclusion
        const departedFleetIds = departedResult.planesData.map(p => p.fleetId);

        // === CRITICAL: Ensure sidebar is back to list view before switching tabs ===
        console.log('\n📍 Ensuring sidebar is in list view...');
        await this.returnToListAfterDeparture();
        await GeneralUtils.sleep(1000);

        // === ROBUST Tab-Wechsel zum Inflight tab ===
        console.log('📍 Switching to Inflight tab...');

        // Try multiple times if needed
        let tabSwitched = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // Click with force to bypass any overlays
                await this.page.locator('#flightStatusInflight').click({ force: true });
                await GeneralUtils.sleep(1500);

                // VERIFY: Check if we actually switched tabs by checking if inflightList is visible
                const inflightListVisible = await this.page.locator('#inflightList').isVisible();
                const landedListVisible = await this.page.locator('#landedList').isVisible();

                if (inflightListVisible && !landedListVisible) {
                    console.log(`✅ Tab switch successful (attempt ${attempt})`);
                    tabSwitched = true;
                    break;
                } else {
                    console.log(`⚠️ Tab switch failed (attempt ${attempt}), retrying...`);
                    await GeneralUtils.sleep(1000);
                }
            } catch (err) {
                console.log(`❌ Error during tab switch (attempt ${attempt}):`, err);
                await GeneralUtils.sleep(1000);
            }
        }

        if (!tabSwitched) {
            console.log('⚠️ WARNING: Could not switch to Inflight tab after 3 attempts!');
            console.log('   Skipping Phase 3B (remaining inflight planes)');
        }

        // Wait a bit more for inflight data to load (percentage + time)
        await GeneralUtils.sleep(2000);

        // Phase 3B: Scrape remaining inflight planes that weren't just departed (only if tab switch worked!)
        let remainingPlanesData: PlaneData[] = [];
        if (tabSwitched) {
            // Check if we have enough time left for Phase 3B (at least 30s)
            const remainingTimeSeconds = Math.floor(this.getRemainingTime() / 1000);

            console.log(`\n⏱️  Time check before Phase 3B:`);
            console.log(`   Remaining time: ${remainingTimeSeconds}s`);

            if (this.canContinueSafely(30000)) {
                const cache = this.loadCache();
                const remainingResult = await this.scrapeRemainingInflightPlanes(departedFleetIds, cache);

                // ⏰ EMERGENCY EXIT: If Phase 3B timed out, return immediately with what we have
                if (remainingResult.timedOut) {
                    console.log(`\n⚠️  TIMEOUT DETECTED in Phase 3B - Returning immediately to save data`);
                    console.log(`   Total scraped: ${departedResult.planesData.length + remainingResult.planesData.length} planes`);
                    console.log(`   Remaining time: ${Math.round(this.getRemainingTime() / 1000)}s`);
                    return {
                        processedCount: departedResult.planesData.length + remainingResult.planesData.length,
                        departedCount: departedResult.planesData.length,
                        planesData: [...departedResult.planesData, ...remainingResult.planesData]
                    };
                }

                remainingPlanesData = remainingResult.planesData;
            } else {
                console.log(`   ⚠️  Less than 30s remaining, skipping Phase 3B to ensure safe data saving`);
            }
        }

        // Merge all scraped data
        const allScrapedPlanes = [...departedResult.planesData, ...remainingPlanesData];

        console.log(`\n✅ OPTIMIZED workflow finished!`);
        console.log(`   - Departed & scraped: ${departedResult.planesData.length} planes`);
        console.log(`   - Scraped (other inflight): ${remainingPlanesData.length} planes`);
        console.log(`   - Total scraped: ${allScrapedPlanes.length} planes`);

        return {
            processedCount: allScrapedPlanes.length,
            departedCount: departedFleetIds.length,
            planesData: allScrapedPlanes
        };
    }

    /**
     * Scrape data from left-side detail panel
     */
    private async scrapePanelData(fleetId: string, registration: string): Promise<Partial<PlaneData>> {
        const detailsPanel = this.page.locator('#detailsAction');

        // Extract current route (if visible)
        let rawRouteText: string | null = null;
        try {
            const routeElement = detailsPanel.locator('text=/\\w{3}-\\w{3}/').first();
            if (await routeElement.count() > 0) {
                rawRouteText = await routeElement.textContent();
            }
        } catch {}

        // Extract wear% from panel
        let wearPercent: number | null = null;
        try {
            const wearElement = detailsPanel.getByText(/Wear.*%/i).first();
            if (await wearElement.count() > 0) {
                const wearText = await wearElement.textContent();
                const match = wearText?.match(/([\d.]+)%/);
                if (match) {
                    wearPercent = parseFloat(match[1]);
                }
            }
        } catch {}

        return {
            fleetId,
            registration,
            currentMetrics: {
                wearPercent,
                hoursToCheck: null,
                rangeKm: null,
                flightHours: null,
                flightCycles: null,
                minRunwayFt: null
            },
            flightHistory: []
        };
    }

    /**
     * Scrape data from full detail page
     */
    private async scrapeDetailPage(
        fleetId: string,
        registration: string,
        cache: LastScrapeCache | null
    ): Promise<Partial<PlaneData>> {
        const detailContainer = this.page.locator('#detailsAction');

        // Extract aircraft type, delivered date, metrics
        const aircraftType = await this.getDetailValue(detailContainer, 'Aircraft');
        const deliveredRaw = await this.getDetailValue(detailContainer, 'Delivered');

        let deliveredDate: DeliveredDate | null = null;
        if (deliveredRaw) {
            const converted = TimestampUtils.convertRelativeToAbsolute(deliveredRaw);
            deliveredDate = {
                timestamp: converted.timestamp,
                original: converted.original,
                precisionLevel: converted.precisionLevel
            };
        }

        const hoursToCheck = await this.getDetailValueNumber(detailContainer, 'Hours to check');
        const rangeKm = await this.getDetailValueNumber(detailContainer, 'Range');
        const minRunwayFt = await this.getDetailValueNumber(detailContainer, 'Min runway');

        // Flight hours/cycles
        const flightHoursCyclesStr = await this.getDetailValue(detailContainer, 'Flight hours/Cycles');
        const { hours: flightHours, cycles: flightCycles } = this.parseFlightHoursCycles(flightHoursCyclesStr);

        // Wear
        const wearStr = await this.getDetailValue(detailContainer, 'Wear');
        const wearPercent = this.parsePercent(wearStr);

        // Flight history (INCREMENTAL!)
        const flightHistory = await this.scrapeFlightHistoryIncremental(fleetId, cache);

        return {
            aircraftType,
            deliveredDate,
            currentMetrics: {
                hoursToCheck,
                rangeKm,
                flightHours,
                flightCycles,
                minRunwayFt,
                wearPercent
            },
            flightHistory
        };
    }

    /**
     * INCREMENTAL Flight History Scraping
     * Only scrapes flights newer than last known timestamp
     */
    private async scrapeFlightHistoryIncremental(
        fleetId: string,
        cache: LastScrapeCache | null
    ): Promise<FlightHistoryEntry[]> {
        const detailContainer = this.page.locator('#detailsAction');
        const flightHistoryContainer = detailContainer.locator('#flight-history');

        if (await flightHistoryContainer.count() === 0) {
            return [];
        }

        // Get last known timestamp from cache
        let lastKnownTimestamp: string | null = null;
        if (cache && cache.planesSnapshot[fleetId]) {
            lastKnownTimestamp = cache.planesSnapshot[fleetId].lastFlightTimestamp;
        }

        const flightHistory: FlightHistoryEntry[] = [];
        const flightRows = flightHistoryContainer.locator('div.row.bg-light');
        const rowCount = await flightRows.count();

        for (let j = 0; j < rowCount; j++) {
            try {
                const row = flightRows.nth(j);
                const cols = row.locator('div.col-3');

                // Col 1: Time + Route
                const col1Text = await cols.nth(0).textContent();
                const col1Lines = col1Text?.split('\n').map(l => l.trim()).filter(l => l) || [];
                const timeAgo = col1Lines[0] || null;
                const route = col1Lines[1] || null;

                if (!timeAgo) continue;

                // Convert relative timestamp to absolute
                const converted = TimestampUtils.convertRelativeToAbsolute(timeAgo);

                // INCREMENTAL CHECK: Stop if we've seen this flight before
                if (lastKnownTimestamp && !TimestampUtils.isNewer(converted.timestamp, lastKnownTimestamp)) {
                    break;
                }

                // Col 2: Route Name + Quotas
                const col2HTML = await cols.nth(1).innerHTML();
                const routeNameMatch = col2HTML.match(/^([^<]+)/);
                const routeName = routeNameMatch ? routeNameMatch[1].trim() : null;
                const quotasMatch = col2HTML.match(/<span class="s-text">([^<]+)<\/span>/);
                const quotasStr = quotasMatch ? quotasMatch[1].trim() : null;

                // Col 3: Passengers + Cargo
                const col3HTML = await cols.nth(2).innerHTML();
                const yMatch = col3HTML.match(/<b>Y<\/b>(\d+)/);
                const jMatch = col3HTML.match(/<b>J<\/b>(\d+)/);
                const fMatch = col3HTML.match(/<b>F<\/b>(\d+)/);
                const col3Text = await cols.nth(2).textContent();
                const cargoMatch = col3Text?.match(/([\d,]+\s*Lbs)/);

                // Col 4: Revenue
                const revenueStr = await cols.nth(3).textContent();

                const economy = yMatch ? parseInt(yMatch[1]) : null;
                const business = jMatch ? parseInt(jMatch[1]) : null;
                const first = fMatch ? parseInt(fMatch[1]) : null;
                const total = (economy || 0) + (business || 0) + (first || 0);

                // Normalize timestamp to UTC timeslot (for 'slot' precision only)
                const normalizedTimestamp = TimestampUtils.normalizeToTimeslot(
                    converted.timestamp,
                    converted.precisionLevel
                );

                flightHistory.push({
                    timestamp: normalizedTimestamp,
                    precisionLevel: converted.precisionLevel,
                    route: route || '',
                    routeName,
                    quotas: this.parseNumber(quotasStr),
                    passengers: {
                        economy,
                        business,
                        first,
                        total: total > 0 ? total : null
                    },
                    cargoWeightLbs: this.parseNumber(cargoMatch ? cargoMatch[1] : null),
                    revenueUSD: this.parseUSD(revenueStr)
                });

            } catch (err) {
                console.error(`Error extracting flight ${j}:`, err);
            }
        }

        return flightHistory;
    }

    /**
     * Return to list after departure (NO POPUP!)
     * After clicking "Depart" in side-panel, there's no popup to close
     * Just click back in sidebar to return to categorized overview
     */
    private async returnToListAfterDeparture(): Promise<void> {
        try {
            // The "List" button has classes: .nudgeBtn.btn-block.btn-secondary.btn-xs
            const sidebarBackButton = this.page.locator('button.nudgeBtn.btn-secondary:has-text("List")').first();

            // Check if button exists AND is visible (with short timeout)
            const isVisible = await sidebarBackButton.isVisible({ timeout: 1000 }).catch(() => false);

            if (isVisible) {
                await sidebarBackButton.click({ timeout: 3000 });
                await GeneralUtils.sleep(500);
            }
        } catch (err) {
            // Silently ignore - sidebar might already be closed
        }
    }

    /**
     * Close detail page popup (FOR SCRAPING)
     * After opening "Details", there's a popup that needs to be closed
     * Just close the popup - we're done after scraping!
     */
    private async closeDetailPagePopup(): Promise<void> {
        try {
            // Just close the popup with X button
            // The close button is in #popup > .modal-header > .glyphicons-remove
            const closeButton = this.page.locator('#popup .modal-header .glyphicons-remove').first();

            if (await closeButton.count() > 0) {
                await closeButton.click();
                await GeneralUtils.sleep(500);
            } else {
                // Fallback: Try other possible selectors
                const altCloseButton = this.page.locator('#popup .glyphicons-remove').first();
                if (await altCloseButton.count() > 0) {
                    await altCloseButton.click();
                    await GeneralUtils.sleep(500);
                }
            }

            // No need to go back - we're done scraping!
            // The test will handle saving data and closing browser
        } catch (err) {
            console.error('Error closing detail page popup:', err);
        }
    }

    /**
     * 🛡️ SAFETY: This function is DISABLED for safety reasons!
     * Departure functionality has been completely removed from scraping workflow.
     *
     * This function should NEVER be called during normal operation!
     * If you need departure functionality, create a separate workflow.
     */
    private async departPlane(fleetId: string, registration: string): Promise<void> {
        console.error(`🚨 SAFETY ERROR: departPlane() was called but is DISABLED!`);
        console.error(`   Fleet ID: ${fleetId}, Registration: ${registration}`);
        console.error(`   This function should NEVER be called during scraping!`);

        // DO ABSOLUTELY NOTHING - no mock, no real departure, NOTHING!
        // This is a safety measure to prevent accidental departures.

        return;
    }

    /**
     * Save cache to last-scrape.json
     */
    public saveCache(
        totalFleetSize: number,
        fleetComposition: FleetComposition,
        planesData: PlaneData[]
    ): void {
        console.log('\n💾 Saving cache to last-scrape.json...');

        const planesSnapshot: { [fleetId: string]: PlaneSnapshot } = {};

        for (const plane of planesData) {
            const lastFlight = plane.flightHistory.length > 0 ? plane.flightHistory[0] : null;

            planesSnapshot[plane.fleetId] = {
                registration: plane.registration,
                lastFlightTimestamp: lastFlight?.timestamp || null,
                lastFlightRoute: lastFlight?.route || null,
                totalFlights: plane.flightHistory.length,
                hash: TimestampUtils.generatePlaneHash(
                    plane.registration,
                    lastFlight?.timestamp || null,
                    plane.flightHistory.length
                )
            };
        }

        const cache: LastScrapeCache = {
            lastRunTimestamp: new Date().toISOString(),
            totalFleetSize,
            departurePercentage: this.departureConfig.percentage,
            fleetComposition,
            planesSnapshot
        };

        const dataDir = path.dirname(this.cacheFilePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(this.cacheFilePath, JSON.stringify(cache, null, 2));
        console.log('✅ Cache saved');
    }

    /**
     * Load cache from last-scrape.json
     */
    private loadCache(): LastScrapeCache | null {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const content = fs.readFileSync(this.cacheFilePath, 'utf-8');
                return JSON.parse(content) as LastScrapeCache;
            }
        } catch (error) {
            console.error('Error loading cache:', error);
        }
        return null;
    }

    /**
     * Load planes data from planes.json
     */
    private loadPlanesData(): PlaneData[] {
        try {
            if (fs.existsSync(this.planesDataFilePath)) {
                const content = fs.readFileSync(this.planesDataFilePath, 'utf-8');
                return JSON.parse(content) as PlaneData[];
            }
        } catch (error) {
            console.error('Error loading planes data:', error);
        }
        return [];
    }

    /**
     * Save planes data to planes.json (merge with existing)
     */
    public savePlanesData(newPlanesData: PlaneData[]): void {
        console.log('\n💾 Saving planes data to planes.json...');

        const existingData = this.loadPlanesData();
        const mergedData = [...existingData];

        for (const newPlane of newPlanesData) {
            const existingIndex = mergedData.findIndex(p => p.fleetId === newPlane.fleetId);

            if (existingIndex >= 0) {
                // Merge: keep old flights, add new ones
                const oldFlights = mergedData[existingIndex].flightHistory;
                const newFlights = newPlane.flightHistory;

                // Helper: Semantic deduplication - checks if two flights are the same
                // Based on: route, revenue, passengers, and timestamp proximity (within 1 hour)
                const areSameFlight = (f1: any, f2: any): boolean => {
                    // Must have same route and revenue
                    if (f1.route !== f2.route || f1.revenueUSD !== f2.revenueUSD) {
                        return false;
                    }

                    // Must have same passengers
                    const passengersSame =
                        f1.passengers.total === f2.passengers.total &&
                        f1.passengers.economy === f2.passengers.economy &&
                        f1.passengers.business === f2.passengers.business &&
                        f1.passengers.first === f2.passengers.first;

                    if (!passengersSame) {
                        return false;
                    }

                    // Must be within 1 hour time window
                    const time1 = new Date(f1.timestamp).getTime();
                    const time2 = new Date(f2.timestamp).getTime();
                    const diffMinutes = Math.abs(time1 - time2) / (1000 * 60);

                    return diffMinutes <= 60;
                };

                // Helper: Choose better flight when duplicates detected
                // Prefer: slot > day > week > month > year precision
                const precisionRank = { slot: 5, day: 4, week: 3, month: 2, year: 1 };
                const chooseBetterFlight = (f1: any, f2: any): any => {
                    const rank1 = precisionRank[f1.precisionLevel as keyof typeof precisionRank] || 0;
                    const rank2 = precisionRank[f2.precisionLevel as keyof typeof precisionRank] || 0;

                    // If same precision, prefer newer timestamp
                    if (rank1 === rank2) {
                        const time1 = new Date(f1.timestamp).getTime();
                        const time2 = new Date(f2.timestamp).getTime();
                        return time1 > time2 ? f1 : f2;
                    }

                    return rank1 > rank2 ? f1 : f2;
                };

                // Filter out flights that already exist (semantic deduplication)
                const newUniqueFlights = newFlights.filter(nf =>
                    !oldFlights.some(of => areSameFlight(of, nf))
                );

                // Combine new unique flights with old flights
                const allFlights = [...newUniqueFlights, ...oldFlights];

                // Additional deduplication: Remove any remaining duplicates and keep best version
                const deduplicatedFlights: any[] = [];
                const processed = new Set<number>();

                for (let i = 0; i < allFlights.length; i++) {
                    if (processed.has(i)) continue;

                    let bestFlight = allFlights[i];
                    processed.add(i);

                    // Find all duplicates of this flight
                    for (let j = i + 1; j < allFlights.length; j++) {
                        if (processed.has(j)) continue;

                        if (areSameFlight(allFlights[i], allFlights[j])) {
                            bestFlight = chooseBetterFlight(bestFlight, allFlights[j]);
                            processed.add(j);
                        }
                    }

                    deduplicatedFlights.push(bestFlight);
                }

                const uniqueFlights = deduplicatedFlights;

                // Sort by timestamp descending (newest first)
                uniqueFlights.sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );

                mergedData[existingIndex] = {
                    ...newPlane,
                    flightHistory: uniqueFlights,
                    metadata: {
                        ...newPlane.metadata,
                        totalFlightsScrapped: uniqueFlights.length
                    }
                };
            } else {
                // New plane
                mergedData.push(newPlane);
            }
        }

        const dataDir = path.dirname(this.planesDataFilePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(this.planesDataFilePath, JSON.stringify(mergedData, null, 2));
        console.log(`✅ Planes data saved (${mergedData.length} total planes)`);
    }

    // ============= Helper Methods =============

    private async getDetailValue(container: Locator, labelText: string): Promise<string | null> {
        try {
            const labelSpan = container.locator(`span.s-text.text-secondary`).filter({ hasText: labelText }).first();
            if (await labelSpan.count() === 0) return null;

            const parentDiv = labelSpan.locator('..');
            const labels = await parentDiv.locator('span.s-text.text-secondary').allTextContents();
            const values = await parentDiv.locator('span.m-text').allTextContents();

            const index = labels.findIndex(l => l.trim() === labelText);
            if (index >= 0 && index < values.length) {
                return values[index]?.trim() || null;
            }

            return null;
        } catch {
            return null;
        }
    }

    private async getDetailValueNumber(container: Locator, labelText: string): Promise<number | null> {
        const str = await this.getDetailValue(container, labelText);
        return this.parseNumber(str);
    }

    private parseNumber(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace(/[^0-9.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    private parseUSD(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace(/[$,]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    private parsePercent(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace('%', '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    private parseFlightHoursCycles(str: string | null): { hours: number | null, cycles: number | null } {
        if (!str) return { hours: null, cycles: null };
        const parts = str.split('/').map(p => p.trim());
        const hours = parts[0] ? parseInt(parts[0]) : null;
        const cycles = parts[1] ? parseInt(parts[1]) : null;
        return {
            hours: isNaN(hours as any) ? null : hours,
            cycles: isNaN(cycles as any) ? null : cycles
        };
    }
}
