import { Page, Locator, expect } from "@playwright/test";
import { GeneralUtils } from '../00_general.utils';
require('dotenv').config();

// Define the Flight interface
interface FlightHistory {
    timeAgo: string | null;            // z.B. "10 hours ago"
    route: string | null;              // z.B. "ELQ-FRA"
    routeName: string | null;          // z.B. "L-0008" (ROUTE-Bezeichnung für Routen-Management!)
    quotas: number | null;             // ✅ Zahl: 49934 (Quota-Punkte)
    passengers: {
        economy: number | null;        // Y (Economy-Passagiere)
        business: number | null;       // J (Business-Passagiere)
        first: number | null;          // F (First-Class-Passagiere)
        total: number | null;          // ✅ Gesamt-Passagiere
    };
    cargoWeightLbs: number | null;     // ✅ Zahl: 52095 (Gepäck/Fracht-Gewicht in Lbs)
    revenueUSD: number | null;         // ✅ Zahl: 105176 (Einnahmen in USD)
}

// Define the PlaneInfo interface
interface PlaneInfo {
    fleetId: string | null;           // ✅ EINDEUTIGER IDENTIFIER - ändert sich nie! (z.B. "105960065")
    registration: string | null;       // ✅ REGISTRIERUNG - kann geändert werden (z.B. "LU-002-2")
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
    flightHistory?: FlightHistory[];   // ✅ NEU: Flughistorie (optional - nur wenn Details geholt)
    error?: string;
}

export class FetchPlanesUtils {
    page : Page;

    constructor(page : Page) {
        this.page = page;
    }

    // ✅ Helper: Parse Zahl aus String mit Kommas (z.B. "49,934" → 49934)
    private parseNumber(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace(/[^0-9.-]/g, ''); // Entferne alles außer Ziffern, Punkt, Minus
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    // ✅ Helper: Parse USD-Betrag (z.B. "$105,176" → 105176)
    private parseUSD(str: string | null): number | null {
        if (!str) return null;
        const cleaned = str.replace(/[$,]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    /**
     * Fetches plane information with optional detail extraction
     * @param maxDetailsToFetch - Number of planes to fetch full details for (default: 5, 0 = all, -1 = none)
     */
    public async getAllPlanes(maxDetailsToFetch: number = 5): Promise<PlaneInfo[]> {
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
            let totalPlanesProcessed = 0; // ✅ Global counter über alle Seiten

            while (hasNextPage) {
                console.log(`Processing route list page ${currentPage}...`);
                // ✅ FIX: Die Rows SIND die div[id^="routeMainList"] Elemente, nicht ihre Kinder!
                const rowsLocator = this.page.locator('div[id^="routeMainList"]');
                const rowCount = await rowsLocator.count();
                console.log(`Found ${rowCount} route rows on page ${currentPage}.`);

                // ✅ FIX: Verarbeite ALLE Rows auf der Seite, nicht nur 20!
                const maxRowsToProcess = rowCount;
                for (let i = 0; i < maxRowsToProcess; i++) {
                    try {
                        const row = rowsLocator.nth(i);

                        // ✅ ECHTE SELEKTOREN (gefunden durch Debug-Analyse)
                        const planeIdElement = row.locator('span[id^="acRegList"]');
                        const detailLinkElement = row.locator('a').first();

                        console.log(`Processing plane ${totalPlanesProcessed + 1} (page ${currentPage}, row ${i+1}/${maxRowsToProcess})`);

                        // ✅ FIX: Verwende count() statt isVisible() - Elemente existieren, sind aber möglicherweise außerhalb des Viewports
                        const planeIdExists = await planeIdElement.count() > 0;
                        const detailLinkExists = await detailLinkElement.count() > 0;

                        // ✅ Extrahiere Fleet-ID (eindeutiger Identifier) und Registrierung
                        let fleetId: string | null = null;
                        let registration: string | null = null;

                        if (planeIdExists) {
                            // Registrierung aus dem Text-Content
                            registration = await planeIdElement.textContent().catch(() => null);

                            // Fleet-ID aus dem id-Attribut: "acRegList105960065" → "105960065"
                            const spanId = await planeIdElement.getAttribute('id').catch(() => null);
                            if (spanId) {
                                fleetId = spanId.replace('acRegList', '');
                            }
                        }

                        const detailPageUrl = detailLinkExists ? await detailLinkElement.getAttribute('href').catch(() => null) : null;

                        console.log(`Row ${i+1}: fleetId="${fleetId}", registration="${registration}", url="${detailPageUrl}"`);

                        // Create base plane info
                        const planeInfo: Partial<PlaneInfo> = {
                            fleetId,
                            registration,
                            detailPageUrl
                        };

                        // ✅ Konfigurierbare Detail-Extraktion
                        // maxDetailsToFetch: -1 = keine Details, 0 = alle, N = erste N Flugzeuge (über alle Seiten)
                        const shouldFetchDetails =
                            maxDetailsToFetch === 0 ? true :                        // 0 = alle
                            maxDetailsToFetch === -1 ? false :                      // -1 = keine
                            totalPlanesProcessed < maxDetailsToFetch;               // N = erste N (global!)

                        const SKIP_DETAILS = !shouldFetchDetails;

                        // Open detail page if link is available
                        if (detailPageUrl && detailLinkExists && !SKIP_DETAILS) {
                            console.log(`Opening detail page for plane ${registration || fleetId || 'unknown'}: ${detailPageUrl}`);

                            // Click on the detail link to open the page (reuse detailLinkElement)
                            await detailLinkElement.click();
                            
                            // Wait for detail page to load
                            await GeneralUtils.sleep(2000);
                            
                            // Extract additional information from detail page
                            // ✅ FIX: Der Ajax-Call lädt in 'detailsAction', nicht 'popContent'!
                            const detailContainer = this.page.locator('#detailsAction');
                            
                            // Wait for container to be visible
                            await detailContainer.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
                                console.log(`Detail page container not visible for plane ${registration || fleetId || 'unknown'}`);
                            });
                            
                            // Extract data if container is visible
                            if (await detailContainer.isVisible()) {
                                try {
                                    // Extract aircraft type
                                    const aircraftType = await this.getTextFromDivLabel(detailContainer, 'Aircraft:');
                                    planeInfo.aircraftType = aircraftType;
                                    
                                    // Extract delivered date
                                    const delivered = await this.getTextFromDivLabel(detailContainer, 'Delivered:');
                                    planeInfo.delivered = delivered;
                                    
                                    // Extract hours to check
                                    const hoursToCheck = await this.getTextFromDivLabel(detailContainer, 'Hours to check:');
                                    planeInfo.hoursToCheck = hoursToCheck;
                                    
                                    // Extract range
                                    const range = await this.getTextFromDivLabel(detailContainer, 'Range:');
                                    planeInfo.range = range;
                                    
                                    // Extract flight hours/cycles
                                    const flightHoursCycles = await this.getTextFromDivLabel(detailContainer, 'Flight hours/cycles:');
                                    planeInfo.flightHoursCycles = flightHoursCycles;
                                    
                                    // Extract min runway
                                    const minRunway = await this.getTextFromDivLabel(detailContainer, 'Min. runway:');
                                    planeInfo.minRunway = minRunway;
                                    
                                    // Extract wear
                                    const wear = await this.getTextFromDivLabel(detailContainer, 'Wear:');
                                    planeInfo.wear = wear;

                                    // ✅ NEU: Extract flight history
                                    const flightHistory: FlightHistory[] = [];
                                    const flightHistoryContainer = detailContainer.locator('#flight-history');

                                    if (await flightHistoryContainer.count() > 0) {
                                        const flightRows = flightHistoryContainer.locator('div.row.bg-light');
                                        const rowCount = await flightRows.count();
                                        console.log(`Found ${rowCount} flights in history`);

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
                                                // Extrahiere innerHTML weil Text zusammenläuft
                                                const col2HTML = await cols.nth(1).innerHTML();
                                                const col2Text = await cols.nth(1).textContent();

                                                // Extrahiere RouteNamen (vor <br> oder <span>)
                                                const routeNameMatch = col2HTML.match(/^([^<]+)/);
                                                const routeName = routeNameMatch ? routeNameMatch[1].trim() : null;

                                                // Quotas sind im <span class="s-text">
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

                                                // ✅ Parse zu Zahlen
                                                const economy = yMatch ? parseInt(yMatch[1]) : null;
                                                const business = jMatch ? parseInt(jMatch[1]) : null;
                                                const first = fMatch ? parseInt(fMatch[1]) : null;
                                                const total = (economy || 0) + (business || 0) + (first || 0);

                                                flightHistory.push({
                                                    timeAgo,
                                                    route,
                                                    routeName,
                                                    quotas: this.parseNumber(quotasStr),              // ✅ Zahl
                                                    passengers: {
                                                        economy,
                                                        business,
                                                        first,
                                                        total: total > 0 ? total : null              // ✅ Gesamt
                                                    },
                                                    cargoWeightLbs: this.parseNumber(cargoMatch ? cargoMatch[1] : null), // ✅ Zahl
                                                    revenueUSD: this.parseUSD(revenueStr)            // ✅ Zahl
                                                });
                                            } catch (err) {
                                                console.error(`Error extracting flight ${j}:`, err);
                                            }
                                        }
                                    }

                                    planeInfo.flightHistory = flightHistory;
                                    console.log(`Successfully extracted details for plane ${registration || fleetId || 'unknown'} (${flightHistory.length} flights)`);
                                } catch (error) {
                                    console.error(`Error extracting details from modal for plane ${registration || fleetId || 'unknown'}:`, error);
                                }
                                
                                // ✅ RICHTIGE LÖSUNG: Klicke weißen Zurück-Pfeil (nicht Modal schließen!)
                                // <span class="glyphicons glyphicons-chevron-left" onclick="$('#detailsAction').hide();">
                                try {
                                    const backButton = detailContainer.locator('span.glyphicons-chevron-left').first();
                                    if (await backButton.count() > 0) {
                                        console.log('Clicking back arrow to return to list...');
                                        await backButton.click();
                                        await GeneralUtils.sleep(500);
                                    } else {
                                        console.log('Back arrow not found, trying ESC...');
                                        await this.page.keyboard.press('Escape');
                                        await GeneralUtils.sleep(500);
                                    }
                                } catch (err) {
                                    console.error('Error clicking back button:', err);
                                    await this.page.keyboard.press('Escape');
                                    await GeneralUtils.sleep(500);
                                }
                            }
                        }
                        
                        allPlanesData.push(planeInfo as PlaneInfo);
                        totalPlanesProcessed++; // ✅ Increment global counter

                        // Add a small delay between processing rows to avoid overwhelming the site
                        await GeneralUtils.sleep(500);
                    } catch (error) {
                        console.error(`Error processing row ${i+1} on page ${currentPage}:`, error);
                        totalPlanesProcessed++; // ✅ Increment auch bei Fehler
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
            // ✅ FIX: Verwende count() statt expect().toBeVisible()
            if (await labelHostingDivLocator.count() === 0) {
                return null;
            }
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
