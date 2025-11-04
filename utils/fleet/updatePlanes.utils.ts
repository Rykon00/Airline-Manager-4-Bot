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
    detailPageUrl: string | null;
    rawRouteText: string | null;
    aircraftType: string | null;
    delivered: string | null;
    hoursToCheck: string | null;
    range: string | null;
    flightHoursCycles: string | null;
    minRunway: string | null;
    wear: string | null;
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
                const detailPageUrl = await detailLink.getAttribute('href').catch(() => null);

                // Click to open details
                console.log(`Opening details for ${registration}...`);
                await detailLink.click();
                await GeneralUtils.sleep(2000);

                // Wait for detail container
                const detailContainer = this.page.locator('#detailsAction');
                await detailContainer.waitFor({ state: 'visible', timeout: 5000 });

                // Extract basic info
                const aircraftType = await this.getTextFromDivLabel(detailContainer, 'Aircraft:');
                const delivered = await this.getTextFromDivLabel(detailContainer, 'Delivered:');
                const hoursToCheck = await this.getTextFromDivLabel(detailContainer, 'Hours to check:');
                const range = await this.getTextFromDivLabel(detailContainer, 'Range:');
                const flightHoursCycles = await this.getTextFromDivLabel(detailContainer, 'Flight hours/cycles:');
                const minRunway = await this.getTextFromDivLabel(detailContainer, 'Min. runway:');
                const wear = await this.getTextFromDivLabel(detailContainer, 'Wear:');

                return {
                    fleetId,
                    registration,
                    detailPageUrl,
                    aircraftType,
                    delivered,
                    hoursToCheck,
                    range,
                    flightHoursCycles,
                    minRunway,
                    wear,
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
     */
    private async goBackToList(): Promise<void> {
        const detailContainer = this.page.locator('#detailsAction');
        const backButton = detailContainer.locator('span.glyphicons-chevron-left').first();

        if (await backButton.count() > 0) {
            console.log('Clicking back arrow...');
            await backButton.click();
        } else {
            console.log('Back arrow not found, pressing ESC...');
            await this.page.keyboard.press('Escape');
        }
        await GeneralUtils.sleep(500);
    }

    /**
     * Merges existing plane data with new data (primarily flight history)
     */
    private mergePlaneData(existing: PlaneInfo, newData: PlaneInfo): PlaneInfo {
        const merged = { ...existing };

        // Update basic fields if they changed
        if (newData.registration) merged.registration = newData.registration;
        if (newData.wear) merged.wear = newData.wear;
        if (newData.hoursToCheck) merged.hoursToCheck = newData.hoursToCheck;
        if (newData.flightHoursCycles) merged.flightHoursCycles = newData.flightHoursCycles;

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

    private async getTextFromDivLabel(container: Locator, labelWithColon: string): Promise<string | null> {
        try {
            const labelHostingDivLocator = container.locator('div').filter({ hasText: labelWithColon }).first();

            if (await labelHostingDivLocator.count() === 0) {
                return null;
            }

            let textContent = await labelHostingDivLocator.textContent();
            if (textContent) {
                const escapedLabel = labelWithColon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedLabel + "\\s*(.+)", "i");
                const match = textContent.match(regex);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }

            const nextDivSiblingLocator = labelHostingDivLocator.locator('xpath=./following-sibling::div[1]');
            if (await nextDivSiblingLocator.count() > 0) {
                const siblingTextContent = await nextDivSiblingLocator.textContent();
                if (siblingTextContent) {
                    return siblingTextContent.trim();
                }
            }

            return null;
        } catch (e) {
            return null;
        }
    }
}
