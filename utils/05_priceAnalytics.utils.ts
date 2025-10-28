import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for a single timeslot entry containing both fuel and CO2 prices
 */
export interface TimeslotEntry {
  timestamp: string;
  fuel: number;
  co2: number;
}

/**
 * Interface for price statistics
 */
export interface PriceStatistics {
  current: number;
  avg24h: number;
  avg7d: number;
  min24h: number;
  max24h: number;
  min7d: number;
  max7d: number;
  trend: 'rising' | 'falling' | 'stable';
  recommendation: 'buy' | 'wait' | 'emergency';
  confidence: number;
}

/**
 * Interface for the complete price history structure
 */
export interface PriceHistory {
  timeslots: TimeslotEntry[];
  lastUpdated: string;
}

/**
 * Utility class for intelligent price analysis and tracking
 * Implements historical price tracking and statistical analysis for optimal buying decisions
 */
export class PriceAnalyticsUtils {
  private historyFilePath: string;
  private maxHistoryEntries: number;

  constructor(maxHistoryEntries: number = 200) {
    this.historyFilePath = path.join(process.cwd(), 'price-history.json');
    this.maxHistoryEntries = maxHistoryEntries;
  }

  /**
   * Load price history from JSON file
   * Creates new file with empty structure if it doesn't exist
   * Handles migration from old format (separate fuel/co2 arrays) to new format (unified timeslots)
   */
  public loadHistory(): PriceHistory {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const data = fs.readFileSync(this.historyFilePath, 'utf8');
        const parsed = JSON.parse(data);

        // Check if old format (separate fuel/co2 arrays)
        if (parsed.fuel || parsed.co2) {
          console.log('📦 Migrating old price history format to new unified structure...');
          const timeslotsMap = new Map<string, TimeslotEntry>();

          // Merge fuel entries
          if (parsed.fuel && Array.isArray(parsed.fuel)) {
            for (const entry of parsed.fuel) {
              timeslotsMap.set(entry.timestamp, {
                timestamp: entry.timestamp,
                fuel: entry.price,
                co2: 0
              });
            }
          }

          // Merge co2 entries
          if (parsed.co2 && Array.isArray(parsed.co2)) {
            for (const entry of parsed.co2) {
              const existing = timeslotsMap.get(entry.timestamp);
              if (existing) {
                existing.co2 = entry.price;
              } else {
                timeslotsMap.set(entry.timestamp, {
                  timestamp: entry.timestamp,
                  fuel: 0,
                  co2: entry.price
                });
              }
            }
          }

          // Convert map to sorted array
          const timeslots = Array.from(timeslotsMap.values()).sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          const migratedHistory: PriceHistory = {
            timeslots,
            lastUpdated: new Date().toISOString()
          };

          // Save migrated format
          this.saveHistory(migratedHistory);
          console.log(`✅ Migration complete: ${timeslots.length} timeslot entries`);
          return migratedHistory;
        }

        // New format - just use as is
        const history = parsed as PriceHistory;
        console.log(`📊 Loaded price history: ${history.timeslots.length} timeslot entries`);
        return history;
      }
    } catch (error) {
      console.error('❌ Error loading price history:', error);
    }

    // Return empty structure if file doesn't exist or error occurred
    console.log('📝 Creating new price history file');
    const emptyHistory: PriceHistory = {
      timeslots: [],
      lastUpdated: new Date().toISOString()
    };
    this.saveHistory(emptyHistory);
    return emptyHistory;
  }

  /**
   * Save price history to JSON file
   */
  public saveHistory(history: PriceHistory): void {
    try {
      history.lastUpdated = new Date().toISOString();
      fs.writeFileSync(
        this.historyFilePath,
        JSON.stringify(history, null, 2),
        'utf8'
      );
      console.log('💾 Price history saved successfully');
    } catch (error) {
      console.error('❌ Error saving price history:', error);
      throw new Error(`Failed to save price history: ${error}`);
    }
  }

  /**
   * Get the 30-minute timeslot for a timestamp
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
   * Add a new price entry to history
   * Automatically trims old entries if exceeding maxHistoryEntries
   * Deduplicates: Only 1 entry per 30-minute timeslot
   */
  public addPriceEntry(
    type: 'fuel' | 'co2',
    price: number
  ): void {
    const history = this.loadHistory();
    const now = new Date();
    const currentSlot = this.getTimeslot(now);

    // Check if entry for this timeslot already exists
    const existingIndex = history.timeslots.findIndex(e =>
      this.getTimeslot(new Date(e.timestamp)) === currentSlot
    );

    if (existingIndex >= 0) {
      // Update existing timeslot entry with new price
      if (type === 'fuel') {
        history.timeslots[existingIndex].fuel = price;
      } else {
        history.timeslots[existingIndex].co2 = price;
      }
      console.log(`🔄 Updated ${type} price for timeslot ${currentSlot}: $${price}`);
    } else {
      // Create new timeslot entry
      const newEntry: TimeslotEntry = {
        timestamp: currentSlot,
        fuel: type === 'fuel' ? price : 0,
        co2: type === 'co2' ? price : 0
      };
      history.timeslots.push(newEntry);
      console.log(`✅ Added ${type} price entry for timeslot ${currentSlot}: $${price}`);
    }

    // Keep only the last maxHistoryEntries
    if (history.timeslots.length > this.maxHistoryEntries) {
      history.timeslots = history.timeslots.slice(-this.maxHistoryEntries);
    }

    this.saveHistory(history);
  }

  /**
   * Check data quality and return score (0-100)
   * Based on CLAUDE.md criteria:
   * - Count (20 pts): ≥20 data points
   * - Timespan (25 pts): Oldest point ≥24h ago
   * - Gap-free (30 pts): Largest gap in 24h <3h
   * - Day coverage (25 pts): All 4 quarters covered
   */
  public checkDataQuality(type: 'fuel' | 'co2'): number {
    const history = this.loadHistory();

    // Filter timeslots that have the requested price type (fuel or co2 > 0)
    const entries = history.timeslots.filter(e =>
      type === 'fuel' ? e.fuel > 0 : e.co2 > 0
    );

    if (entries.length === 0) return 0;

    let score = 0;

    // 1. Count (20 points)
    if (entries.length >= 20) {
      score += 20;
    } else {
      score += Math.floor((entries.length / 20) * 20);
    }

    // 2. Timespan (25 points)
    const timestamps = entries.map(e => new Date(e.timestamp).getTime());
    const oldest = Math.min(...timestamps);
    const now = Date.now();
    const ageHours = (now - oldest) / (1000 * 60 * 60);

    if (ageHours >= 24) {
      score += 25;
    } else {
      score += Math.floor((ageHours / 24) * 25);
    }

    // 3. Gap-free (30 points) - largest gap in last 24h
    const last24h = entries.filter(e => {
      const age = (now - new Date(e.timestamp).getTime()) / (1000 * 60 * 60);
      return age <= 24;
    });

    if (last24h.length >= 2) {
      const sortedTimes = last24h
        .map(e => new Date(e.timestamp).getTime())
        .sort((a, b) => a - b);

      let maxGapHours = 0;
      for (let i = 0; i < sortedTimes.length - 1; i++) {
        const gapHours = (sortedTimes[i + 1] - sortedTimes[i]) / (1000 * 60 * 60);
        maxGapHours = Math.max(maxGapHours, gapHours);
      }

      if (maxGapHours < 3) {
        score += 30;
      } else if (maxGapHours < 6) {
        score += 15;
      }
    }

    // 4. Day coverage (25 points) - all 4 quarters
    const quarters = [0, 0, 0, 0]; // Night, Morning, Afternoon, Evening
    for (const entry of last24h) {
      const hour = new Date(entry.timestamp).getUTCHours();
      const quarter = Math.floor(hour / 6); // 0-5=0, 6-11=1, 12-17=2, 18-23=3
      quarters[quarter] = 1;
    }
    const coverageCount = quarters.reduce((a, b) => a + b, 0);
    score += Math.floor((coverageCount / 4) * 25);

    return Math.min(100, score);
  }

  /**
   * Get fuel/co2 data for gap analysis
   * Returns timeslots that have data for the specified type
   */
  public getData(type: 'fuel' | 'co2'): Array<{ timestamp: string }> {
    const history = this.loadHistory();
    // Return timeslots that have valid price data for the specified type
    return history.timeslots
      .filter(e => type === 'fuel' ? e.fuel > 0 : e.co2 > 0)
      .map(e => ({ timestamp: e.timestamp }));
  }

  /**
   * Add price entries from external source (e.g., Telegram)
   * Merges fuel and CO2 prices into existing timeslot entries or creates new ones
   */
  public addExternalPriceEntries(
    type: 'fuel' | 'co2',
    entries: Array<{
      timestamp: string;
      price: number;
    }>
  ): void {
    const history = this.loadHistory();

    let addedCount = 0;
    let updatedCount = 0;

    for (const entry of entries) {
      // Find existing timeslot entry
      const existingIndex = history.timeslots.findIndex(e => e.timestamp === entry.timestamp);

      if (existingIndex >= 0) {
        // Update existing timeslot
        const existing = history.timeslots[existingIndex];
        const hadPrice = type === 'fuel' ? existing.fuel > 0 : existing.co2 > 0;

        if (type === 'fuel') {
          history.timeslots[existingIndex].fuel = entry.price;
        } else {
          history.timeslots[existingIndex].co2 = entry.price;
        }

        if (!hadPrice) {
          updatedCount++;
        }
      } else {
        // Create new timeslot entry
        const newEntry: TimeslotEntry = {
          timestamp: entry.timestamp,
          fuel: type === 'fuel' ? entry.price : 0,
          co2: type === 'co2' ? entry.price : 0
        };
        history.timeslots.push(newEntry);
        addedCount++;
      }
    }

    // Sort by timestamp
    history.timeslots.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Trim to max entries
    if (history.timeslots.length > this.maxHistoryEntries) {
      history.timeslots = history.timeslots.slice(-this.maxHistoryEntries);
    }

    this.saveHistory(history);

    if (addedCount > 0 || updatedCount > 0) {
      console.log(`✅ Added ${addedCount} new timeslots, updated ${updatedCount} existing timeslots with ${type} prices`);
    }
  }

  /**
   * Calculate statistics for a given time window
   */
  private calculateStats(
    type: 'fuel' | 'co2',
    entries: TimeslotEntry[],
    hoursBack: number
  ): {
    avg: number;
    min: number;
    max: number;
    count: number;
  } {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    const recentEntries = entries.filter(entry =>
      new Date(entry.timestamp) >= cutoffTime
    );

    if (recentEntries.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const prices = recentEntries.map(e => type === 'fuel' ? e.fuel : e.co2).filter(p => p > 0);

    if (prices.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const sum = prices.reduce((a, b) => a + b, 0);

    return {
      avg: Math.round(sum / prices.length),
      min: Math.min(...prices),
      max: Math.max(...prices),
      count: prices.length
    };
  }

  /**
   * Detect price trend based on recent history
   */
  private detectTrend(type: 'fuel' | 'co2', entries: TimeslotEntry[]): 'rising' | 'falling' | 'stable' {
    // Filter entries that have valid prices for the specified type
    const validEntries = entries.filter(e => type === 'fuel' ? e.fuel > 0 : e.co2 > 0);

    if (validEntries.length < 10) {
      return 'stable';
    }

    // Compare average of last 5 entries vs previous 5 entries
    const recent = validEntries.slice(-5).map(e => type === 'fuel' ? e.fuel : e.co2);
    const previous = validEntries.slice(-10, -5).map(e => type === 'fuel' ? e.fuel : e.co2);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

    const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;

    if (changePercent > 5) return 'rising';
    if (changePercent < -5) return 'falling';
    return 'stable';
  }

  /**
   * Get comprehensive price statistics and recommendation
   */
  public getStatistics(type: 'fuel' | 'co2', currentPrice: number): PriceStatistics {
    const history = this.loadHistory();

    const stats24h = this.calculateStats(type, history.timeslots, 24);
    const stats7d = this.calculateStats(type, history.timeslots, 168); // 7 days = 168 hours
    const trend = this.detectTrend(type, history.timeslots);

    // Calculate confidence based on data availability
    let confidence = 0;
    if (stats24h.count >= 20) confidence += 0.5; // At least ~10 hours of data
    if (stats7d.count >= 100) confidence += 0.3; // At least ~2 days of data
    if (trend !== 'stable') confidence += 0.2; // Clear trend detected

    // Determine recommendation
    let recommendation: 'buy' | 'wait' | 'emergency' = 'wait';

    if (stats24h.count >= 10) {
      // Intelligent recommendation based on 24h average
      const buyThreshold = stats24h.avg * 0.85; // Buy if price is 15% below average
      const emergencyThreshold = stats24h.avg * 1.5; // Emergency if price is 50% above average

      if (currentPrice <= buyThreshold) {
        recommendation = 'buy';
      } else if (currentPrice >= emergencyThreshold) {
        recommendation = 'emergency';
      } else if (trend === 'falling' && currentPrice < stats24h.avg) {
        recommendation = 'buy'; // Buy on falling trend if below average
      }
    } else {
      // Not enough data, use simple logic
      recommendation = 'wait';
    }

    return {
      current: currentPrice,
      avg24h: stats24h.avg,
      avg7d: stats7d.avg,
      min24h: stats24h.min,
      max24h: stats24h.max,
      min7d: stats7d.min,
      max7d: stats7d.max,
      trend,
      recommendation,
      confidence: Math.round(confidence * 100)
    };
  }

  /**
   * Determine if purchase should be made based on intelligent analysis
   */
  public shouldBuyNow(
    type: 'fuel' | 'co2',
    currentPrice: number,
    maxPrice: number,
    holding: number,
    emergencyThreshold: number
  ): {
    shouldBuy: boolean;
    reason: string;
    stats: PriceStatistics;
  } {
    const stats = this.getStatistics(type, currentPrice);

    // Emergency purchase if holding is critically low
    if (holding < emergencyThreshold && currentPrice < maxPrice * 2) {
      return {
        shouldBuy: true,
        reason: `🚨 Emergency purchase (holding: ${holding.toLocaleString()}, price acceptable)`,
        stats
      };
    }

    // Use intelligent recommendation if we have enough data
    if (stats.confidence >= 50) {
      if (stats.recommendation === 'buy') {
        return {
          shouldBuy: true,
          reason: `🎯 Intelligent buy (price: $${currentPrice}, 24h avg: $${stats.avg24h}, trend: ${stats.trend})`,
          stats
        };
      } else {
        return {
          shouldBuy: false,
          reason: `⏸️ Waiting for better price (current: $${currentPrice}, 24h avg: $${stats.avg24h}, trend: ${stats.trend})`,
          stats
        };
      }
    }

    // Fallback to simple logic if not enough historical data
    if (currentPrice < maxPrice) {
      return {
        shouldBuy: true,
        reason: `✅ Price below max threshold ($${currentPrice} < $${maxPrice})`,
        stats
      };
    }

    return {
      shouldBuy: false,
      reason: `⏸️ Price too high ($${currentPrice} >= $${maxPrice})`,
      stats
    };
  }

  /**
   * Generate a detailed price report for logging
   */
  public generatePriceReport(type: 'fuel' | 'co2'): string {
    const history = this.loadHistory();

    // Filter timeslots with valid price for the requested type
    const entries = history.timeslots.filter(e =>
      type === 'fuel' ? e.fuel > 0 : e.co2 > 0
    );

    if (entries.length === 0) {
      return `📊 No price history available for ${type.toUpperCase()}`;
    }

    const lastEntry = entries[entries.length - 1];
    const lastPrice = type === 'fuel' ? lastEntry.fuel : lastEntry.co2;
    const stats = this.getStatistics(type, lastPrice);

    const report = `
📊 ${type.toUpperCase()} PRICE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Price:     $${stats.current.toLocaleString()}
24h Average:       $${stats.avg24h.toLocaleString()}
7d Average:        $${stats.avg7d.toLocaleString()}
24h Range:         $${stats.min24h.toLocaleString()} - $${stats.max24h.toLocaleString()}
Trend:             ${stats.trend.toUpperCase()} ${stats.trend === 'rising' ? '📈' : stats.trend === 'falling' ? '📉' : '➡️'}
Recommendation:    ${stats.recommendation.toUpperCase()} ${stats.recommendation === 'buy' ? '🟢' : stats.recommendation === 'emergency' ? '🔴' : '🟡'}
Confidence:        ${stats.confidence}%
Data Points:       ${entries.length} entries
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return report;
  }
}
