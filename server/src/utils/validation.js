/**
 * Input validation utility for authentication operations.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates registration payload.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateRegistration(data = {}) {
  const errors = [];
  const {
    email,
    password,
    full_name,
    phone,
    society_locality,
    flat_house_number,
    city,
  } = data;

  // Email
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  } else if (email.trim().length > 255) {
    errors.push('Email address cannot exceed 255 characters.');
  }

  // Password: min 8 chars, 1 uppercase, 1 lowercase, 1 digit
  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  } else if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  } else if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  } else if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit.');
  }

  // Full Name
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long.');
  } else if (full_name.trim().length > 150) {
    errors.push('Full name cannot exceed 150 characters.');
  }

  // Phone
  if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
    errors.push('A valid phone number is required (at least 8 characters).');
  } else if (phone.trim().length > 30) {
    errors.push('Phone number cannot exceed 30 characters.');
  }

  // Society / Locality
  if (!society_locality || typeof society_locality !== 'string' || society_locality.trim().length < 2) {
    errors.push('Society/locality is required.');
  } else if (society_locality.trim().length > 255) {
    errors.push('Society/locality cannot exceed 255 characters.');
  }

  // Flat / House Number
  if (!flat_house_number || typeof flat_house_number !== 'string' || flat_house_number.trim().length < 1) {
    errors.push('Flat or house number is required.');
  } else if (flat_house_number.trim().length > 100) {
    errors.push('Flat or house number cannot exceed 100 characters.');
  }

  // City
  if (!city || typeof city !== 'string' || city.trim().length < 2) {
    errors.push('City is required.');
  } else if (city.trim().length > 100) {
    errors.push('City cannot exceed 100 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates login payload.
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateLogin(data = {}) {
  const errors = [];
  const { email, password } = data;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateRegistration,
  validateLogin,
};
