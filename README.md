# CertiPulse ⚡

> **The Web Platform for Dynamic Certificate Generation, QR Verification & Automated Email Delivery**

CertiPulse turns workshop and event credential distribution into a seamless 1-click web experience. Organizers can visually design custom certificates, upload attendee rosters (CSV/Excel), issue tamper-proof PDF certificates with unique QR verification codes, and dispatch automated emails safely without risk of WhatsApp phone bans.

---

## 🌟 Key Features

* **🎨 Live Certificate Studio**: Interactive visual editor with dynamic placeholders (`{{name}}`, `{{event}}`, `{{certificate_id}}`, `{{date}}`), theme accent color pickers, and live PDF preview.
* **✉️ Safe & Reliable Email Engine**: Uses standard SMTP / Nodemailer (supporting Gmail App Passwords, SendGrid, Mailgun, or custom servers). Includes random humanized delay intervals to ensure high deliverability and zero spam blocks.
* **🔒 Public QR Verification Portal (`/verify/:certId`)**: Every certificate includes a unique verification code (`CERT-XXXXX`) and embedded QR code so attendees, recruiters, and employers can authenticate credentials in real time.
* **📊 Excel & CSV Roster Import**: Drag-and-drop file upload with column auto-matching (`Email`, `Name`, `Status`, `CertId`).
* **🛡️ Security & Privacy First**: Built with `helmet` HTTP security headers, input sanitization, rate-limiting, and local processing to protect user privacy.

---

## 🚀 Quick Start

### 1) Prerequisites
- Node.js 18 or higher.

### 2) Installation
```bash
git clone https://github.com/nandinigoyaldev/Workshop-WhatsApp-Assistant.git certipulse
cd certipulse
npm install
```

### 3) Configure Environment (Optional)
Copy `.env.example` to `.env` or set environment variables:

```env
PORT=3000
APP_BASE_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=certificates@yourdomain.com
FROM_NAME=CertiPulse Credentials
MIN_DELAY_MS=1000
MAX_DELAY_MS=3000
```

> *Note: If SMTP parameters are omitted, CertiPulse runs in safe dry-run mode for local testing.*

### 4) Start the Server
```bash
npm start
```

Open `http://localhost:3000` in your browser.

---

## 🛠️ Product Architecture

```text
public/
├── index.html        # Glassmorphic Web App UI
├── style.css         # Modern design tokens & layout
└── app.js            # Live Canvas preview & interactive client logic
src/
├── server.js               # Express server with Helmet & Rate limiting
├── certificateGenerator.js # High-res PDF generator with QR code
├── email.js                # Nodemailer email dispatcher
├── verificationStore.js    # Tamper-proof certificate registry
├── sheets.js               # Excel/CSV roster parser
└── jobRunner.js            # Batch execution queue
```

---

## 🔐 Security & Anti-Abuse Measures

1. **Email Rate Limiting**: Random delay between dispatches to maintain healthy sender reputation.
2. **XSS Protection & Escaping**: All user inputs rendered in preview or email templates are sanitized.
3. **File Upload Limits**: Restricted to valid `.xlsx`, `.xlsm`, and `.csv` files up to 25MB.
4. **Data Isolation**: Attendee data is stored locally and never shared with third-party tracking services.

---

## 📄 License

Licensed under the MIT License.
