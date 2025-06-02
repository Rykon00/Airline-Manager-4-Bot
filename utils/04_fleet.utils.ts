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
                                try {
                                    await detailsContainerLocator.waitFor({ state: 'visible', timeout: 15000 });
                                    console.log(`${identifier}: #detailsAction container is visible for ${planeInfo.planeId}.`);
                                    
                                    // Wait for the back navigation link to be visible as a sign that the modal content is loaded
                                    const backNavigationLink = detailsContainerLocator.locator('a').filter({ hasText: /^< ?L-\\d+/ }).first();
                                    await expect(backNavigationLink).toBeVisible({ timeout: 10000 });
                                    console.log(`${identifier}: Modal content (back button) appears loaded for ${planeInfo.planeId}.`);

                                    const details = await this.extractDetailFromContainer(detailsContainerLocator, planeInfo.planeId || identifier);
                                    planeInfo = { ...planeInfo, ...details };
                                    console.log(`${identifier}: Successfully extracted details for ${planeInfo.planeId}`);

                                    // Attempt to close the modal by clicking the back button
                                    console.log(`${identifier}: Attempting to close details modal for ${planeInfo.planeId} by clicking the back button.`);
                                    await backNavigationLink.click();
                                    await detailsContainerLocator.waitFor({ state: 'hidden', timeout: 10000 });
                                    console.log(`${identifier}: Details modal successfully closed for ${planeInfo.planeId}.`);

                                } catch (detailsError: any) {
                                    console.error(`${identifier}: Error during detail processing or closing for ${planeInfo.planeId}: ${(detailsError as Error).message}`);
                                    planeInfo.error = (planeInfo.error ? planeInfo.error + "; " : "") + `Details processing/closing failed: ${(detailsError as Error).message}`;
                                    
                                    // Robustly attempt to close modal if it's still visible after an error
                                    if (await detailsContainerLocator.isVisible()) {
                                        console.warn(`${identifier}: Modal still visible after error. Attempting to close again for ${planeInfo.planeId}.`);
                                        try {
                                            const backNavOnError = detailsContainerLocator.locator('a').filter({ hasText: /^< ?L-\\d+/ }).first();
                                            if (await backNavOnError.isVisible({timeout: 3000})) { // Quick check for visibility
                                                await backNavOnError.click();
                                            } else {
                                                console.warn(`${identifier}: Back button not visible on error. Trying Escape key as fallback.`);
                                                await this.page.keyboard.press('Escape');
                                            }
                                            await detailsContainerLocator.waitFor({ state: 'hidden', timeout: 5000 });
                                            console.log(`${identifier}: Details modal successfully closed after error for ${planeInfo.planeId}.`);
                                        } catch (closeError: any) {
                                            console.error(`${identifier}: FAILED to close details modal after error for ${planeInfo.planeId}: ${(closeError as Error).message}. Script might be stuck.`);
                                            planeInfo.error += `; FAILED_TO_CLOSE_MODAL_AFTER_ERROR: ${(closeError as Error).message}`;
                                            // Consider a more drastic recovery if this happens often, e.g., page reload.
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
    }

    // Helper function to extract details from the #detailsAction container
    private async extractDetailFromContainer(detailsContainer: Locator, identifier: string): Promise<Partial<PlaneInfo>> {
        console.log(`Extracting details from #detailsAction for: ${identifier}`);
        const details: Partial<PlaneInfo> = {};

        // Wait for a general element in the modal to ensure content is likely loaded.
        // The caller of this function already waits for the back button,
        // which is a good sign. We can add a small delay or wait for a specific title if needed.
        // For now, rely on the back button wait and individual timeouts in getTextFromDivLabel.

        details.aircraftType = await this.getTextFromDivLabel(detailsContainer, "Aircraft Type:");
        details.delivered = await this.getTextFromDivLabel(detailsContainer, "Delivered:");
        
        // For "Hours to check", try a few common variations if the primary one fails
        details.hoursToCheck = await this.getTextFromDivLabel(detailsContainer, "Hours to A/C/D check:");
        if (!details.hoursToCheck) {
            details.hoursToCheck = await this.getTextFromDivLabel(detailsContainer, "Hours to C check:");
        }
        if (!details.hoursToCheck) {
            details.hoursToCheck = await this.getTextFromDivLabel(detailsContainer, "Hours to D check:");
        }
        if (!details.hoursToCheck) {
            details.hoursToCheck = await this.getTextFromDivLabel(detailsContainer, "Hours to A check:");
        }
        if (!details.hoursToCheck) {
            details.hoursToCheck = await this.getTextFromDivLabel(detailsContainer, "Maintenance:");
        }


        details.range = await this.getTextFromDivLabel(detailsContainer, "Range:");

        const flightHours = await this.getTextFromDivLabel(detailsContainer, "Flight Hours:");
        const cycles = await this.getTextFromDivLabel(detailsContainer, "Cycles:");
        if (flightHours && cycles) {
            details.flightHoursCycles = `${flightHours} / ${cycles}`;
        } else if (flightHours) {
            details.flightHoursCycles = flightHours;
        } else if (cycles) {
            details.flightHoursCycles = `? / ${cycles}`;
        }

        details.minRunway = await this.getTextFromDivLabel(detailsContainer, "Min. Runway:");
        if (!details.minRunway) {
            details.minRunway = await this.getTextFromDivLabel(detailsContainer, "Min Runway:");
        }
        
        details.wear = await this.getTextFromDivLabel(detailsContainer, "Wear:");
        
        // planeType might be the same as aircraftType or a more general category.
        // For now, let's assume aircraftType is the specific one we need.
        // details.planeType = await this.getTextFromDivLabel(detailsContainer, "Plane Type:");


        console.log(`Details extracted for ${identifier}: `, JSON.stringify(details, null, 2));

        if (!details.aircraftType && !details.range) { // If critical info is missing
            console.warn(`Critical details (Aircraft Type/Range) not found for ${identifier}. Modal content might not have loaded correctly or selectors need adjustment.`);
            details.error = "Failed to extract critical details from modal.";
        }
        return details;
    }
}