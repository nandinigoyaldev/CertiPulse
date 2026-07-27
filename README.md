# CertiPulse ⚡

> **The Open-Source Credential Platform for Dynamic Certificate Generation, QR Verification & Automated Delivery**

CertiPulse is an enterprise-grade, web-based certificate generation and automation platform for event organizers, workshop hosts, bootcamps, and hackathons. It replaces legacy manual certificate workflows and ban-prone messaging bots with a secure, 1-click web platform.

---

## 🌟 Feature Overview & Partner Comparison

| Feature | Legacy Bot | Certifier / Sertifier | **CertiPulse ⚡** |
| :--- | :---: | :---: | :---: |
| **Custom PNG Artwork Upload** | ❌ | ✅ | **✅ (Canva / Photoshop templates)** |
| **Live Canvas Preview & Slider Controls** | ❌ | ✅ | **✅ (Real-time HTML5 Canvas)** |
| **Scannable Verification QR Code** | ❌ | ✅ | **✅ (Burned in PDF & Scannable)** |
| **Public Verification Portal (`/verify/:id`)** | ❌ | ✅ | **✅ (Tamper-proof registry)** |
| **1-Click LinkedIn Add to Profile** | ❌ | ✅ | **✅ (Pre-populated certification link)** |
| **1-Click X / Twitter Sharing** | ❌ | ❌ | **✅ Built-in** |
| **Bulk Certificate ZIP Archive Export** | ❌ | ✅ | **✅ 1-Click ZIP Download** |
| **Certificate Lifecycle (Revocation / Expiry)** | ❌ | ✅ | **✅ Complete audit trail & revocation** |
| **Safe Automated Email Engine** | ❌ (Banned) | ✅ | **✅ Rate-limited SMTP / Nodemailer** |
| **100% Data Privacy & Self-Hosted** | ❌ | ❌ | **✅ Open Source / Zero Vendor Lock-in** |

---

## 🚀 Quick Start

### 1) Prerequisites
- Node.js 18 or newer.

### 2) Installation
```bash
git clone https://github.com/nandinigoyaldev/Workshop-WhatsApp-Assistant.git certipulse
cd certipulse
npm install
```

### 3) Configuration (Optional `.env`)
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

> *Note: If SMTP credentials are not configured, CertiPulse runs in safe dry-run mode for local testing and batch ZIP generation.*

### 4) Run Platform
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 🛠️ REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check and status |
| `POST` | `/api/preview-certificate` | Generate high-res PDF certificate preview |
| `POST` | `/upload` | Upload spreadsheet roster (CSV/Excel) and trigger batch dispatch |
| `GET` | `/jobs` | List active and historical upload dispatch jobs |
| `GET` | `/api/jobs/:jobId/download-zip` | Download all generated certificates in a `.zip` archive |
| `GET` | `/api/certificates` | Search & filter credential audit registry |
| `POST` | `/api/certificates/:id/resend` | Resend certificate email to attendee |
| `POST` | `/api/certificates/:id/revoke` | Revoke issued certificate with reason |
| `GET` | `/verify/:certId` | Public tamper-proof verification page |
| `GET` | `/api/verify/:certId` | Programmatic verification API (JSON) |

---

## 🛡️ Security & Privacy Architecture

* **Helmet HTTP Security**: Protection against XSS, clickjacking, and MIME-type sniffing.
* **Rate Limiting**: API routes protected with `express-rate-limit` against brute-forcing.
* **Input Sanitization**: All attendee details sanitized before PDF rendering and HTML email formatting.
* **Local Storage & Zero Lock-in**: Full control over attendee rosters and data.

---

## 📄 License

MIT License. Built with ❤️ for event hosts and hackathon organizers.
