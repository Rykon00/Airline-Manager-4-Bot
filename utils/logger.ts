import * as fs from 'fs';
import * as path from 'path';

/**
 * Logger class for consistent outputs in console and logfile
 */
export class Logger {
    private static instance: Logger;
    private logFilePath: string;
    private logBuffer: string[] = [];

    /**
     * Private constructor (Singleton-Pattern)
     */
    private constructor() {
        // Log file in project directory
        this.logFilePath = path.join(__dirname, '../bot-activity.log');
        
        this.log('INFO', `=== New session started ===`);
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Create and output log message with level (without timestamp)
     */
    public log(level: string, message: string): void {
        const logMessage = `[${level}] ${message}`;
        
        // Output to console
        console.log(logMessage);
        
        // Add to buffer
        this.logBuffer.push(logMessage);
        
        // Write to file (delayed to improve performance)
        this.writeBufferToFile();
    }

    /**
     * Information-level log
     */
    public info(message: string): void {
        this.log('INFO', message);
    }

    /**
     * Error-level log
     */
    public error(message: string): void {
        this.log('ERROR', message);
    }

    /**
     * Warning-level log
     */
    public warn(message: string): void {
        this.log('WARN', message);
    }

    /**
     * Debug-level log
     */
    public debug(message: string): void {
        this.log('DEBUG', message);
    }

    /**
     * Write buffer to file
     */
    private writeBufferToFile(): void {
        try {
            fs.appendFileSync(this.logFilePath, this.logBuffer.join('\n') + '\n');
            this.logBuffer = []; // Empty buffer
        } catch (error) {
            console.error('Error writing log:', error);
        }
    }
}