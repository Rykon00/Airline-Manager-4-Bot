import { Page } from "@playwright/test";
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

require('dotenv').config();

export class GeneralUtils {
    username : string;
    password : string;
    page : Page;
    cookiesPath: string;
    private logger: Logger;

    constructor(page : Page) {
        this.username = process.env.EMAIL!;
        this.password = process.env.PASSWORD!;
        this.page = page;
        this.cookiesPath = path.join(__dirname, '../cookies.json');
        this.logger = Logger.getInstance();
    }

    public static async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async login(page: Page) {
        // First check if cookies exist and load them directly
        const cookiesExist = fs.existsSync(this.cookiesPath);
        
        if (cookiesExist) {
            try {
                // Load cookies before visiting the page
                const cookiesString = fs.readFileSync(this.cookiesPath, 'utf8');
                const cookies = JSON.parse(cookiesString);
                await page.context().addCookies(cookies);
                this.logger.info('Cookies loaded, navigating to page...');
            } catch (error) {
                this.logger.error(`Error loading cookies: ${error}`);
            }
        }

        // Now visit the page (with loaded cookies)
        await page.goto('https://www.airlinemanager.com/', { timeout: 30000 });
        await GeneralUtils.sleep(2000);
        
        // Check if we're already logged in
        const hubsButtonVisible = await page.getByRole('button', { name: 'Hubs' }).isVisible().catch(() => false);
        
        // Check if we're already logged in
        if (hubsButtonVisible) {
            this.logger.info('Already logged in. No need to login again.');
            return;
        }

        // If not logged in, perform normal login
        this.logger.info('Not logged in, starting login process...');

        await page.goto('https://www.airlinemanager.com/', { timeout: 30000 });
        await page.getByRole('button', { name: 'PLAY FREE NOW' }).click();
        await page.getByRole('button', { name: 'Log in' }).click();
        await page.locator('#lEmail').click();
        await page.locator('#lEmail').fill(this.username);
        await page.locator('#lEmail').press('Tab');
        await page.locator('#lPass').click();
        await page.locator('#lPass').fill(this.password);
        await page.getByRole('button', { name: 'Log In', exact: true }).click();

        // Save cookies after successful login
        await this.saveCookies(page);
        
        this.logger.info('Successfully logged in!');
    }

    private async saveCookies(page: Page): Promise<void> {
        try {
            // Get cookies
            const cookies = await page.context().cookies();
            
            // Save to file
            fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
            
            this.logger.info('Cookies saved successfully');
        } catch (error) {
            this.logger.error(`Error saving cookies: ${error}`);
        }
    }
}
