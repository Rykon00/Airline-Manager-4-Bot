import { Page, Locator } from "@playwright/test";
import { GeneralUtils } from '../00_general.utils';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config();

// Import interfaces from fetchPlanes (we'll reuse them)
interface FlightHistory {
    timeAgo: string | null;
    route: string | null;
    routeName: string | null;
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

interface PlaneInfo {
    fleetId: string | null;
    registration: string | null;
    rawRouteText: string | null;
    aircraftType: string | null;
    delivered: string | null;
    hoursToCheck: number | null;      // ✅ Zahl: 50 (Stunden bis Check)
    rangeKm: number | null;            // ✅ Zahl: 2036 (Reichweite in km)
    flightHours: number | null;       // ✅ Zahl: 3625 (Flugstunden)
    flightCycles: number | null;      // ✅ Zahl: 719 (Flugzyklen)
    minRunwayFt: number | null;       // ✅ Zahl: 2000 (Minimale Landebahn in ft)
    wearPercent: number | null;       // ✅ Zahl: 30.41 (Abnutzung in Prozent)
    planeType: string | null;
    departureAirport: string | null;
    arrivalAirport: string | null;
    flightHistory?: FlightHistory[];
    error?: string;
}

export class UpdatePlanesUtils {
    page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Updates specific planes by their FleetIDs
     * @param fleetIds - Array of FleetIDs to update
     * @returns Updated PlaneInfo array
     */
    public async updateSpecificPlanes(fleetIds: string[]): Promise<PlaneInfo[]> {
        console.log(`Updating ${fleetIds.length} specific planes: ${fleetIds.join(', ')}`);
        const updatedPlanes: PlaneInfo[] = [];

        // Load existing planes.json
        const existingPlanes = this.loadPlanesFromFile();
        console.log(`Loaded ${existingPlanes.length} existing planes from planes.json`);

        // Navigate to fleet page
        await this.navigateToFleetPage();

        for (const fleetId of fleetIds) {
            try {
                console.log(`\nUpdating plane with FleetID: ${fleetId}`);

                // Find and click the plane
                const planeData = await this.navigateToPlaneByFleetId(fleetId);

                if (!planeData) {
                    console.log(`Could not find plane with FleetID ${fleetId}`);
                    continue;
                }

                // Extract new flight history
                const newFlightHistory = await this.extractFlightHistory();
                planeData.flightHistory = newFlightHistory;

                // Merge with existing data
                const existingPlane = existingPlanes.find(p => p.fleetId === fleetId);
                if (existingPlane) {
                    const mergedPlane = this.mergePlaneData(existingPlane, planeData);
                    updatedPlanes.push(mergedPlane);
                    console.log(`Merged data for ${fleetId}: ${newFlightHistory.length} new flights`);
                } else {
                    updatedPlanes.push(planeData);
                    console.log(`New plane ${fleetId}: ${newFlightHistory.length} flights`);
                }

                // Go back to list
                await this.goBackToList();
                await GeneralUtils.sleep(500);

            } catch (error) {
                console.error(`Error updating plane ${fleetId}:`, error);
            }
        }

        // Update planes.json with merged data
        this.savePlanesWithUpdates(existingPlanes, updatedPlanes);

        return updatedPlanes;
    }

    /**
     * Navigates to the fleet page
     */
    private async navigateToFleetPage(): Promise<void> {
        console.log('Navigating to fleet page...');
        await this.page.locator('#mapRoutes').getByRole('img').click();
        await GeneralUtils.sleep(2000);

        await this.page.waitForSelector('div[id^="routeMainList"]', { timeout: 10000 });
        console.log('Fleet page loaded');
    }

    /**
     * Finds a plane by FleetID and opens its detail page
     * @param fleetId - The FleetID to find
     * @returns Basic plane info or null if not found
     */
    private async navigateToPlaneByFleetId(fleetId: string): Promise<PlaneInfo | null> {
        // The FleetID is in the span id attribute: "acRegList105960065"
        const targetSelector = `span[id="acRegList${fleetId}"]`;

        // Search through all pages if needed
        let hasNextPage = true;
        let currentPage = 1;

        while (hasNextPage) {
            console.log(`Searching for FleetID ${fleetId} on page ${currentPage}...`);

            const planeIdElement = this.page.locator(targetSelector);

            if (await planeIdElement.count() > 0) {
                console.log(`Found plane with FleetID ${fleetId} on page ${currentPage}`);

                // Get registration and detail link
                const registration = await planeIdElement.textContent().catch(() => null);
                const row = planeIdElement.locator('xpath=ancestor::div[contains(@id, "routeMainList")]').first();
                const detailLink = row.locator('a').first();

                // Click to open details
                console.log(`Opening details for ${registration}...`);
                await detailLink.click();
                await GeneralUtils.sleep(2000);

                // Wait for detail container
                const detailContainer = this.page.locator('#detailsAction');
                await detailContainer.waitFor({ state: 'visible', timeout: 5000 });

                // Extract basic info (NO COLONS!) and parse to proper types
                const aircraftType = await this.getDetailValue(detailContainer, 'Aircraft');
                const delivered = await this.getDetailValue(detailContainer, 'Delivered');
                const hoursToCheckStr = await this.getDetailValue(detailContainer, 'Hours to check');
                const rangeStr = await this.getDetailValue(detailContainer, 'Range');
                const flightHoursCyclesStr = await this.getDetailValue(detailContainer, 'Flight hours/Cycles');
                const minRunwayStr = await this.getDetailValue(detailContainer, 'Min runway');
                const wearStr = await this.getDetailValue(detailContainer, 'Wear');

                // Parse values to numbers
                const parsedHoursCycles = this.parseFlightHoursCycles(flightHoursCyclesStr);

                return {
                    fleetId,
                    registration,
                    aircraftType,
                    delivered,
                    hoursToCheck: this.parseNumber(hoursToCheckStr),
                    rangeKm: this.parseRangeKm(rangeStr),
                    flightHours: parsedHoursCycles.hours,
                    flightCycles: parsedHoursCycles.cycles,
                    minRunwayFt: this.parseRunwayFt(minRunwayStr),
                    wearPercent: this.parsePercent(wearStr),
                    rawRouteText: null,
                    planeType: null,
                    departureAirport: null,
                    arrivalAirport: null
                };
            }

            // Try next page
            const nextPageButton = this.page.locator('.pagination-next');
            hasNextPage = await nextPageButton.isVisible();
            if (hasNextPage) {
                await nextPageButton.click();
                await GeneralUtils.sleep(1000);
                currentPage++;
            }
        }

        return null;
    }

    /**
     * Extracts flight history from the currently open detail page
     */
    private async extractFlightHistory(): Promise<FlightHistory[]> {
        const flightHistory: FlightHistory[] = [];
        const detailContainer = this.page.locator('#detailsAction');
        const flightHistoryContainer = detailContainer.locator('#flight-history');

        if (await flightHistoryContainer.count() === 0) {
            return flightHistory;
        }

        const flightRows = flightHistoryContainer.locator('div.row.bg-light');
        const rowCount = await flightRows.count();
        console.log(`Extracting ${rowCount} flights from history...`);

        for (let j = 0; j < rowCount; j++) {
            try {
                const row = flightRows.nth(j);
                const cols = row.locator('div.col-3');

                // Col 1: Time + Route
                const col1Text = await cols.nth(0).textContent();
                const col1Lines = col1Text?.split('\n').map(l => l.trim()).filter(l => l) || [];
                const timeAgo = col1Lines[0] || null;
                const route = col1Lines[1] || null;

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

                // Parse to numbers
                const economy = yMatch ? parseInt(yMatch[1]) : null;
                const business = jMatch ? parseInt(jMatch[1]) : null;
                const first = fMatch ? parseInt(fMatch[1]) : null;
                const total = (economy || 0) + (business || 0) + (first || 0);

                flightHistory.push({
                    timeAgo,
                    route,
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
     * Goes back to the plane list from detail view
     * 1. Click white X button in popup to close it
     * 2. Click back in sidebar to return to categorized overview
     */
    private async goBackToList(): Promise<void> {
        try {
            // Step 1: Click the white X button to close the popup window
            console.log('Closing popup window via X button...');

            // The close button is in #popup > .modal-header > .glyphicons-remove
            const closeButton = this.page.locator('#popup .modal-header .glyphicons-remove').first();

            if (await closeButton.count() > 0) {
                await closeButton.click();
                await GeneralUtils.sleep(500);
                console.log('✅ Popup closed via X button');
            } else {
                console.log('⚠️ Close button (X) not found with selector #popup .modal-header .glyphicons-remove');
                // Fallback: Try other possible selectors
                const altCloseButton = this.page.locator('#popup .glyphicons-remove').first();
                if (await altCloseButton.count() > 0) {
                    await altCloseButton.click();
                    await GeneralUtils.sleep(500);
                    console.log('✅ Popup closed via fallback selector');
                } else {
                    console.log('❌ Could not find close button!');
                }
            }

            // Step 2: Click back in sidebar to return to categorized overview
            console.log('Clicking back in sidebar...');
            // The "List" button has classes: .nudgeBtn.btn-block.btn-secondary.btn-xs
            const sidebarBackButton = this.page.locator('button.nudgeBtn.btn-secondary:has-text("List")').first();
            if (await sidebarBackButton.count() > 0) {
                await sidebarBackButton.click();
                await GeneralUtils.sleep(500);
                console.log('✅ Returned to categorized overview');
            } else {
                console.log('⚠️ Sidebar "List" button not found - trying fallback...');
                // Fallback: Try generic button selector
                const fallbackButton = this.page.locator('button.btn-secondary:has-text("List"), button:has-text("List")').first();
                if (await fallbackButton.count() > 0) {
                    await fallbackButton.click();
                    await GeneralUtils.sleep(500);
                    console.log('✅ Returned to categorized overview (fallback)');
                } else {
                    console.log('❌ Could not find List button!');
                }
            }
        } catch (err) {
            console.error('Error going back to list:', err);
        }
    }

    /**
     * Merges existing plane data with new data (primarily flight history)
     */
    private mergePlaneData(existing: PlaneInfo, newData: PlaneInfo): PlaneInfo {
        const merged = { ...existing };

        // Update basic fields if they changed
        if (newData.registration) merged.registration = newData.registration;
        if (newData.wearPercent !== null && newData.wearPercent !== undefined) merged.wearPercent = newData.wearPercent;
        if (newData.hoursToCheck !== null && newData.hoursToCheck !== undefined) merged.hoursToCheck = newData.hoursToCheck;
        if (newData.flightHours !== null && newData.flightHours !== undefined) merged.flightHours = newData.flightHours;
        if (newData.flightCycles !== null && newData.flightCycles !== undefined) merged.flightCycles = newData.flightCycles;

        // Merge flight history intelligently
        if (newData.flightHistory && newData.flightHistory.length > 0) {
            const existingFlights = existing.flightHistory || [];
            const newFlights = newData.flightHistory;

            // Combine and deduplicate
            const allFlights = [...newFlights, ...existingFlights];
            const uniqueFlights = this.deduplicateFlights(allFlights);

            // Keep max 50 most recent flights
            merged.flightHistory = uniqueFlights.slice(0, 50);
        }

        return merged;
    }

    /**
     * Deduplicates flights based on timeAgo, route, and passengers
     */
    private deduplicateFlights(flights: FlightHistory[]): FlightHistory[] {
        const seen = new Set<string>();
        const unique: FlightHistory[] = [];

        for (const flight of flights) {
            // Create a unique key based on flight characteristics
            const key = `${flight.timeAgo}|${flight.route}|${flight.passengers.total}|${flight.revenueUSD}`;

            if (!seen.has(key)) {
                seen.add(key);
                unique.push(flight);
            }
        }

        return unique;
    }

    /**
     * Loads existing planes from planes.json
     */
    private loadPlanesFromFile(): PlaneInfo[] {
        const planesPath = path.join(process.cwd(), 'data', 'planes.json');

        if (!fs.existsSync(planesPath)) {
            console.log('No existing planes.json found, starting fresh');
            return [];
        }

        try {
            const data = fs.readFileSync(planesPath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading planes.json:', error);
            return [];
        }
    }

    /**
     * Saves planes.json with updated data
     */
    private savePlanesWithUpdates(existingPlanes: PlaneInfo[], updatedPlanes: PlaneInfo[]): void {
        // Create a map of updated planes by FleetID
        const updatedMap = new Map<string, PlaneInfo>();
        for (const plane of updatedPlanes) {
            if (plane.fleetId) {
                updatedMap.set(plane.fleetId, plane);
            }
        }

        // Merge: replace existing planes with updated versions
        const finalPlanes = existingPlanes.map(plane => {
            if (plane.fleetId && updatedMap.has(plane.fleetId)) {
                return updatedMap.get(plane.fleetId)!;
            }
            return plane;
        });

        // Add any new planes that weren't in existing data
        for (const plane of updatedPlanes) {
            if (plane.fleetId && !existingPlanes.find(p => p.fleetId === plane.fleetId)) {
                finalPlanes.push(plane);
            }
        }

        // Save to file
        const planesPath = path.join(process.cwd(), 'data', 'planes.json');
        fs.writeFileSync(planesPath, JSON.stringify(finalPlanes, null, 2));
        console.log(`\nSaved ${finalPlanes.length} planes to data/planes.json`);
    }

    // Helper methods (copied from fetchPlanes)
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

    // ✅ Helper: Parse Range mit Einheit (z.B. "2,036km" → 2036)
    private parseRangeKm(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace(/[^0-9.-]/g, ''); // Entferne Kommas und "km"
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    // ✅ Helper: Parse Runway mit Einheit (z.B. "2,000ft" → 2000)
    private parseRunwayFt(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace(/[^0-9.-]/g, ''); // Entferne Kommas und "ft"
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    // ✅ Helper: Parse Prozent (z.B. "30.41%" → 30.41)
    private parsePercent(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace('%', '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    // ✅ Helper: Parse Flight Hours/Cycles (z.B. "3625 / 719" → { hours: 3625, cycles: 719 })
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

    // ✅ NEW: Extract detail value from span-based structure (without colons in labels)
    private async getDetailValue(
        container: Locator,
        labelText: string
    ): Promise<string | null> {
        try {
            // Find label span (without colon)
            const labelSpan = container
                .locator(`span.s-text.text-secondary`)
                .filter({ hasText: labelText })
                .first();

            if (await labelSpan.count() === 0) return null;

            // Get parent div
            const parentDiv = labelSpan.locator('..');

            // Collect all labels and values
            const labels = await parentDiv
                .locator('span.s-text.text-secondary')
                .allTextContents();
            const values = await parentDiv
                .locator('span.m-text')
                .allTextContents();

            // Find index
            const index = labels.findIndex(l => l.trim() === labelText);
            if (index >= 0 && index < values.length) {
                return values[index]?.trim() || null;
            }

            return null;
        } catch {
            return null;
        }
    }

}
