function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function randomInteger(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function randomDelay(minimum, maximum) {
  return delay(randomInteger(minimum, maximum));
}

function normalizeIndianMobileNumber(rawPhone) {
  const digitsOnly = String(rawPhone || '').replace(/\D/g, '');

  if (!digitsOnly) {
    return null;
  }

  const strippedLeadingZero = digitsOnly.length === 11 && digitsOnly.startsWith('0')
    ? digitsOnly.slice(1)
    : digitsOnly;

  if (strippedLeadingZero.length === 10) {
    return `91${strippedLeadingZero}`;
  }

  if (strippedLeadingZero.length === 12 && strippedLeadingZero.startsWith('91')) {
    return strippedLeadingZero;
  }

  return digitsOnly;
}

function validatePhone(rawPhone) {
  const normalizedDigits = normalizeIndianMobileNumber(rawPhone);

  if (!normalizedDigits) {
    return {
      isValid: false,
      reason: 'Missing or empty phone number.',
    };
  }

  return {
    isValid: true,
    digits: normalizedDigits,
    whatsappId: `${normalizedDigits}@c.us`,
  };
}

function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

function sanitizeCellValue(value) {
  return String(value || '').trim();
}

function normalizeHeaderName(value) {
  return sanitizeCellValue(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Smart AI Name Capitalization & Proofing
 * Capitalizes names properly ('john doe' -> 'John Doe', 'JOHN SMITH' -> 'John Smith')
 */
function smartFormatName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'Participant';
  
  const clean = rawName.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Participant';

  return clean
    .split(' ')
    .map((word) => {
      if (!word) return '';
      const lower = word.toLowerCase();
      
      // Preserve roman numerals
      if (['ii', 'iii', 'iv', 'v', 'vi'].includes(lower)) return word.toUpperCase();
      
      // Handle Mc/Mac/O' prefixes
      if (lower.startsWith("o'") && lower.length > 2) {
        return "O'" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
      }
      if (lower.startsWith("mc") && lower.length > 2) {
        return "Mc" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Smart Email Domain Typo Correction
 * Fixes typos like gmai.com -> gmail.com, hotmai.com -> hotmail.com
 */
function smartFixEmailTypo(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') return '';
  let clean = rawEmail.trim().toLowerCase();
  
  const domainFixes = {
    'gmai.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'outlok.com': 'outlook.com',
  };

  const parts = clean.split('@');
  if (parts.length === 2) {
    const domain = parts[1];
    if (domainFixes[domain]) {
      clean = `${parts[0]}@${domainFixes[domain]}`;
    }
  }

  return clean;
}

/**
 * AI Roster Pre-Flight Health Inspection Engine
 * Analyzes spreadsheet rows for typos, suspicious entries, missing fields, and auto-corrections.
 */
function inspectRosterHealth(rows = []) {
  let totalRows = rows.length;
  let validCount = 0;
  let namesFixed = 0;
  let emailTyposFixed = 0;
  let phonesFormatted = 0;
  let suspiciousRows = [];

  const suspiciousPatterns = ['test', 'asdf', 'none', 'null', 'undefined', 'aaa', '123'];

  rows.forEach((row, index) => {
    let rowIssues = [];
    const name = row.name || '';
    const email = row.email || '';
    const phone = row.phone || '';

    // Check name quality
    if (!name || name.length <= 1) {
      rowIssues.push('Single character or missing name');
    } else if (suspiciousPatterns.some((pattern) => name.toLowerCase().includes(pattern))) {
      rowIssues.push('Suspicious placeholder name');
    }

    if (name !== smartFormatName(name)) {
      namesFixed++;
    }

    // Check email quality
    if (!email || !email.includes('@')) {
      rowIssues.push('Invalid email address format');
    } else if (email !== smartFixEmailTypo(email)) {
      emailTyposFixed++;
    }

    // Check phone quality
    if (phone) {
      const phoneValidation = validatePhone(phone);
      if (phoneValidation.isValid) {
        phonesFormatted++;
      } else {
        rowIssues.push(phoneValidation.reason);
      }
    } else {
      rowIssues.push('Missing phone number');
    }

    if (rowIssues.length === 0) {
      validCount++;
    } else {
      suspiciousRows.push({
        rowNumber: row.rowNumber || index + 2,
        name,
        email,
        phone,
        issues: rowIssues,
      });
    }
  });

  const healthScore = totalRows > 0 ? Math.round(((totalRows - suspiciousRows.length) / totalRows) * 100) : 100;

  return {
    totalRows,
    validCount,
    healthScore,
    namesFixed,
    emailTyposFixed,
    phonesFormatted,
    suspiciousRows,
  };
}

module.exports = {
  delay,
  formatTimestamp,
  randomDelay,
  normalizeHeaderName,
  sanitizeCellValue,
  validatePhone,
  smartFormatName,
  smartFixEmailTypo,
  inspectRosterHealth,
};