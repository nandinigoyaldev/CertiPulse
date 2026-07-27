# CertiPulse ⚡ Enterprise Credential & Automation Platform

> Next-generation Architectural Certificate Engine for Instant Studio Layouts, Batch Spreadsheet Automation, Cryptographic Verification, and Open Badges 3.0 Standard.

---

## 🔒 Security, Trust & Data Privacy Standards

CertiPulse is engineered from the ground up for high-trust enterprise and educational organizations:

1. **Zero-Password Storage Architecture**:
   - SMTP Passwords and App Passwords are **never written to disk or stored in any database**.
   - Credentials exist strictly in ephemeral RAM during the active batch dispatch process and are immediately discarded.

2. **SHA-256 Cryptographic Audit Trail**:
   - Every issued credential generates an immutable 64-character SHA-256 fingerprint stored in `data/certificates.json`.
   - Any modification or tampering with recipient data or issue dates invalidates the verification portal status automatically.

3. **W3C Open Badges 3.0 Compliance**:
   - Implements standard W3C Verifiable Credentials metadata JSON at `/api/certificates/:certId/badge.json`.

4. **GDPR & Data Protection**:
   - Recipient names, emails, and phone numbers are utilized strictly for certificate rendering and direct delivery.

---

## 🛠️ Features & Key Capabilities

- **Interactive 3D Sticky Canvas**: Real-time canvas preview locked alongside cursor controls.
- **AI Smart Roster Proofing**: Auto-capitalizes candidate names, fixes email typos (`gmai.com` $\rightarrow$ `gmail.com`), and formats phone numbers.
- **Multi-Format Upload**: Drag-and-drop support for Canva/Photoshop custom PNG artwork and CSV/Excel candidate spreadsheets.
- **Multi-Channel Dispatch**: Automated SMTP email attachments, zip archive bundle downloads, and WhatsApp integration.
- **Mobile Wallet Integration**: Apple Wallet and Google Pay W3C pass metadata support.

---

## 🚀 Quick Start Guide

### 1. Install & Boot Platform
```bash
npm install
npm run dev
```
Open **`http://localhost:3000`** in your web browser.

### 2. Run Free Automated Test Suite
```bash
npm test
```

---

## 📖 Email SMTP Setup Guide

| Service | SMTP Host | Port | Username | Password / Key |
| :--- | :--- | :--- | :--- | :--- |
| **Gmail** | `smtp.gmail.com` | `587` | Your Gmail Email | 16-Letter App Password |
| **Brevo** | `smtp-relay.brevo.com` | `587` | Brevo Email | SMTP API Key |
| **Resend** | `smtp.resend.com` | `465` | `resend` | API Key (`re_...`) |
| **ZIP Download (No SMTP)** | *Leave Blank* | *Leave Blank* | *Leave Blank* | *Leave Blank* |

---

## 🧪 License
Licensed under the MIT License.
