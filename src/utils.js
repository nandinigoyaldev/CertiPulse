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

  return null;
}

function validatePhone(rawPhone) {
  const normalizedDigits = normalizeIndianMobileNumber(rawPhone);

  if (!normalizedDigits) {
    return {
      isValid: false,
      reason: 'Phone number is not a valid Indian mobile number.',
    };
  }

  if (!/^91[6-9]\d{9}$/.test(normalizedDigits)) {
    return {
      isValid: false,
      reason: 'Indian mobile numbers must start with 6, 7, 8, or 9 after the +91 country code.',
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

module.exports = {
  delay,
  formatTimestamp,
  randomDelay,
  normalizeHeaderName,
  sanitizeCellValue,
  validatePhone,
};