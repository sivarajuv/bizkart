import { PASSWORD_MIN_LENGTH } from './appConstants';

export const USER_MESSAGES = {
  CREATE_BUSINESS_REQUIRED: 'Create a business first before adding shop users.',
  SELECT_BUSINESS: 'Please select a business.',
  NO_BUSINESS_HELPER: 'Create a business first, then add users for that business.',
  SAVE_USER_ERROR: 'Unable to save user',
  CREATE_BUSINESS_ERROR: 'Unable to create business',
  DELETE_USER_CONFIRM: (name) => `Delete user "${name}"?`,
  DELETE_BUSINESS_CONFIRM: (name) =>
    `Delete business "${name}" and all related users, products, customers, orders, and reports? This cannot be undone.`,
};

export const PASSWORD_MESSAGES = {
  REQUIRED_FIELDS: 'Please fill in all password fields.',
  MIN_LENGTH: `New password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
  MISMATCH: 'New password and confirm password do not match.',
  SUCCESS: 'Password changed successfully.',
  FAILURE: 'Failed to change password',
};
