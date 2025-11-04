# Airline Manager 4 Bot - Project Overview

## Purpose
Automated bot for the browser-based game "Airline Manager 4". The bot performs routine game operations including:
- Intelligent fuel and CO2 purchasing with price analytics
- Campaign management (eco-friendly & airline reputation)
- Aircraft maintenance scheduling (repairs & A-Checks)
- Fleet operations (automated departures)
- Plane data tracking and management

## Execution Context
- **Platform**: Runs on GitHub Actions (scheduled workflow) and locally for development
- **Schedule**: Every 30 minutes (at :01 and :31) plus daily full scan at 3am
- **CI/CD**: GitHub Actions workflows with artifact-based data persistence

## Key Features
1. **Intelligent Price Analytics**: Historical tracking with 24h/7d averages, trend detection, buy recommendations
2. **Automated Operations**: Fuel/CO2 purchase, campaign management, maintenance, fleet departures
3. **Data Persistence**: Price history and plane data stored as GitHub Actions artifacts
4. **Emergency Mode**: Higher price purchases when supplies critically low
