import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

// ─── Maintenance Logs Validation ─────────────────────────────────────

export const validateMaintenanceLog = onDocumentWritten('maintenance_logs/{logId}', (event) => {
  const after = event.data?.after.data();

  if (!after) {
    // Document deleted — no validation needed
    return;
  }

  const logId = event.params.logId;
  const errors: string[] = [];

  // Required fields
  if (!after.tail_number || typeof after.tail_number !== 'string') {
    errors.push('tail_number is required and must be a string');
  }
  if (!after.discrepancy || typeof after.discrepancy !== 'string') {
    errors.push('discrepancy is required and must be a string');
  }
  if (!after.repair || typeof after.repair !== 'string') {
    errors.push('repair is required and must be a string');
  }
  if (!after.technician_name || typeof after.technician_name !== 'string') {
    errors.push('technician_name is required and must be a string');
  }

  // Business rule: Red Ball items must have a JCN
  if (after.is_red_ball === true) {
    if (!after.jcn || typeof after.jcn !== 'string' || after.jcn.trim() === '') {
      errors.push('Red Ball items must have a valid JCN (Job Control Number)');
    }
  }

  // Business rule: Timestamp must be reasonable (not more than 24h in future)
  if (after.timestamp) {
    const logTime = after.timestamp.toDate ? after.timestamp.toDate() : new Date(after.timestamp);
    const now = new Date();
    const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (logTime > futureLimit) {
      errors.push('Timestamp cannot be more than 24 hours in the future');
    }

    // Not more than 1 year in the past
    const pastLimit = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    if (logTime < pastLimit) {
      errors.push('Timestamp cannot be more than 1 year in the past');
    }
  }

  // Tail number format validation (basic pattern)
  if (after.tail_number) {
    // Accept formats like: 85-0123, 850123, 0123, AF-85-0123
    const tailPattern = /^(AF-)?\d{2,4}-?\d{3,4}$/;
    if (!tailPattern.test(after.tail_number)) {
      logger.warn(`Log ${logId}: Unusual tail number format: ${after.tail_number}`);
    }
  }

  if (errors.length > 0) {
    logger.error(`Validation failed for maintenance_logs/${logId}:`, errors);
    // Note: We can't prevent the write here (it already happened).
    // In production, you might want to:
    // 1. Delete the invalid document
    // 2. Move it to a quarantine collection
    // 3. Send an alert to admins
    // For now, we just log the error.
  } else {
    logger.debug(`maintenance_logs/${logId} passed validation`);
  }
});

// ─── Training Records Validation ─────────────────────────────────────

export const validateTrainingRecord = onDocumentWritten('training/{recordId}', (event) => {
  const after = event.data?.after.data();

  if (!after) {
    return;
  }

  const recordId = event.params.recordId;
  const errors: string[] = [];

  // Required fields
  if (!after.personnel_id || typeof after.personnel_id !== 'string') {
    errors.push('personnel_id is required');
  }
  if (!after.course_name || typeof after.course_name !== 'string') {
    errors.push('course_name is required');
  }
  if (!after.due_date) {
    errors.push('due_date is required');
  }

  // Business rule: Due date must be in the future (for new records)
  if (after.due_date) {
    const dueDate = after.due_date.toDate ? after.due_date.toDate() : new Date(after.due_date);
    const now = new Date();

    // Allow past due dates (for tracking overdue items), but not more than 5 years
    const pastLimit = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
    if (dueDate < pastLimit) {
      errors.push('Due date cannot be more than 5 years in the past');
    }

    // Not more than 10 years in the future
    const futureLimit = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
    if (dueDate > futureLimit) {
      errors.push('Due date cannot be more than 10 years in the future');
    }
  }

  // Auto-compute status based on due date
  if (after.due_date && after.status !== undefined) {
    const dueDate = after.due_date.toDate ? after.due_date.toDate() : new Date(after.due_date);
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    let computedStatus: string;
    if (dueDate < now) {
      computedStatus = 'expired';
    } else if (dueDate < sixtyDaysFromNow) {
      computedStatus = 'expiring';
    } else {
      computedStatus = 'current';
    }

    if (after.status !== computedStatus) {
      logger.warn(
        `Training record ${recordId}: status mismatch. Expected ${computedStatus}, got ${after.status}`
      );
    }
  }

  if (errors.length > 0) {
    logger.error(`Validation failed for training/${recordId}:`, errors);
  }
});

// ─── Personnel Validation ────────────────────────────────────────────

export const validatePersonnel = onDocumentWritten('personnel/{personnelId}', (event) => {
  const after = event.data?.after.data();

  if (!after) {
    return;
  }

  const personnelId = event.params.personnelId;
  const errors: string[] = [];

  // Required fields
  if (!after.name || typeof after.name !== 'string') {
    errors.push('name is required');
  }
  if (!after.email || typeof after.email !== 'string') {
    errors.push('email is required');
  }
  if (!after.role || typeof after.role !== 'string') {
    errors.push('role is required');
  }

  // Email validation
  if (after.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(after.email)) {
      errors.push('Invalid email format');
    }

    // Business rule: Only @us.af.mil emails allowed
    if (!after.email.toLowerCase().endsWith('@us.af.mil')) {
      errors.push('Only @us.af.mil email addresses are allowed');
    }
  }

  // Role validation
  if (after.role) {
    const validRoles = ['technician', 'ncoic', 'leadership', 'admin'];
    if (!validRoles.includes(after.role)) {
      errors.push(`Invalid role: ${after.role}. Must be one of: ${validRoles.join(', ')}`);
    }
  }

  // Rank validation (if provided)
  if (after.rank) {
    const validRanks = [
      'AB',
      'Amn',
      'A1C',
      'SrA',
      'SSgt',
      'TSgt',
      'MSgt',
      'SMSgt',
      'CMSgt',
      '2Lt',
      '1Lt',
      'Capt',
      'Maj',
      'Lt Col',
      'Col',
      'Brig Gen',
      'Maj Gen',
      'Lt Gen',
      'Gen',
      'Civ',
    ];
    if (!validRanks.includes(after.rank)) {
      logger.warn(`Personnel ${personnelId}: Unusual rank: ${after.rank}`);
    }
  }

  if (errors.length > 0) {
    logger.error(`Validation failed for personnel/${personnelId}:`, errors);
  }
});
