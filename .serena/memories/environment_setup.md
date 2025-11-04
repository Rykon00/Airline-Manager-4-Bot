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

Create `.env` in project root:

```env
# AM4 Login Credentials
EMAIL=your-email@example.com
PASSWORD=your-password

# Price Thresholds
MAX_FUEL_PRICE=550
MAX_CO2_PRICE=120

# Optional: Telegram Notifications
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

**Important**:
- `.env` is git-ignored (never committed)
- Copy from `.env.example` if available
- Use your actual AM4 credentials

### 5. Verify Setup

```bash
# Run quick test
npm run test:airline:headed
```

**Expected Behavior**:
- Browser window opens
- Logs in to AM4
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

### 3. Configure Variables

**Navigate**: Settings → Secrets and variables → Actions → Variables

**Add Repository Variables**:

| Name | Value | Example |
|------|-------|---------|
| `MAX_FUEL_PRICE` | Max fuel price | `550` |
| `MAX_CO2_PRICE` | Max CO2 price | `120` |

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

## Project Structure

```
Airline-Manager-4-Bot/
├── .github/
│   └── workflows/
│       └── 01_airlineManager.yml    # Main workflow
├── .serena/                          # Serena AI config
│   ├── memories/                     # Documentation
│   └── project.yml
├── data/                             # Generated at runtime
│   ├── price-history.json
│   └── planes.json
├── scripts/
│   └── run-local-workflow.ps1        # Local test runner
├── tests/
│   ├── airlineManager.spec.ts        # Main bot test
│   ├── fetchPlanes.spec.ts           # Full scan test
│   └── updateStartedPlanes.spec.ts   # Incremental update
├── utils/
│   ├── 00_general.utils.ts           # Login, helpers
│   ├── 01_fuel.utils.ts              # Fuel/CO2 purchase
│   ├── 02_campaign.utils.ts          # Campaigns
│   ├── 03_maintenance.utils.ts       # Maintenance
│   ├── 04_fleet.utils.ts             # Fleet operations
│   ├── 05_priceAnalytics.utils.ts    # Price analysis
│   └── fleet/
│       ├── fetchPlanes.utils.ts      # Full plane scan
│       └── updatePlanes.utils.ts     # Incremental update
├── .env                              # Local only (git-ignored)
├── .gitignore
├── package.json
├── playwright.config.ts
├── README.md
└── tsconfig.json
```

## Environment Variables Reference

### Required (Both Local & CI)

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `EMAIL` | Secret | AM4 login email | `user@example.com` |
| `PASSWORD` | Secret | AM4 login password | `MyPassword123` |
| `MAX_FUEL_PRICE` | Variable | Max price to buy fuel | `550` |
| `MAX_CO2_PRICE` | Variable | Max price to buy CO2 | `120` |

### Optional

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Secret | Telegram bot token for notifications | `123456:ABC-DEF...` |

### How Variables Are Used

**Local** (`.env` file):
```typescript
require('dotenv').config();
const email = process.env.EMAIL;
```

**CI** (GitHub Actions):
```yaml
- name: Create .env file
  run: |
    echo "EMAIL=${{ secrets.EMAIL }}" >> .env
    echo "MAX_FUEL_PRICE=${{ vars.MAX_FUEL_PRICE }}" >> .env
```

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

## IDE Setup (VS Code)

### Recommended Extensions

1. **Playwright Test for VSCode**
   - ID: `ms-playwright.playwright`
   - Features: Run tests, view results, debug

2. **TypeScript Vue Plugin (Volar)**
   - ID: `Vue.volar`
   - Features: Better TypeScript support

3. **Prettier - Code formatter**
   - ID: `esbenp.prettier-vscode`
   - Features: Auto-formatting

### Workspace Settings

Create `.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### Debug Configuration

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Airline Test",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["playwright", "test", "tests/airlineManager.spec.ts", "--headed"],
      "console": "integratedTerminal"
    }
  ]
}
```

## Platform-Specific Notes

### Windows

**PowerShell Script**:
```powershell
# Set execution policy (first time only)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Run script
.\scripts\run-local-workflow.ps1
```

**Path Separators**: Windows uses `\`, but Node.js accepts `/` in code.

### macOS/Linux

**Permissions**:
```bash
chmod +x scripts/run-local-workflow.ps1
```

**PowerShell Installation** (if script needed):
```bash
# macOS
brew install powershell

# Linux (see https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux)
```

**Alternative**: Use npm scripts instead of PowerShell script.

## Troubleshooting Setup

### "npm ci" Fails

**Symptom**: Error during `npm ci`
**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Browser Installation Fails

**Symptom**: Playwright browsers won't install
**Solution**:
```bash
# Try manual installation with sudo (Linux/Mac)
sudo npx playwright install-deps chromium
npx playwright install chromium
```

### ".env not found" Error

**Symptom**: Tests fail with "process.env.EMAIL is undefined"
**Solution**:
1. Ensure `.env` file exists in project root
2. Check file name (no `.txt` extension)
3. Verify dotenv is loaded: `require('dotenv').config();`

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

## Upgrading Dependencies

### Update Playwright

```bash
npm install @playwright/test@latest --save-dev
npx playwright install chromium
```

### Update All Dependencies

```bash
npm update
npm run install:browsers
```

### Check for Outdated Packages

```bash
npm outdated
```

## Security Best Practices

### DO
- Use secrets for sensitive data
- Keep `.env` git-ignored
- Use repository secrets in GitHub (not environment secrets)
- Rotate credentials periodically

### DON'T
- Commit `.env` to repository
- Share secrets in logs/screenshots
- Use same password for AM4 and GitHub
- Store credentials in code
