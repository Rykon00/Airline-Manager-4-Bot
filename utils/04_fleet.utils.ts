import { Page, Locator, expect } from "@playwright/test"; // Added expect
import { GeneralUtils } from './00_general.utils'; // Ensured GeneralUtils import
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
    }    public async getAllPlanes(): Promise<PlaneInfo[]> { // Updated return type
        console.log('Fetching all planes...');
        const allPlanesData: PlaneInfo[] = []; // Updated type

        try {
            console.log('Phase 1: Scraping list pages.');
            await this.page.locator('#mapRoutes').getByRole('img').click();
            // Consider replacing sleep with a more specific wait for navigation/content loading if issues persist
            await GeneralUtils.sleep(1000); 

            console.log('Waiting for routes list (div[id^="routeMainList"]) to load...');
            try {
                await this.page.waitForSelector('div[id^="routeMainList"]', { timeout: 20000 });
                console.log('Routes list (div[id^="routeMainList"]) loaded successfully.');
                
                try {
                    console.log('Attempting to wait for the first route row (div) to become visible...');
                    await this.page.locator('div[id^="routeMainList"] > div').first().waitFor({ state: 'visible', timeout: 10000 });
                    console.log('First route row (div) is visible.');
                } catch (rowError: any) { 
                    console.log(`First route row (div) not found or not visible within timeout: ${(rowError as Error).message}. List might be empty or rows are not direct 'div' children as expected.`);
                }

            } catch (error: any) { 
                console.error('Critical Timeout: Waiting for routes list (div[id^="routeMainList"]) failed. Aborting.', (error as Error).message);
                return [{ planeId: null, detailPageUrl: null, rawRouteText: null, aircraftType: null, delivered: null, hoursToCheck: null, range: null, flightHoursCycles: null, minRunway: null, wear: null, planeType: null, departureAirport: null, arrivalAirport: null, error: 'Failed to load routes list.' }];
            }

            let hasNextPage = true;
            let currentPage = 1;
            const baseUrl = new URL(this.page.url()).origin;

            while (hasNextPage) {
                console.log(`Processing route list page ${currentPage}...`);
                
                const rowsLocator = this.page.locator('div[id^="routeMainList"] > div');
                try {
                    await rowsLocator.first().waitFor({ state: 'visible', timeout: 10000 }); 
                    console.log(`First row on page ${currentPage} is visible.`);
                } catch (e: any) {
                    console.log(`No rows visible on page ${currentPage} or timeout: ${e.message}. Assuming end of pagination or empty page.`);
                    hasNextPage = false; 
                    continue;
                }

                const rowCount = await rowsLocator.count();
                console.log(`Found ${rowCount} route rows on page ${currentPage}.`);

                if (rowCount === 0) {
                    console.log(`No route rows found on page ${currentPage}. Ending pagination.`);
                    hasNextPage = false;
                    continue;
                }

                for (let i = 0; i < rowCount; i++) {
                    const currentRow = rowsLocator.nth(i);
                    let planeInfo: PlaneInfo = { planeId: null, detailPageUrl: null, rawRouteText: null, aircraftType: null, delivered: null, hoursToCheck: null, range: null, flightHoursCycles: null, minRunway: null, wear: null, planeType: null, departureAirport: null, arrivalAirport: null, error: undefined };
                    const identifier = `Row ${i}, Page ${currentPage}`;

                    const planeLinkLocator = currentRow.locator('a').first();
                    const linkCount = await planeLinkLocator.count();

                    if (linkCount === 0) {
                        const errorMsg = `${identifier}: No 'a' tag found by planeLinkLocator (likely a separator or empty row).`;
                        console.warn(errorMsg);
                        planeInfo.error = errorMsg;
                    } else {
                        try {
                            await planeLinkLocator.waitFor({ state: 'visible', timeout: 5000 });
                            const planeIdFromLink = await planeLinkLocator.textContent();
                            const detailUrl = await planeLinkLocator.getAttribute('href');

                            planeInfo.planeId = planeIdFromLink ? planeIdFromLink.trim() : null;
                            planeInfo.detailPageUrl = detailUrl ? detailUrl.trim() : null;
                            console.log(`${identifier}: Extracted planeId: ${planeInfo.planeId}, detailPageUrl: ${planeInfo.detailPageUrl}`);

                            if (planeInfo.detailPageUrl === 'javascript:void(0);') {
                                console.log(`${identifier}: Clicking javascript:void(0) link for ${planeInfo.planeId}`);
                                await planeLinkLocator.click();
                                
                                const detailsContainerLocator = this.page.locator('#detailsAction');
                                try {                                    await detailsContainerLocator.waitFor({ state: 'visible', timeout: 15000 });
                                    console.log(`${identifier}: #detailsAction container is visible for ${planeInfo.planeId}.`);
                                    
                                    // Wait for modal content to be loaded by checking for any content in the container
                                    await GeneralUtils.sleep(2000); // Give modal time to load content
                                    console.log(`${identifier}: Modal content loaded for ${planeInfo.planeId}.`);

                                    const details = await this.extractDetailFromContainer(detailsContainerLocator, planeInfo.planeId || identifier);
                                    planeInfo = { ...planeInfo, ...details };
                                    console.log(`${identifier}: Successfully extracted details for ${planeInfo.planeId}`);

                                    // Attempt to close the modal by clicking the Fleet tab to return to overview
                                    console.log(`${identifier}: Attempting to close details modal for ${planeInfo.planeId} by clicking Fleet tab.`);
                                    await this.page.getByRole('button', { name: ' Fleet' }).click();
                                    await detailsContainerLocator.waitFor({ state: 'hidden', timeout: 10000 });
                                    console.log(`${identifier}: Details modal successfully closed for ${planeInfo.planeId}.`);

                                } catch (detailsError: any) {
                                    console.error(`${identifier}: Error during detail processing or closing for ${planeInfo.planeId}: ${(detailsError as Error).message}`);
                                    planeInfo.error = (planeInfo.error ? planeInfo.error + "; " : "") + `Details processing/closing failed: ${(detailsError as Error).message}`;
                                      // Robustly attempt to close modal if it's still visible after an error
                                    if (await detailsContainerLocator.isVisible()) {
                                        console.warn(`${identifier}: Modal still visible after error. Attempting to close again for ${planeInfo.planeId}.`);
                                        try {
                                            console.log(`${identifier}: Trying Fleet tab to close modal for ${planeInfo.planeId}.`);
                                            await this.page.getByRole('button', { name: ' Fleet' }).click();
                                            await detailsContainerLocator.waitFor({ state: 'hidden', timeout: 5000 });
                                            console.log(`${identifier}: Details modal successfully closed after error for ${planeInfo.planeId}.`);
                                        } catch (closeError: any) {
                                            console.warn(`${identifier}: Fleet tab failed. Trying Escape key as fallback for ${planeInfo.planeId}.`);
                                            try {
                                                await this.page.keyboard.press('Escape');
                                                await detailsContainerLocator.waitFor({ state: 'hidden', timeout: 5000 });
                                                console.log(`${identifier}: Details modal successfully closed with Escape key for ${planeInfo.planeId}.`);
                                            } catch (escapeError: any) {
                                                console.error(`${identifier}: FAILED to close details modal after error for ${planeInfo.planeId}: ${(escapeError as Error).message}. Script might be stuck.`);
                                                planeInfo.error += `; FAILED_TO_CLOSE_MODAL_AFTER_ERROR: ${(escapeError as Error).message}`;
                                                // Consider a more drastic recovery if this happens often, e.g., page reload.
                                            }
                                        }
                                    }
                                }
                            } else if (planeInfo.detailPageUrl) {
                                console.log(`${identifier}: Found direct detailPageUrl: ${planeInfo.detailPageUrl}. (Detail scraping for direct URLs not yet fully implemented).`);
                            }

                        } catch (extractionError: any) {
                            console.error(`${identifier}: Error extracting basic info or clicking link: ${(extractionError as Error).message}`);
                            planeInfo.error = (planeInfo.error ? planeInfo.error + "; " : "") + `Basic extraction/click failed: ${(extractionError as Error).message}`;
                        }
                    }
                    
                    allPlanesData.push(planeInfo);
                    console.log(`Row ${i}, Page ${currentPage}: Plane info processed and pushed to allPlanesData.`);
                }

                // Check if there's a next page button and if it's visible/enabled
                try {
                    const nextPageLocator = this.page.locator('a[title="Next"]');
                    const isVisible = await nextPageLocator.isVisible();
                    let isDisabled = true; // Assume disabled if not visible or attribute check fails
                    if (isVisible) {
                        const classAttribute = await nextPageLocator.getAttribute('class');
                        isDisabled = classAttribute ? classAttribute.includes('disabled') : true; // If no class attribute, assume disabled or not the element we want
                    }
                    hasNextPage = isVisible && !isDisabled;
                    console.log(`Next page button visibility: ${isVisible}, disabled: ${isDisabled}, hasNextPage: ${hasNextPage}`);

                    if (hasNextPage) {
                        console.log(`Navigating to next page ${currentPage + 1}...`);
                        await Promise.all([
                            this.page.waitForLoadState('networkidle'), // Wait for network to be idle
                            nextPageLocator.click() // Click the next page button
                        ]);
                        console.log(`Successfully navigated to page ${currentPage + 1}.`);
                        currentPage++;
                        await GeneralUtils.sleep(1000); // Adjusted wait time for demo
                    } else {
                        console.log(`No more pages to process. Ending pagination.`);
                    }
                } catch (paginationError: any) {
                    console.error(`Error while handling pagination: ${(paginationError as Error).message}`);
                    hasNextPage = false; // Exit the loop on error
                }
            }

            console.log("Phase 1 (List Page Scraping) completed.");

            // Phase 2: Visit detail pages and scrape more info
            // ... (implementation for phase 2 will go here)
            // Phase 2 is now integrated into Phase 1 for javascript:void(0) links.
            // If separate navigation for other URLs were needed, it would go here.
            console.log("Phase 2 (Detail Page Scraping) for javascript:void(0) links is integrated into Phase 1.");

        } catch (error: any) {
            console.error(`Error in getAllPlanes: ${(error as Error).message}`);
            // Optionally rethrow or handle as per overall strategy
        }
        return allPlanesData; // Added missing return statement
    }

    private async getTextFromDivLabel(container: Locator, labelWithColon: string, timeout = 7000): Promise<string | null> {
        try {
            // Locator for a div that has a text node or child element containing the label.
            const labelHostingDivLocator = container.locator('div').filter({ hasText: labelWithColon }).first();
            await expect(labelHostingDivLocator).toBeVisible({ timeout });

            // Method 1: Value is in the same div as the label, after the label text.
            // e.g., <div>Aircraft Type: Boeing 737</div>
            let textContent = await labelHostingDivLocator.textContent();
            if (textContent) {
                // Escape special characters in labelWithColon for regex
                const escapedLabel = labelWithColon.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
                console.log(`Escaped label for regex: ${escapedLabel}`);
                const regex = new RegExp(escapedLabel + "\\s*(.+)", "i");
                const match = textContent.match(regex);
                if (match && match[1]) {
                    console.log(`Extracted for "${labelWithColon}" (Method 1 - same div): "${match[1].trim()}"`);
                    return match[1].trim();
                }
            }

            // Method 2: Value is in the next sibling div.
            // e.g., <div>Aircraft Type:</div><div>Boeing 737</div>
            const nextDivSiblingLocator = labelHostingDivLocator.locator('xpath=./following-sibling::div[1]');
            if (await nextDivSiblingLocator.count() > 0) {
                const siblingTextContent = await nextDivSiblingLocator.textContent();
                if (siblingTextContent) {
                    console.log(`Extracted for "${labelWithColon}" (Method 2 - sibling div): "${siblingTextContent.trim()}"`);
                    return siblingTextContent.trim();
                }
            }
            
            // Method 3: Label is in a child (e.g. <strong>) of the div, and value is also a child or text node in that div
            // e.g. <div><strong>Label:</strong> Value</div>
            const strongLabelInDiv = labelHostingDivLocator.locator(`strong:has-text("${labelWithColon}")`);
            if(await strongLabelInDiv.count() > 0) {
                // Attempt to get the text of the parent div and extract the value part
                const parentDivText = await labelHostingDivLocator.textContent();
                if (parentDivText) {
                    const escapedLabel = labelWithColon.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedLabel + "\\s*(.+)", "i"); // Assuming label is followed by value
                    const match = parentDivText.match(regex);
                    if (match && match[1]) {
                        console.log(`Extracted for "${labelWithColon}" (Method 3 - strong in div): "${match[1].trim()}"`);
                        return match[1].trim();
                    }
                }
            }

            console.warn(`Value for label "${labelWithColon}" not found using div:has-text strategy or its variations.`);
            return null;
        } catch (e) {
            console.warn(`Error or timeout extracting for label "${labelWithColon}": ${(e as Error).message.split('\n')[0]}`);
            return null;
        }
    }    // Helper function to extract details from the #detailsAction container
    private async extractDetailFromContainer(detailsContainer: Locator, identifier: string): Promise<Partial<PlaneInfo>> {
        console.log(`Extracting details from #detailsAction for: ${identifier}`);
        const details: Partial<PlaneInfo> = {};

        try {
            // Extract aircraft type - look for text that follows "Aircraft" 
            const aircraftTextLocator = detailsContainer.getByText('Aircraft', { exact: true });
            if (await aircraftTextLocator.count() > 0) {
                // Get the next sibling or parent container that contains the aircraft type
                const aircraftTypeElement = aircraftTextLocator.locator('..').locator('text').nth(1);
                if (await aircraftTypeElement.count() > 0) {
                    details.aircraftType = await aircraftTypeElement.textContent();
                } else {
                    // Alternative: look for any text after "Aircraft" in the same container
                    const parentText = await aircraftTextLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Aircraft\s+(.+?)(?:\s|$)/);
                        if (match) details.aircraftType = match[1].trim();
                    }
                }
            }

            // Extract delivered date - look for text that follows "Delivered"
            const deliveredTextLocator = detailsContainer.getByText('Delivered');
            if (await deliveredTextLocator.count() > 0) {
                const deliveredElement = deliveredTextLocator.locator('..').locator('text').nth(1);
                if (await deliveredElement.count() > 0) {
                    details.delivered = await deliveredElement.textContent();
                } else {
                    // Alternative: look for pattern like "24 days ago"
                    const parentText = await deliveredTextLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Delivered\s+(.+?)(?:\s|$)/);
                        if (match) details.delivered = match[1].trim();
                    }
                }
            }

            // Extract hours to check - look for text that follows "Hours to check"
            const hoursToCheckLocator = detailsContainer.getByText('Hours to check');
            if (await hoursToCheckLocator.count() > 0) {
                const hoursElement = hoursToCheckLocator.locator('..').locator('text').nth(1);
                if (await hoursElement.count() > 0) {
                    details.hoursToCheck = await hoursElement.textContent();
                } else {
                    // Alternative: look for numeric pattern
                    const parentText = await hoursToCheckLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Hours to check\s+(\d+)/);
                        if (match) details.hoursToCheck = match[1];
                    }
                }
            }

            // Extract range - look for text that follows "Range"
            const rangeLocator = detailsContainer.getByText('Range');
            if (await rangeLocator.count() > 0) {
                const rangeElement = rangeLocator.locator('..').locator('text').nth(1);
                if (await rangeElement.count() > 0) {
                    details.range = await rangeElement.textContent();
                } else {
                    // Alternative: look for pattern like "1,700km"
                    const parentText = await rangeLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Range\s+([\d,]+km)/);
                        if (match) details.range = match[1];
                    }
                }
            }

            // Extract flight hours/cycles - look for text that follows "Flight hours/Cycles"
            const flightHoursCyclesLocator = detailsContainer.getByText('Flight hours/Cycles');
            if (await flightHoursCyclesLocator.count() > 0) {
                const flightHoursCyclesElement = flightHoursCyclesLocator.locator('..').locator('text').nth(1);
                if (await flightHoursCyclesElement.count() > 0) {
                    details.flightHoursCycles = await flightHoursCyclesElement.textContent();
                } else {
                    // Alternative: look for pattern like "/ 138"
                    const parentText = await flightHoursCyclesLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Flight hours\/Cycles\s+(.+?)(?:\s|$)/);
                        if (match) details.flightHoursCycles = match[1].trim();
                    }
                }
            }

            // Extract min runway - look for text that follows "Min runway"
            const minRunwayLocator = detailsContainer.getByText('Min runway');
            if (await minRunwayLocator.count() > 0) {
                const minRunwayElement = minRunwayLocator.locator('..').locator('text').nth(1);
                if (await minRunwayElement.count() > 0) {
                    details.minRunway = await minRunwayElement.textContent();
                } else {
                    // Alternative: look for pattern like "7,700ft"
                    const parentText = await minRunwayLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Min runway\s+([\d,]+ft)/);
                        if (match) details.minRunway = match[1];
                    }
                }
            }

            // Extract wear - look for text that follows "Wear"
            const wearLocator = detailsContainer.getByText('Wear');
            if (await wearLocator.count() > 0) {
                const wearElement = wearLocator.locator('..').locator('text').nth(1);
                if (await wearElement.count() > 0) {
                    details.wear = await wearElement.textContent();
                } else {
                    // Alternative: look for percentage pattern
                    const parentText = await wearLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Wear\s+([\d.]+%)/);
                        if (match) details.wear = match[1];
                    }
                }
            }

            // Extract plane type - look for text that follows "Type"
            const typeLocator = detailsContainer.getByText('Type', { exact: true });
            if (await typeLocator.count() > 0) {
                const typeElement = typeLocator.locator('..').locator('text').nth(1);
                if (await typeElement.count() > 0) {
                    details.planeType = await typeElement.textContent();
                } else {
                    // Alternative: look for "Pax" or other type indicators
                    const parentText = await typeLocator.locator('..').textContent();
                    if (parentText) {
                        const match = parentText.match(/Type\s+(.+?)(?:\s|$)/);
                        if (match) details.planeType = match[1].trim();
                    }
                }
            }

        } catch (error: any) {
            console.error(`Error extracting details for ${identifier}: ${error.message}`);
            details.error = `Extraction failed: ${error.message}`;
        }

        console.log(`Details extracted for ${identifier}: `, JSON.stringify(details, null, 2));

        if (!details.aircraftType && !details.range) { // If critical info is missing
            console.warn(`Critical details (Aircraft Type/Range) not found for ${identifier}. Modal content might not have loaded correctly or selectors need adjustment.`);
            details.error = "Failed to extract critical details from modal.";
        }
        return details;
    }
}