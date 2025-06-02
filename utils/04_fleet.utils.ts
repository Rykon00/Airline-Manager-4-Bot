import { Page, Locator, expect } from "@playwright/test"; // Added expect
import { GeneralUtils } from './00_general.utils'; // Ensured GeneralUtils import
import { FetchPlanesUtils } from './fleet/fetchPlanes.utils';
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

    constructor(page : Page) {
        this.page = page;
        this.maxTry = 8; // TODO: Find another way 
    }

    public async departPlanes() {
        let departAllVisible = await this.page.locator('#departAll').isVisible();
        console.log('Looking if there are any planes to be departed...')

        let count = 0; 
        while(departAllVisible && count < this.maxTry) {
            console.log('Departing 20 or less...');

            let departAll = await this.page.locator('#departAll');
            
            await departAll.click();
            await GeneralUtils.sleep(1500);
            
            const cantDepartPlane = await this.page.getByText('×Unable to departSome A/C was').isVisible();
            if(cantDepartPlane)
                break;

            departAllVisible = await this.page.locator('#departAll').isVisible();
            count++;
        
            console.log('Departed 20 or less planes...')
        }
    }
}