import { Page } from "@playwright/test";
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

export class GeneralUtils {
    username : string;
    password : string;
    page : Page;
    private cookiesPath : string = path.join(process.cwd(), 'data', 'cookies.json');

    constructor(page : Page) {
        if (!process.env.EMAIL || !process.env.PASSWORD) {
            console.error('ERROR: Umgebungsvariablen EMAIL oder PASSWORD fehlen!');
            console.error('Bitte erstelle eine .env Datei mit EMAIL und PASSWORD (siehe .env.example)');
            throw new Error('Missing required environment variables: EMAIL and/or PASSWORD');
        }
        this.username = process.env.EMAIL;
        this.password = process.env.PASSWORD;
        this.page = page;
    }

    public static async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async saveCookies(page: Page): Promise<void> {
        try {
            const cookies = await page.context().cookies();
            fs.mkdirSync(path.dirname(this.cookiesPath), { recursive: true });
            fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
            console.log('✅ Cookies saved to data/cookies.json');
        } catch (error) {
            console.error('❌ Error saving cookies:', error);
        }
    }

    private async loadCookies(page: Page): Promise<boolean> {
        try {
            if (!fs.existsSync(this.cookiesPath)) {
                console.log('ℹ️  No cookies.json found, will login normally');
                return false;
            }

            const cookiesString = fs.readFileSync(this.cookiesPath, 'utf-8');
            const cookies = JSON.parse(cookiesString);
            await page.context().addCookies(cookies);
            console.log('✅ Cookies loaded from data/cookies.json');
            return true;
        } catch (error) {
            console.error('❌ Error loading cookies:', error);
            return false;
        }
    }

    public async login(page: Page) {
        console.log('Logging in...');

        // Load cookies if available (silent operation)
        await this.loadCookies(page);

        // Navigate to the site
        await page.goto('https://www.airlinemanager.com/');
        await GeneralUtils.sleep(2000); // Wait for page to load

        // Check if we need to login by looking for the "PLAY FREE NOW" button
        // If button is visible → not logged in (landing page)
        // If button is NOT visible → already logged in (game dashboard)
        const playButton = page.getByRole('button', { name: 'PLAY FREE NOW' });
        const needsLogin = await playButton.isVisible().catch(() => false);

        if (needsLogin) {
            console.log('🔐 Not logged in, performing login...');
            // Normal login flow
            await playButton.click();
            await page.getByRole('button', { name: 'Log in' }).click();
            await page.locator('#lEmail').fill(this.username);
            await page.locator('#lPass').fill(this.password);
            await page.getByRole('button', { name: 'Log In', exact: true }).click();

            // Wait for login to complete
            await GeneralUtils.sleep(3000);

            // Save cookies for next time
            await this.saveCookies(page);
            console.log('✅ Logged in successfully!');
        } else {
            console.log('✅ Already logged in with cookies, waiting for game to load...');
            // Just wait for game interface to be ready
            await page.waitForSelector('#mapRoutes', { timeout: 15000 });
            console.log('✅ Game loaded successfully!');
        }
    }
}
