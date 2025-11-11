# Environment Setup Guide

## Prerequisites

### Required Software

1. **Node.js LTS** (v20 or later)
   - Download: https://nodejs.org/
   - Verify: `node --version`
   - Includes npm package manager

2. **Git**
   - Download: https://git-scm.com/
   - Verify: `git --version`
   - Required for cloning and version control

3. **Text Editor**
   - VS Code (recommended): https://code.visualstudio.com/
   - Or any editor with TypeScript support

### Optional Software

- **PowerShell** (Windows): Pre-installed on Windows 10+, required for `run-local-workflow.ps1`
- **GitHub CLI** (`gh`): For advanced GitHub operations

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/Airline-Manager-4-Bot.git
cd Airline-Manager-4-Bot
```

### 2. Install Dependencies

```bash
npm ci
```

**What `npm ci` does**:
- Installs exact versions from `package-lock.json` (reproducible builds)
- Faster and more reliable than `npm install`
- Removes existing `node_modules` first

**Installed Packages**:
- `@playwright/test@^1.52.0` - E2E testing framework
- `@types/node@^20.17.57` - TypeScript type definitions
- `dotenv@^16.4.5` - Environment variable loader

### 3. Install Playwright Browsers

```bash
npm run install:browsers
```

**What this installs**:
- Chromium browser (~300MB)
- System dependencies (fonts, libraries)
- Browser in `~/.cache/ms-playwright/`

**Full command** (manual alternative):
```bash
npx playwright install --with-deps chromium
```

### 4. Create Environment File

**IMPORTANT**: Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# ============================================
# Authentication (Required)
# ============================================
# SECURITY: Credentials are ONLY read from .env file!
# They are NOT stored in config.ts or any other file.
# Never commit your .env file to version control!
EMAIL=your-email@example.com
PASSWORD=your-password

# ============================================
# Fuel & CO2 Purchase Limits
# ============================================
MAX_FUEL_PRICE=550
MAX_CO2_PRICE=120

# ============================================
# Fleet Management Configuration
# ============================================
FLEET_PERCENTAGE=0.10
FLEET_MIN_DELAY=1000
FLEET_MAX_DELAY=2000
FLEET_MOCK_MODE=false

# GLOBAL MAXIMUM: Max departures per run (overrides percentage calculation)
# Default: 1 plane per run for safety
# Increase this value if you want more departures per run
MAX_DEPARTURES_OVERRIDE=1
```

**Critical Security Notes**:
- ✅ `.env` is automatically git-ignored (never committed)
- ✅ Credentials read directly via `process.env.EMAIL` and `process.env.PASSWORD`
- ✅ **NOT** passed through `config.ts` for security reasons
- ✅ No default credentials exist in code
- ✅ Missing credentials throw clear error on startup
- ❌ **NEVER** commit `.env` to version control
- ❌ **NEVER** share `.env` file or credentials

**How Authentication Works**:
```typescript
// In utils/00_general.utils.ts
import 'dotenv/config';

constructor(page: Page) {
  if (!process.env.EMAIL || !process.env.PASSWORD) {
    throw new Error('Missing required environment variables: EMAIL and/or PASSWORD');
  }
  this.username = process.env.EMAIL;
  this.password = process.env.PASSWORD;
}
```

### 5. Verify Setup

```bash
# Run quick test
npm run test:airline:headed
```

**Expected Behavior**:
- Browser window opens
- Logs in to AM4 with your credentials
- Performs operations
- Closes after ~30-45 seconds

**If successful**: Setup complete!

## GitHub Actions Setup (CI/CD)

### 1. Fork Repository

1. Go to original repository
2. Click "Fork" button
3. Select your account

### 2. Configure Secrets

**Navigate**: Settings → Secrets and variables → Actions → Secrets

**Add Repository Secrets**:

| Name | Value | Example |
|------|-------|---------|
| `EMAIL` | Your AM4 email | `user@example.com` |
| `PASSWORD` | Your AM4 password | `SecurePass123` |
| `TELEGRAM_BOT_TOKEN` | (Optional) Bot token | `123456:ABC-DEF...` |

**How to add**:
1. Click "New repository secret"
2. Enter name (exact match required)
3. Enter value
4. Click "Add secret"

**Security**: Secrets are encrypted and never exposed in logs

### 3. Configure Variables

**Navigate**: Settings → Secrets and variables → Actions → Variables

**Add Repository Variables**:

| Name | Value | Example |
|------|-------|---------|
| `MAX_FUEL_PRICE` | Max fuel price | `550` |
| `MAX_CO2_PRICE` | Max CO2 price | `120` |
| `MAX_DEPARTURES_OVERRIDE` | Max planes per run | `1` |

**How to add**:
1. Click "New repository variable"
2. Enter name (exact match required)
3. Enter value
4. Click "Add variable"

### 4. Enable Workflows

**Navigate**: Actions tab

1. Click "I understand my workflows, go ahead and enable them"
2. Workflows will start running on schedule

**Initial Run**:
- First run may fail (no artifacts yet)
- Second run should succeed (artifacts created)
- This is normal behavior

### 5. Verify Workflow

**Manual Test**:
1. Actions tab → Select workflow
2. Click "Run workflow" button
3. Wait for completion (~2-5 minutes)
4. Check for green checkmark

**View Logs**:
1. Click on workflow run
2. Click "test" job
3. Expand steps to see console output

## Environment Variables Reference

### Required (Both Local & CI)

| Variable | Type | Description | Default | Example |
|----------|------|-------------|---------|---------|
| `EMAIL` | Secret | AM4 login email | ❌ None | `user@example.com` |
| `PASSWORD` | Secret | AM4 login password | ❌ None | `MyPassword123` |

### Optional (With Defaults in config.ts)

| Variable | Type | Description | Default | Example |
|----------|------|-------------|---------|---------|
| `MAX_FUEL_PRICE` | Variable | Max price to buy fuel | `550` | `600` |
| `MAX_CO2_PRICE` | Variable | Max price to buy CO2 | `120` | `130` |
| `FLEET_PERCENTAGE` | Variable | % of fleet to depart | `0.10` | `0.25` |
| `FLEET_MIN_DELAY` | Variable | Min delay between ops (ms) | `1000` | `500` |
| `FLEET_MAX_DELAY` | Variable | Max delay between ops (ms) | `2000` | `3000` |
| `FLEET_MOCK_MODE` | Variable | Mock mode for testing | `false` | `true` |
| `MAX_DEPARTURES_OVERRIDE` | Variable | Global max departures | `1` | `5` |

### Future (Planned)

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Secret | Telegram bot token for notifications | `123456:ABC-DEF...` |

### How Variables Are Used

**Local** (`.env` file):
```typescript
import 'dotenv/config';
const email = process.env.EMAIL; // Direct access
```

**With Defaults** (`config.ts`):
```typescript
import 'dotenv/config';
export const BOT_CONFIG = {
  fuel: {
    maxFuelPrice: parseInt(process.env.MAX_FUEL_PRICE || '550')
  }
};
```

**CI** (GitHub Actions):
```yaml
- name: Create .env file
  run: |
    echo "EMAIL=${{ secrets.EMAIL }}" >> .env
    echo "MAX_FUEL_PRICE=${{ vars.MAX_FUEL_PRICE || '550' }}" >> .env
```

## Security Best Practices

### DO
- ✅ Use `.env` for all credentials
- ✅ Keep `.env` git-ignored (already configured)
- ✅ Use repository secrets in GitHub (not environment secrets)
- ✅ Rotate credentials periodically
- ✅ Copy from `.env.example` as template
- ✅ Read security comments in `.env.example`

### DON'T
- ❌ Commit `.env` to repository
- ❌ Share `.env` file or credentials
- ❌ Use same password for AM4 and GitHub
- ❌ Store credentials in code or config.ts
- ❌ Push `.env` to any cloud service
- ❌ Share screenshots containing credentials

### Why Credentials Are Not in config.ts

**Security Separation**:
- `config.ts` is committed to git → public
- `.env` is git-ignored → private
- Credentials in code = security vulnerability
- Direct `process.env` access = industry best practice

## Data Directory Setup

### Initial State
The `data/` directory doesn't exist in the repository.

### First Local Run
```bash
# Create directory manually (optional - tests create it)
mkdir data
```

Tests will create `data/` automatically if missing.

### First CI Run
```yaml
# Workflow creates directory
- name: Create data directory
  run: mkdir -p data
```

### Data Persistence

**Local**:
- Files persist in `data/` between runs
- Git-ignored (won't be committed)
- Delete files to reset

**CI (GitHub Actions)**:
- Files uploaded as artifacts after each run
- Downloaded before next run
- 90-day retention for price/planes
- 7-day retention for started-flights

## Troubleshooting Setup

### ".env not found" Error

**Symptom**: Tests fail with "Missing required environment variables"
**Solution**:
1. Ensure `.env` file exists in project root
2. Check file name (no `.txt` extension)
3. Verify EMAIL and PASSWORD are set
4. Restart terminal/IDE after creating .env

### "Executable doesn't exist" Error

**Symptom**: Playwright can't find browser
**Solution**:
```bash
# Reinstall browsers
npx playwright install --with-deps chromium
```

### GitHub Actions "Secrets not found"

**Symptom**: Workflow fails with "secrets.EMAIL is not set"
**Solution**:
1. Go to Settings → Secrets and variables → Actions
2. Verify secret names match exactly (case-sensitive)
3. Re-add secrets if needed
