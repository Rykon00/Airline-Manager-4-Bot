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

                        console.log(`Row ${i+1}: fleetId="${fleetId}", registration="${registration}"`);

                        // Create base plane info
                        const planeInfo: Partial<PlaneInfo> = {
                            fleetId,
                            registration
                        };

                        // ✅ Konfigurierbare Detail-Extraktion
                        // maxDetailsToFetch: -1 = keine Details, 0 = alle, N = erste N Flugzeuge (über alle Seiten)
                        const shouldFetchDetails =
                            maxDetailsToFetch === 0 ? true :                        // 0 = alle
                            maxDetailsToFetch === -1 ? false :                      // -1 = keine
                            totalPlanesProcessed < maxDetailsToFetch;               // N = erste N (global!)

                        const SKIP_DETAILS = !shouldFetchDetails;

                        // Open detail page if link is available
                        if (detailLinkExists && !SKIP_DETAILS) {
                            console.log(`Opening detail page for plane ${registration || fleetId || 'unknown'}`);

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
                                    // Extract aircraft type (NO COLON!)
                                    const aircraftType = await this.getDetailValue(detailContainer, 'Aircraft');
                                    planeInfo.aircraftType = aircraftType;

                                    // Extract delivered date (NO COLON!)
                                    const delivered = await this.getDetailValue(detailContainer, 'Delivered');
                                    planeInfo.delivered = delivered;

                                    // Extract hours to check (NO COLON!) - Parse to number
                                    const hoursToCheckStr = await this.getDetailValue(detailContainer, 'Hours to check');
                                    planeInfo.hoursToCheck = this.parseNumber(hoursToCheckStr);

                                    // Extract range (NO COLON!) - Parse to km number
                                    const rangeStr = await this.getDetailValue(detailContainer, 'Range');
                                    planeInfo.rangeKm = this.parseRangeKm(rangeStr);

                                    // Extract flight hours/cycles (NO COLON!) - Parse to separate numbers
                                    const flightHoursCyclesStr = await this.getDetailValue(detailContainer, 'Flight hours/Cycles');
                                    const parsedHoursCycles = this.parseFlightHoursCycles(flightHoursCyclesStr);
                                    planeInfo.flightHours = parsedHoursCycles.hours;
                                    planeInfo.flightCycles = parsedHoursCycles.cycles;

                                    // Extract min runway (NO COLON!) - Parse to ft number
                                    const minRunwayStr = await this.getDetailValue(detailContainer, 'Min runway');
                                    planeInfo.minRunwayFt = this.parseRunwayFt(minRunwayStr);

                                    // Extract wear (NO COLON!) - Parse to percent number
                                    const wearStr = await this.getDetailValue(detailContainer, 'Wear');
                                    planeInfo.wearPercent = this.parsePercent(wearStr);

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
