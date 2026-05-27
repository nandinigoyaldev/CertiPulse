# Workshop Registration WhatsApp Bot

Production-ready Node.js app that reads workshop registrations from uploaded Excel or CSV files and sends personalized WhatsApp messages with `whatsapp-web.js`.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

## What it does

- Connects to WhatsApp Web and shows a QR code in the terminal.
- Provides a browser dashboard for uploading spreadsheets.
- Sends a personalized WhatsApp message to every valid row.
- Updates the workbook with `SENT`, `FAILED`, or `SKIPPED_DUPLICATE` and stores a timestamp.
- Shows which people did not receive an invite and why.
- Validates Indian mobile numbers before sending.
- Adds a random 10-20 second delay between messages.
- Retries transient WhatsApp send failures.
- Deduplicates by phone number so the same number is not messaged twice in one run.

## Project Structure

```text
project/
├── src/
│   ├── index.js
│   ├── jobRunner.js
│   ├── server.js
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
- An uploaded Excel or CSV file with at least a phone-number column.

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

1. For the web app, upload the workbook in the browser dashboard.
2. Make sure the first row in each file contains headers for your data.
3. If your phone column is named `Number` instead of `Phone`, the bot will still recognize it.

### 3) Configure environment variables

Edit `.env` and set these values:

```env
GROUP_LINK=https://chat.whatsapp.com/CKsaNXiMJrqASJjbFSUhqJ
WHATSAPP_CLIENT_ID=workshop-registration-bot-qr
WHATSAPP_HEADLESS=true
MESSAGE_RETRY_COUNT=3
MESSAGE_RETRY_DELAY_MS=5000
MIN_DELAY_MS=10000
MAX_DELAY_MS=20000
```

If you already have an authenticated WhatsApp session, keep `WHATSAPP_CLIENT_ID` the same so the web app reuses it.

### Admin token (recommended)

Set `ADMIN_TOKEN` in your `.env` to a strong secret to restrict access to the upload UI and API. The web UI and upload endpoints will return `401` when the token is set and not provided in the `Authorization: Bearer <token>` header.

### 5) Start the bot

```bash
npm start
```

Open `http://localhost:3000` in your browser, upload a spreadsheet, optionally paste a WhatsApp invite link, and the backend will process it automatically.

The first run prints a QR code in the terminal. Scan it with WhatsApp on your phone. After that, the session is stored locally with `LocalAuth`, so you usually do not need to scan again unless the session is cleared.

## How the sheet is processed

The decision to send is based on the phone number. `Name` and `Email` are only used to personalize the message if they exist.

If the same phone number appears more than once in the same upload, only the first eligible row is sent and the rest are marked `SKIPPED_DUPLICATE`.

- `SENT` is written after a successful send.
- `FAILED` is written if validation fails or sending fails.
- `SKIPPED_DUPLICATE` is written when the same phone number appears more than once in the same run.
- `Timestamp` is updated when the row is processed.
- The dashboard also lists every recipient that did not receive an invite.

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

## Docker

Build and run the production image:

```bash
docker build -t workshop-bot:latest .
docker run -e ADMIN_TOKEN=change_this -p 3000:3000 workshop-bot:latest
```

## Troubleshooting

- If the bot cannot read an uploaded workbook, confirm the file is a valid `.xlsx`, `.xlsm`, or `.csv`.
- If the QR code does not appear, make sure the terminal supports ANSI output.
- If Chrome/Chromium fails to launch on Linux, install the missing system packages for Puppeteer or switch to a machine with a supported desktop environment.
