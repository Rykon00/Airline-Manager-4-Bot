import { Page, Locator, expect } from "@playwright/test";
import { GeneralUtils } from '../00_general.utils';
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

export class FetchPlanesUtils {
    page : Page;

    constructor(page : Page) {
        this.page = page;
    }    public async getAllPlanes(): Promise<PlaneInfo[]> {
        console.log('Fetching all planes...');
        const allPlanesData: PlaneInfo[] = [];

        try {
            console.log('Phase 1: Scraping list pages.');
            await this.page.locator('#mapRoutes').getByRole('img').click();
            await GeneralUtils.sleep(2000); // Increased sleep time
            
            console.log('Waiting for routes list (div[id^="routeMainList"]) to load...');
            // Explicitly wait for route list to be visible
            try {
                await this.page.waitForSelector('div[id^="routeMainList"]', { timeout: 10000 });
                console.log('Routes list loaded successfully');
            } catch (error) {
                console.error('Error waiting for routes list:', error);
                // Take a screenshot to diagnose the issue
                await this.page.screenshot({ path: 'routes-list-error.png' });
            }

            let hasNextPage = true;
            let currentPage = 1;
            const baseUrl = new URL(this.page.url()).origin;

            while (hasNextPage) {
                console.log(`Processing route list page ${currentPage}...`);
                const rowsLocator = this.page.locator('div[id^="routeMainList"] > div');
                const rowCount = await rowsLocator.count();
                console.log(`Found ${rowCount} route rows on page ${currentPage}.`);                for (let i = 0; i < rowCount; i++) {
                    try {
                        const row = rowsLocator.nth(i);
                        
                        // Check if elements exist before trying to get content
                        const planeIdElement = row.locator('.plane-id');
                        const detailLinkElement = row.locator('.detail-link');
                        
                        // Log for debugging
                        console.log(`Processing row ${i+1}/${rowCount}`);
                        
                        // Check if elements are visible
                        const planeIdVisible = await planeIdElement.isVisible().catch(() => false);
                        const detailLinkVisible = await detailLinkElement.isVisible().catch(() => false);
                        
                        if (!planeIdVisible) {
                            console.log(`Plane ID element not visible in row ${i+1}`);
                        }
                        
                        if (!detailLinkVisible) {
                            console.log(`Detail link element not visible in row ${i+1}`);
                        }
                        
                        // Get text with fallback values
                        const planeId = planeIdVisible ? await planeIdElement.textContent() : null;
                        const detailPageUrl = detailLinkVisible ? await detailLinkElement.getAttribute('href') : null;
                        
                        const planeInfo: Partial<PlaneInfo> = {
                            planeId,
                            detailPageUrl
                        };
                        
                        allPlanesData.push(planeInfo as PlaneInfo);
                    } catch (error) {
                        console.error(`Error processing row ${i+1}:`, error);
                    }
                }

                const nextPageButton = this.page.locator('.pagination-next');
                hasNextPage = await nextPageButton.isVisible();
                if (hasNextPage) {
                    await nextPageButton.click();
                    await GeneralUtils.sleep(1000);
                    currentPage++;
                }
            }

            console.log("Phase 1 (List Page Scraping) completed.");
        } catch (error: any) {
            console.error(`Error in getAllPlanes: ${(error as Error).message}`);
        }
        return allPlanesData;
    }

    // Added methods from 04_fleet.utils.ts
    private async getTextFromDivLabel(container: Locator, labelWithColon: string, timeout = 7000): Promise<string | null> {
        try {
            const labelHostingDivLocator = container.locator('div').filter({ hasText: labelWithColon }).first();
            await expect(labelHostingDivLocator).toBeVisible({ timeout });
            let textContent = await labelHostingDivLocator.textContent();
            if (textContent) {
                const escapedLabel = labelWithColon.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
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
            const strongLabelInDiv = labelHostingDivLocator.locator(`strong:has-text("${labelWithColon}")`);
            if(await strongLabelInDiv.count() > 0) {
                const parentDivText = await labelHostingDivLocator.textContent();
                if (parentDivText) {
                    const escapedLabel = labelWithColon.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedLabel + "\\s*(.+)", "i");
                    const match = parentDivText.match(regex);
                    if (match && match[1]) {
                        return match[1].trim();
                    }
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    private async extractDetailFromContainer(detailsContainer: Locator, identifier: string): Promise<Partial<PlaneInfo>> {
        const details: Partial<PlaneInfo> = {};
        try {
            const aircraftTextLocator = detailsContainer.getByText('Aircraft', { exact: true });
            if (await aircraftTextLocator.count() > 0) {
                const aircraftTypeElement = aircraftTextLocator.locator('..').locator('text').nth(1);
                if (await aircraftTypeElement.count() > 0) {
                    details.aircraftType = await aircraftTypeElement.textContent();
                } else {
                    const parentText = await aircraftTextLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Aircraft\\s+(.+?)(?:\\s|$)/);
                        if (match) details.aircraftType = match[1].trim();
                    }
                }
            }
            // Additional extraction logic for other fields...
        } catch (error: any) {
            details.error = `Extraction failed: ${error.message}`;
        }
        return details;
    }
}
