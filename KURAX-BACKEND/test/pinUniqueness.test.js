import test from 'node:test';
import assert from 'node:assert/strict';
import { hashStaffPin } from '../helpers/staffPin.js';
import { assertPinIsAvailable } from '../helpers/pinUniqueness.js';

const lockSecret = 'test-secret';

async function pinRow(id, pin) {
  const { salt, hash } = await hashStaffPin(pin);
  return { id, pin_salt: salt, pin_hash: hash };
}

function createQueryable({ staff = [], shishaStaff = [] } = {}) {
  const lockParameters = [];
  return {
    lockParameters,
    async query(sql, parameters = []) {
      if (sql.includes('pg_advisory_xact_lock')) {
        lockParameters.push(parameters[0]);
        return { rows: [] };
      }
      if (sql.includes('public.staff')) {
        return { rows: staff.filter(row => parameters[0] == null || row.id !== parameters[0]) };
      }
      if (sql.includes('public.shisha_staff')) {
        return { rows: shishaStaff.filter(row => parameters[0] == null || row.id !== parameters[0]) };
      }
      throw new Error('Unexpected query');
    },
  };
}

test('rejects a PIN already assigned to a Kurax staff account', async () => {
  const pin = '0123';
  const queryable = createQueryable({ staff: [await pinRow(1, pin)] });

  await assert.rejects(
    assertPinIsAvailable(queryable, pin, { lockSecret }),
    { code: 'PIN_ALREADY_IN_USE', statusCode: 409 }
  );
});

test('rejects a PIN already assigned to a Shisha account', async () => {
  const pin = '123456';
  const queryable = createQueryable({ shishaStaff: [await pinRow(2, pin)] });

  await assert.rejects(
    assertPinIsAvailable(queryable, pin, { lockSecret }),
    { code: 'PIN_ALREADY_IN_USE', statusCode: 409 }
  );
});

test('rejects a PIN still stored as legacy plaintext', async () => {
  const pin = '2468';
  const queryable = createQueryable({ staff: [{ id: 5, pin, pin_salt: null, pin_hash: null }] });

  await assert.rejects(
    assertPinIsAvailable(queryable, pin, { lockSecret }),
    { code: 'PIN_ALREADY_IN_USE', statusCode: 409 }
  );
});

test('allows an account to keep its own PIN but rejects a duplicate in the other account table', async () => {
  const pin = '5678';
  const staff = await pinRow(3, pin);
  const ownPinOnly = createQueryable({ staff: [staff] });
  const queryable = createQueryable({ staff: [staff], shishaStaff: [await pinRow(4, pin)] });

  await assertPinIsAvailable(ownPinOnly, pin, { excludeStaffId: 3, lockSecret });
  await assert.rejects(
    assertPinIsAvailable(queryable, pin, { excludeStaffId: 3, lockSecret }),
    { code: 'PIN_ALREADY_IN_USE', statusCode: 409 }
  );
  assert.notEqual(ownPinOnly.lockParameters[0], pin);
});

test('rejects invalid PIN formats before querying existing accounts', async () => {
  const queryable = createQueryable();

  await assert.rejects(
    assertPinIsAvailable(queryable, '12ab', { lockSecret }),
    { statusCode: 400, message: 'PIN must contain 4-8 digits.' }
  );
  assert.equal(queryable.lockParameters.length, 0);
});
