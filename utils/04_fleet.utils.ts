import { Page, Locator, expect } from "@playwright/test"; // Added expect
import { GeneralUtils } from './00_general.utils'; // Ensured GeneralUtils import
import { FetchPlanesUtils } from './fleet/fetchPlanes.utils';
import * as fs from 'fs';
import * as path from 'path';
require('dotenv').config();

// Define the PlaneInfo interface
interface PlaneInfo {
    planeId: string | null;
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
    error?: string;
}

export class FleetUtils {
    page : Page;
    maxTry : number; // Added to prevent infinite loop in case of no fuel available
    private startedFleetIds: string[] = []; // Track FleetIDs of started planes

    constructor(page : Page) {
        this.page = page;
        this.maxTry = 8; // TODO: Find another way
    }

    public async departPlanes() {
        let departAllVisible = await this.page.locator('#departAll').isVisible();
        console.log('Looking if there are any planes to be departed...')

        let batchCount = 0;

        while(departAllVisible && batchCount < this.maxTry) {
            // ✅ Track FleetIDs BEFORE departing (die aktuellen 20 auf Seite 1)
            await this.trackVisibleFleetIds();

            console.log(`Departing batch ${batchCount + 1}...`);
            let departAll = await this.page.locator('#departAll');

            await departAll.click();
            await GeneralUtils.sleep(1500);

            const cantDepartPlane = await this.page.getByText('×Unable to departSome A/C was').isVisible();
            if(cantDepartPlane) {
                console.log('Unable to depart some planes - stopping');
                break;
            }

            batchCount++;

            // ✅ Nach "Depart All": Departed planes verschwinden, nächste 20 rutschen nach
            // Warte kurz damit die Liste refreshed
            await GeneralUtils.sleep(500);

            // Check ob "Depart All" immer noch sichtbar (d.h. mehr Flugzeuge verfügbar)
            departAllVisible = await this.page.locator('#departAll').isVisible();

            if (departAllVisible) {
                console.log(`Batch ${batchCount} departed, next batch available`);
            } else {
                console.log(`Batch ${batchCount} departed, no more planes to depart`);
            }
        }

        console.log(`\n✅ Departure complete!`);
        console.log(`Total batches departed: ${batchCount}`);
        console.log(`Total planes tracked: ${this.startedFleetIds.length}`);

        // Save tracked FleetIDs to file
        this.saveStartedFleetIds();
    }

    /**
     * Tracks FleetIDs of planes visible on the current page before departure
     */
    private async trackVisibleFleetIds(): Promise<void> {
        try {
            const rowsLocator = this.page.locator('div[id^="routeMainList"]');
            const rowCount = await rowsLocator.count();

            console.log(`Tracking ${rowCount} visible planes...`);

            for (let i = 0; i < rowCount; i++) {
                try {
                    const row = rowsLocator.nth(i);
                    const planeIdElement = row.locator('span[id^="acRegList"]');

                    if (await planeIdElement.count() > 0) {
                        const spanId = await planeIdElement.getAttribute('id');
                        if (spanId) {
                            const fleetId = spanId.replace('acRegList', '');
                            this.startedFleetIds.push(fleetId);
                            console.log(`  Tracked FleetID: ${fleetId}`);
                        }
                    }
                } catch (error) {
                    console.error(`Error tracking row ${i}:`, error);
                }
            }
        } catch (error) {
            console.error('Error tracking FleetIDs:', error);
        }
    }

    /**
     * Saves the tracked FleetIDs to started-flights.json
     */
    private saveStartedFleetIds(): void {
        if (this.startedFleetIds.length === 0) {
            console.log('No FleetIDs tracked - skipping started-flights.json');
            return;
        }

        const startedFlightsPath = path.join(process.cwd(), 'started-flights.json');
        const data = {
            timestamp: new Date().toISOString(),
            fleetIds: this.startedFleetIds
        };

        try {
            fs.writeFileSync(startedFlightsPath, JSON.stringify(data, null, 2));
            console.log(`\nSaved ${this.startedFleetIds.length} FleetIDs to started-flights.json`);
            console.log(`FleetIDs: ${this.startedFleetIds.join(', ')}`);
        } catch (error) {
            console.error('Error saving started-flights.json:', error);
        }
    }
}