# Workshop Registration WhatsApp Bot

Production-ready Node.js bot that reads workshop registrations from a local Excel workbook and sends personalized WhatsApp messages with `whatsapp-web.js`.

## What it does

- Connects to WhatsApp Web and shows a QR code in the terminal.
- Reads rows from a local Excel workbook.
- Sends a personalized WhatsApp message only when `Status` is empty or `NOT_SENT`.
- Updates the workbook with `SENT`, `FAILED`, or `SKIPPED_DUPLICATE` and stores a timestamp.
- Validates Indian mobile numbers before sending.
- Adds a random 10-20 second delay between messages.
- Retries transient WhatsApp send failures.
- Deduplicates by phone number so the same number is not messaged twice in one run.

## Project Structure

```text
project/
├── src/
│   ├── index.js
│   ├── sheets.js
│   ├── whatsapp.js
│   ├── utils.js
│   └── config.js
├── .env
├── package.json
└── README.md
```

## Prerequisites

- Node.js 18 or newer.
- A local Excel workbook with at least a phone-number column.

Optional columns for personalization:

- `Name`
- `Email`
- `Phone` or `Number`

The bot will add `Status` and `Timestamp` columns automatically if they are missing.

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Put your workbook in place

1. Create a folder named `data` in this project.
2. Put your Excel file there as `registrations.xlsx`, or update `EXCEL_FILE_PATH` in `.env`.
3. Make sure the first row contains headers for your data.
4. If your phone column is named `Number` instead of `Phone`, the bot will still recognize it.

### 3) Configure environment variables

Edit `.env` and set these values:

```env
EXCEL_FILE_PATH=./data/registrations.xlsx
SHEET_NAME=Sheet1
GROUP_LINK=https://chat.whatsapp.com/your-group-link
WHATSAPP_CLIENT_ID=workshop-registration-bot
WHATSAPP_HEADLESS=true
MESSAGE_RETRY_COUNT=3
MESSAGE_RETRY_DELAY_MS=5000
MIN_DELAY_MS=10000
MAX_DELAY_MS=20000
```

### 5) Start the bot

```bash
npm start
```

The first run prints a QR code in the terminal. Scan it with WhatsApp on your phone. After that, the session is stored locally with `LocalAuth`, so you usually do not need to scan again unless the session is cleared.

## How the sheet is processed

Only rows with `Status` equal to empty or `NOT_SENT` are processed.

The decision to send is based on the phone number. `Name` and `Email` are only used to personalize the message if they exist.

- `SENT` is written after a successful send.
- `FAILED` is written if validation fails or sending fails.
- `SKIPPED_DUPLICATE` is written when the same phone number appears more than once in the same run.
- `Timestamp` is updated when the row is processed.

## Phone number rules

The bot accepts valid Indian mobile numbers in formats like these:

- `9876543210`
- `+91 98765 43210`
- `0919876543210`

Invalid numbers are skipped and marked `FAILED`.

## Notes on reliability

- `whatsapp-web.js` uses a Chromium session, so the machine must stay online while sending.
- If WhatsApp disconnects, the bot stops instead of continuing with a partial batch.
- The bot retries transient send errors before marking the row as failed.

## Running locally

```bash
npm install
npm start
```

If you are running in a headless Linux server, keep `WHATSAPP_HEADLESS=true`. If you need to debug browser behavior locally, set it to `false`.

## Deploy On Render

This bot should run as a Render background worker, not a web service, because it needs a long-lived process and a persistent WhatsApp session.

1. Push this repo to GitHub.
2. Create a new Render service from the repository.
3. Use the included `render.yaml` blueprint.
4. Add `GROUP_LINK` as a secret environment variable in Render.
5. Upload your Excel file into the mounted disk path or replace it with your own startup flow.

Important: the file at `EXCEL_FILE_PATH` must exist on the Render disk before the bot starts. The current config will create an empty template automatically if it is missing, so you can deploy first and then upload your registrations file.

If you want the workbook to persist across restarts, keep it on the mounted disk path instead of the container filesystem.

## Troubleshooting

- If the bot cannot read the workbook, confirm the `EXCEL_FILE_PATH` points to a real `.xlsx` file.
- If the QR code does not appear, make sure the terminal supports ANSI output.
- If Chrome/Chromium fails to launch on Linux, install the missing system packages for Puppeteer or switch to a machine with a supported desktop environment.