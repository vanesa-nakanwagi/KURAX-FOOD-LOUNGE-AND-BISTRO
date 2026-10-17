import test from 'node:test';
import assert from 'node:assert/strict';
import { getPageWindow, parsePagination, toSearchPattern } from '../helpers/pagination.js';

test('pagination accepts configured page sizes and computes offsets', () => {
  const request = parsePagination({ page: '3', limit: '10' });
  assert.deepEqual(getPageWindow(25, request), {
    currentPage: 3,
    pageSize: 10,
    totalRecords: 25,
    totalPages: 3,
    offset: 20,
  });
});

test('pagination clamps pages beyond the last record and handles empty results', () => {
  const request = parsePagination({ page: '9', limit: '20' });
  assert.equal(getPageWindow(21, request).currentPage, 2);
  assert.deepEqual(getPageWindow(0, request), {
    currentPage: 1,
    pageSize: 20,
    totalRecords: 0,
    totalPages: 0,
    offset: 0,
  });
});

test('pagination rejects invalid pages, sizes, searches, and sort orders', () => {
  assert.throws(() => parsePagination({ page: '0' }), /positive integer/);
  assert.throws(() => parsePagination({ page: '1', limit: '100' }), /10, 20, or 50/);
  assert.throws(() => parsePagination({ page: '1', search: 'x'.repeat(201) }), /200 characters/);
  assert.throws(() => parsePagination({ page: '1', sortOrder: 'sideways' }), /asc or desc/);
});

test('pagination search treats SQL wildcard characters literally', () => {
  assert.equal(toSearchPattern('sales%_!'), '%sales!%!_!!%');
});