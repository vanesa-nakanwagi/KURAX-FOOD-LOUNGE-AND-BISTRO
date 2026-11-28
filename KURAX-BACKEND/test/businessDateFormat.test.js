import test from 'node:test';
import assert from 'node:assert/strict';
import { getLiveBusinessDate, isValidBusinessDate } from '../helpers/businessDateFormat.js';

test('formats live business dates in Kampala time', () => {
  assert.equal(getLiveBusinessDate(new Date('2025-01-01T22:30:00.000Z')), '2025-01-02');
});

test('accepts only real ISO calendar dates', () => {
  assert.equal(isValidBusinessDate('2024-02-29'), true);
  assert.equal(isValidBusinessDate('2025-02-29'), false);
  assert.equal(isValidBusinessDate('2025-13-01'), false);
  assert.equal(isValidBusinessDate('0000-01-01'), false);
  assert.equal(isValidBusinessDate('2025-1-01'), false);
});
