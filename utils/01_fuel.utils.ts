import { Page } from "@playwright/test";
import { PriceAnalyticsUtils } from "./05_priceAnalytics.utils";

require('dotenv').config();

/**
 * Chart Data Point
 */
interface ChartDataPoint {
  timestamp: string; // ISO string in UTC
  price: number;
}

export class FuelUtils {
    maxFuelPrice : number;
    maxCo2Price : number;
    page : Page;
    private priceAnalytics: PriceAnalyticsUtils;
    private chartsScraped: boolean = false; // Flag to track if charts were already scraped

    constructor(page : Page) {
        this.maxFuelPrice = parseInt(process.env.MAX_FUEL_PRICE!);
        this.maxCo2Price = parseInt(process.env.MAX_CO2_PRICE!);
        this.page = page;
        this.priceAnalytics = new PriceAnalyticsUtils();

        console.log("Max Fuel Price: " + this.maxFuelPrice);
        console.log("Max Co2 Price: " + this.maxCo2Price);
    }

    public async buyFuel() {
        console.log('🔄 Starting Fuel purchase analysis...')

        const getCurrentFuelPrice = async () => {
            let fuelText = await this.page.getByText('Total price$').locator('b > span').innerText();
            fuelText = fuelText.replaceAll(',', '');

            return parseInt(fuelText);
        }

        const getCurrentHolding = async () => {
            let holdingText = await this.page.locator('#holding').innerText();
            holdingText = holdingText.replaceAll(',', '');

            return parseInt(holdingText);
        }

        const getEmptyFuel = async () => {
            const emptyText = (await this.page.locator('#remCapacity').innerText()).replaceAll(',', '')

            return parseInt(emptyText);
        }

        try {
            const emptyFuel = await getEmptyFuel();
            if(emptyFuel === 0) {
                console.log('⏸️ Fuel storage is full, skipping purchase');
                return;
            }

            const curFuelPrice = await getCurrentFuelPrice();
            const curHolding = await getCurrentHolding();

            console.log(`📊 Current Fuel Price: $${curFuelPrice.toLocaleString()}`);
            console.log(`📦 Current Holding: ${curHolding.toLocaleString()} L`);
            console.log(`🔓 Available Capacity: ${emptyFuel.toLocaleString()} L`);

            // Scrape Fuel chart (while popup is open!)
            if (!this.chartsScraped) {
                try {
                    const fuelChartData = await this.scrapeFuelChart();

                    if (fuelChartData.length > 0) {
                        console.log(`📊 Scraped ${fuelChartData.length} fuel price points from chart`);
                        this.priceAnalytics.addExternalPriceEntries('fuel', fuelChartData);
                    }
                } catch (error) {
                    console.error('❌ Failed to scrape fuel chart:', error);
                }
            }

            // Use intelligent price analysis
            const analysis = this.priceAnalytics.shouldBuyNow(
                'fuel',
                curFuelPrice,
                this.maxFuelPrice,
                curHolding,
                2000000 // Emergency threshold
            );

            console.log(`\n${analysis.reason}`);
            console.log(`📈 Trend: ${analysis.stats.trend}, Confidence: ${analysis.stats.confidence}%`);

            if (analysis.shouldBuy) {
                // Determine purchase amount
                let purchaseAmount: string;

                if (curHolding < 2000000) {
                    // Emergency: buy at least 2M
                    purchaseAmount = '2000000';
                    console.log('🚨 Emergency purchase: Buying 2,000,000 L');
                } else {
                    // Normal purchase: fill capacity
                    purchaseAmount = emptyFuel.toString();
                    console.log(`✅ Regular purchase: Buying ${emptyFuel.toLocaleString()} L`);
                }

                await this.page.getByPlaceholder('Amount to purchase').click();
                await this.page.getByPlaceholder('Amount to purchase').press('Control+a');
                await this.page.getByPlaceholder('Amount to purchase').fill(purchaseAmount);
                await this.page.getByRole('button', { name: ' Purchase' }).click();

                console.log(`✅ Fuel purchased successfully! Amount: ${parseInt(purchaseAmount).toLocaleString()} L at $${curFuelPrice}/L`);
                // TODO: Add to purchase log (not price history!)
            } else {
                console.log('⏸️ Skipping fuel purchase - waiting for better price');
            }

            // Print detailed price report
            console.log(this.priceAnalytics.generatePriceReport('fuel'));

        } catch (error) {
            console.error('❌ Error during fuel purchase:', error);
            throw new Error(`Fuel purchase failed: ${error}`);
        }
    }

    public async buyCo2() {
        console.log('🔄 Starting CO2 purchase analysis...')

        const getCurrentCo2Price = async () => {
            let co2Text = await this.page.getByText('Total price$').locator('b > span').innerText();
            co2Text = co2Text.replaceAll(',', '');

            return parseInt(co2Text);
        }

        const getCurrentHolding = async () => {
            let holdingText = await this.page.locator('#holding').innerText();
            holdingText = holdingText.replaceAll(',', '');

            return parseInt(holdingText);
        }

        const getEmptyCO2 = async () => {
            const emptyText = (await this.page.locator('#remCapacity').innerText()).replaceAll(',', '')

            return parseInt(emptyText);
        }

        try {
            const emptyCo2 = await getEmptyCO2();
            const curCo2Price = await getCurrentCo2Price();
            const curHolding = await getCurrentHolding();

            console.log(`📊 Current CO2 Price: $${curCo2Price.toLocaleString()}`);
            console.log(`📦 Current Holding: ${curHolding.toLocaleString()} kg`);
            console.log(`🔓 Available Capacity: ${emptyCo2.toLocaleString()} kg`);

            // Scrape CO2 chart (while popup is open!)
            if (!this.chartsScraped) {
                try {
                    const co2ChartData = await this.scrapeCO2Chart();

                    if (co2ChartData.length > 0) {
                        console.log(`📊 Scraped ${co2ChartData.length} CO2 price points from chart`);
                        this.priceAnalytics.addExternalPriceEntries('co2', co2ChartData);
                    }

                    this.chartsScraped = true;
                } catch (error) {
                    console.error('❌ Failed to scrape CO2 chart:', error);
                }
            }

            // Check if storage is full AFTER scraping chart
            if(emptyCo2 === 0) {
                console.log('⏸️ CO2 storage is full, skipping purchase');
                return;
            }

            // Use intelligent price analysis
            const analysis = this.priceAnalytics.shouldBuyNow(
                'co2',
                curCo2Price,
                this.maxCo2Price,
                curHolding,
                1000000 // Emergency threshold
            );

            console.log(`\n${analysis.reason}`);
            console.log(`📈 Trend: ${analysis.stats.trend}, Confidence: ${analysis.stats.confidence}%`);

            if (analysis.shouldBuy) {
                // Determine purchase amount
                let purchaseAmount: string;

                if (curHolding < 1000000) {
                    // Emergency: buy at least 1M
                    purchaseAmount = '1000000';
                    console.log('🚨 Emergency purchase: Buying 1,000,000 kg');
                } else {
                    // Normal purchase: fill capacity
                    purchaseAmount = emptyCo2.toString();
                    console.log(`✅ Regular purchase: Buying ${emptyCo2.toLocaleString()} kg`);
                }

                await this.page.getByPlaceholder('Amount to purchase').click();
                await this.page.getByPlaceholder('Amount to purchase').press('Control+a');
                await this.page.getByPlaceholder('Amount to purchase').fill(purchaseAmount);
                await this.page.getByRole('button', { name: ' Purchase' }).click();

                console.log(`✅ CO2 purchased successfully! Amount: ${parseInt(purchaseAmount).toLocaleString()} kg at $${curCo2Price}/kg`);
                // TODO: Add to purchase log (not price history!)
            } else {
                console.log('⏸️ Skipping CO2 purchase - waiting for better price');
            }

            // Print detailed price report
            console.log(this.priceAnalytics.generatePriceReport('co2'));

        } catch (error) {
            console.error('❌ Error during CO2 purchase:', error);
            throw new Error(`CO2 purchase failed: ${error}`);
        }
    }


    // ==================== CHART SCRAPING METHODS ====================

    /**
     * Normalize timestamp to 30-minute UTC timeslot
     * Returns ISO string rounded to nearest 30min (e.g., 14:00 or 14:30)
     * Uses UTC time (AM4 standard)
     */
    private getTimeslot(timestamp: Date): string {
        const utcMinutes = timestamp.getUTCMinutes();
        const roundedMinutes = utcMinutes < 30 ? 0 : 30;
        const slotTime = new Date(timestamp);
        slotTime.setUTCMinutes(roundedMinutes, 0, 0);
        return slotTime.toISOString();
    }

    /**
     * Parse time label from chart (e.g., "13:00:00") to full UTC timestamp
     *
     * WICHTIG: Die Chart-Labels zeigen nur Uhrzeit, kein Datum!
     * Wir müssen das Datum basierend auf der aktuellen Zeit ableiten.
     *
     * @param timeLabel Format: "HH:MM:SS" (z.B. "13:00:00")
     * @returns ISO timestamp string in UTC
     */
    private parseChartTimeLabel(timeLabel: string): string {
        const [hours, minutes] = timeLabel.split(':').map(Number);

        const now = new Date();
        const chartTime = new Date();
        chartTime.setUTCHours(hours, minutes, 0, 0);

        // Wenn die Chart-Zeit in der Zukunft liegt, ist es vom Vortag
        if (chartTime.getTime() > now.getTime()) {
            chartTime.setUTCDate(chartTime.getUTCDate() - 1);
        }

        return this.getTimeslot(chartTime);
    }

    /**
     * Extract Highcharts data from page
     *
     * @param chartId ID des Chart-Elements (z.B. "co2Chart" oder "fuelChart")
     * @returns Array von ChartDataPoints
     */
    private async extractHighchartsData(chartId: string): Promise<ChartDataPoint[]> {
        const chartData = await this.page.evaluate((id) => {
            // Finde das Chart-Element
            const chartElement = document.getElementById(id);
            if (!chartElement) {
                return { error: `Chart element #${id} not found` };
            }

            // Hole Highcharts Chart-Nummer aus data-highcharts-chart Attribut
            const chartNumber = chartElement.getAttribute('data-highcharts-chart');
            if (!chartNumber) {
                return { error: 'No highcharts chart number found' };
            }

            // Greife auf Highcharts-Instanz zu
            const Highcharts = (window as any).Highcharts;
            if (!Highcharts || !Highcharts.charts) {
                return { error: 'Highcharts not found' };
            }

            const chart = Highcharts.charts[parseInt(chartNumber)];
            if (!chart || !chart.series || chart.series.length === 0) {
                return { error: 'Chart or series not found' };
            }

            // Extrahiere Daten aus der ersten Serie
            const series = chart.series[0];
            const points = series.data;

            const extractedData: Array<{ time: string; price: number }> = [];

            for (const point of points) {
                // X-Wert ist die Zeit (als String, z.B. "13:00:00")
                // Y-Wert ist der Preis
                const timeLabel = point.category || point.name || '';
                const price = point.y;

                if (timeLabel && typeof price === 'number') {
                    extractedData.push({
                        time: timeLabel,
                        price: price
                    });
                }
            }

            return { success: true, data: extractedData };
        }, chartId);

        if ('error' in chartData) {
            console.warn(`⚠️ ${chartData.error}`);
            return [];
        }

        if (!chartData.success || !chartData.data) {
            console.warn('⚠️ Failed to extract chart data');
            return [];
        }

        // Konvertiere zu ChartDataPoints mit vollständigen Timestamps
        const dataPoints: ChartDataPoint[] = chartData.data.map(item => ({
            timestamp: this.parseChartTimeLabel(item.time),
            price: item.price
        }));

        return dataPoints;
    }

    /**
     * Scrape CO2 Chart Daten
     *
     * Extrahiert Daten direkt aus der Highcharts-Instanz
     *
     * @returns Array von ChartDataPoints
     */
    async scrapeCO2Chart(): Promise<ChartDataPoint[]> {
        console.log('📊 Scraping CO2 chart data...');

        try {
            // Warte bis Chart geladen ist
            await this.page.waitForSelector('#co2Chart[data-highcharts-chart]', { timeout: 10000 });

            const data = await this.extractHighchartsData('co2Chart');
            console.log(`✅ Extracted ${data.length} CO2 data points from chart`);

            return data;

        } catch (error) {
            console.error('❌ Error scraping CO2 chart:', error);
            return [];
        }
    }

    /**
     * Scrape Fuel Chart Daten
     *
     * WICHTIG: Setzt voraus, dass wir bereits auf der Fuel Market Seite sind!
     *
     * @returns Array von ChartDataPoints
     */
    async scrapeFuelChart(): Promise<ChartDataPoint[]> {
        console.log('⛽ Scraping Fuel chart data...');

        try {
            // Chart sollte bereits geladen sein (Navigation erfolgt vorher)
            await this.page.waitForSelector('#fuelChart[data-highcharts-chart]', { timeout: 10000 });

            const data = await this.extractHighchartsData('fuelChart');
            console.log(`✅ Extracted ${data.length} Fuel data points from chart`);

            return data;

        } catch (error) {
            console.error('❌ Error scraping Fuel chart:', error);
            return [];
        }
    }
}
