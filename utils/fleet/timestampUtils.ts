/**
 * Timestamp Conversion Utilities
 * Converts relative timestamps ("5 hours ago") to absolute ISO-8601 timestamps
 * Following FLEET_SCRAPING_STRATEGY.md rounding rules
 */

export type PrecisionLevel = 'slot' | 'day' | 'week' | 'month' | 'year';

export interface ConvertedTimestamp {
    timestamp: string;          // ISO-8601 absolute timestamp
    original: string;           // Original relative text
    precisionLevel: PrecisionLevel;
}

export class TimestampUtils {
    /**
     * Converts relative timestamp to absolute ISO-8601
     * @param timeAgoText - Text like "5 hours ago", "3 days ago", "6 months ago"
     * @param referenceTime - Optional reference time (defaults to now)
     * @returns Converted timestamp with precision level
     */
    public static convertRelativeToAbsolute(
        timeAgoText: string,
        referenceTime: Date = new Date()
    ): ConvertedTimestamp {
        const original = timeAgoText;

        // Parse the text to extract number and unit
        const match = timeAgoText.match(/(\d+)\s*(hour|day|week|month|year)s?\s*ago/i);

        if (!match) {
            // Fallback: return current time with low precision
            return {
                timestamp: referenceTime.toISOString(),
                original,
                precisionLevel: 'day'
            };
        }

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        let resultDate: Date;
        let precisionLevel: PrecisionLevel;

        switch (unit) {
            case 'hour':
                // Round to nearest 30-minute slot
                resultDate = this.roundToNearestSlot(referenceTime, value);
                precisionLevel = 'slot';
                break;

            case 'day':
                // Round to midnight of that day
                resultDate = new Date(referenceTime);
                resultDate.setDate(resultDate.getDate() - value);
                resultDate.setHours(0, 0, 0, 0);
                precisionLevel = 'day';
                break;

            case 'week':
                // Round to Monday of that week
                resultDate = new Date(referenceTime);
                resultDate.setDate(resultDate.getDate() - (value * 7));
                // Set to Monday (0 = Sunday, 1 = Monday)
                const dayOfWeek = resultDate.getDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                resultDate.setDate(resultDate.getDate() - daysToMonday);
                resultDate.setHours(0, 0, 0, 0);
                precisionLevel = 'week';
                break;

            case 'month':
                // Round to 1st of that month
                resultDate = new Date(referenceTime);
                resultDate.setMonth(resultDate.getMonth() - value);
                resultDate.setDate(1);
                resultDate.setHours(0, 0, 0, 0);
                precisionLevel = 'month';
                break;

            case 'year':
                // Round to January 1st of that year
                resultDate = new Date(referenceTime);
                resultDate.setFullYear(resultDate.getFullYear() - value);
                resultDate.setMonth(0);
                resultDate.setDate(1);
                resultDate.setHours(0, 0, 0, 0);
                precisionLevel = 'year';
                break;

            default:
                resultDate = referenceTime;
                precisionLevel = 'day';
        }

        return {
            timestamp: resultDate.toISOString(),
            original,
            precisionLevel
        };
    }

    /**
     * Rounds time to nearest 30-minute slot (for hours < 24)
     * Slots: 00:00, 00:30, 01:00, 01:30, ..., 23:30
     */
    private static roundToNearestSlot(referenceTime: Date, hoursAgo: number): Date {
        const resultDate = new Date(referenceTime);
        resultDate.setHours(resultDate.getHours() - hoursAgo);

        // Round minutes to nearest 30
        const minutes = resultDate.getMinutes();
        const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 60;

        if (roundedMinutes === 60) {
            resultDate.setHours(resultDate.getHours() + 1);
            resultDate.setMinutes(0);
        } else {
            resultDate.setMinutes(roundedMinutes);
        }

        resultDate.setSeconds(0);
        resultDate.setMilliseconds(0);

        return resultDate;
    }

    /**
     * Gets current time slot for departure tracking
     * Used when bot departs a plane (exact time)
     * @returns Current time rounded to nearest 30-minute slot
     */
    public static getCurrentTimeSlot(): string {
        const now = new Date();
        const minutes = now.getMinutes();
        const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 60;

        if (roundedMinutes === 60) {
            now.setHours(now.getHours() + 1);
            now.setMinutes(0);
        } else {
            now.setMinutes(roundedMinutes);
        }

        now.setSeconds(0);
        now.setMilliseconds(0);

        return now.toISOString();
    }

    /**
     * Checks if a timestamp is newer than another
     * @param timestamp1 - ISO-8601 timestamp
     * @param timestamp2 - ISO-8601 timestamp
     * @returns true if timestamp1 > timestamp2
     */
    public static isNewer(timestamp1: string, timestamp2: string): boolean {
        const date1 = new Date(timestamp1);
        const date2 = new Date(timestamp2);
        return date1.getTime() > date2.getTime();
    }

    /**
     * Generates a simple hash from a plane's data for change detection
     * @param registration - Plane registration
     * @param lastFlightTimestamp - Last flight timestamp
     * @param totalFlights - Total number of flights
     * @returns Simple hash string
     */
    public static generatePlaneHash(
        registration: string,
        lastFlightTimestamp: string | null,
        totalFlights: number
    ): string {
        const data = `${registration}-${lastFlightTimestamp}-${totalFlights}`;
        // Simple hash function (not cryptographic, just for change detection)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
}
