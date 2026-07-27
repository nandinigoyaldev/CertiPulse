const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { generateCertificateBuffer } = require('../src/certificateGenerator');
const { registerCertificate, getCertificate, getAllCertificates } = require('../src/verificationStore');

let passedTests = 0;
let failedTests = 0;
const TEST_PORT = 3099;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('\n⚡ CertiPulse Automated Free Test Suite Execution\n' + '='.repeat(55));

  // TEST 1: Verification Store Registration
  console.log('\n[1/5] Testing Verification Store & SHA-256 Fingerprinting...');
  try {
    const cert = registerCertificate({
      recipientName: 'Test Candidate',
      recipientEmail: 'tester@example.com',
      eventTitle: 'Automated QA Test Event',
      issueDate: '2026-07-27',
      issuerName: 'QA Test Engine',
    });

    assert(Boolean(cert.certId && cert.certId.startsWith('CERT-')), 'Certificate ID generated with CERT- prefix');
    assert(Boolean(cert.fingerprintHash && cert.fingerprintHash.length === 64), 'SHA-256 fingerprint hash is 64 hex characters');

    const fetched = getCertificate(cert.certId, false);
    assert(fetched && fetched.recipientName === 'Test Candidate', 'Retrieved registered certificate matches recipient name');
  } catch (err) {
    assert(false, 'Verification Store registration threw error: ' + err.message);
  }

  // TEST 2: PDF Generator Buffer with Custom Work2Hire Background
  console.log('\n[2/5] Testing PDF Generator with Work2Hire Artwork & Layout Toggles...');
  try {
    const bgPath = path.resolve(process.cwd(), 'public', 'work2hire_template.jpg');
    let bgBuffer = null;
    if (fs.existsSync(bgPath)) {
      bgBuffer = fs.readFileSync(bgPath);
    }

    const pdfBuffer = await generateCertificateBuffer({
      recipientName: 'Nandini Goyal',
      certId: 'CERT-AUTOTEST123',
      issueDate: '2026-07-27',
      customBackground: bgBuffer,
      layoutSettings: {
        showName: true,
        nameY: 270,
        nameSize: 30,
        showQr: true,
        qrX: 742,
        qrY: 494,
        qrSize: 70,
        showEvent: false,
        showSubtitle: false,
        showBadge: false,
        showFooter: false,
      },
    });

    assert(Buffer.isBuffer(pdfBuffer), 'PDF generator returned a valid Buffer');
    assert(pdfBuffer.length > 2500, `PDF file size is healthy (${pdfBuffer.length} bytes)`);
  } catch (err) {
    assert(false, 'PDF Generator threw error: ' + err.message);
  }

  // Start Test Server
  console.log('\n[3/5] Testing Live Express Server Endpoints...');
  const app = require('../src/server.js');
  let testServer = null;
  
  await new Promise((resolve) => {
    testServer = app.listen(TEST_PORT, () => {
      resolve();
    });
  });

  try {
    await makeHttpRequest('/health', (status, data) => {
      assert(status === 200, 'GET /health returned HTTP 200');
      assert(data.includes('"ok":true'), 'GET /health returns JSON {"ok":true}');
    });

    await makeHttpRequest('/api/certificates', (status, data) => {
      assert(status === 200, 'GET /api/certificates returned HTTP 200');
      assert(data.startsWith('['), 'GET /api/certificates returns valid JSON array');
    });

    // TEST 4: Public Verification Portal HTML Render
    console.log('\n[4/5] Testing Public Verification Portal HTML Cards...');
    await makeHttpRequest('/verify/CERT-DEMO1234', (status, data) => {
      assert(status === 200, 'GET /verify/CERT-DEMO1234 returned HTTP 200');
      assert(data.includes('Verified Credential') || data.includes('CertiPulse'), 'Public verification portal card rendered');
    });

    // TEST 5: Open Badges 3.0 Metadata JSON
    console.log('\n[5/5] Testing W3C Open Badges 3.0 Metadata Endpoint...');
    const allCerts = getAllCertificates();
    if (allCerts.length) {
      const testCertId = allCerts[0].certId;
      await makeHttpRequest(`/api/certificates/${testCertId}/badge.json`, (status, data) => {
        assert(status === 200, `GET /api/certificates/${testCertId}/badge.json returned HTTP 200`);
        assert(data.includes('Assertion') || data.includes('BadgeClass'), 'Open Badges 3.0 W3C spec JSON verified');
      });
    }
  } finally {
    if (testServer) testServer.close();
  }

  console.log('\n' + '='.repeat(55));
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED.`);
  console.log('='.repeat(55) + '\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

function makeHttpRequest(path, callback) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: 'localhost',
        port: TEST_PORT,
        path,
        method: 'GET',
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          callback(res.statusCode, body);
          resolve();
        });
      }
    );
    req.on('error', (err) => {
      console.error(`HTTP request error on ${path}:`, err.message);
      callback(500, '');
      resolve();
    });
    req.end();
  });
}

runTestSuite();
