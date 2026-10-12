export function buildOpenShiftOrderClause({ staffId, staffName } = {}) {
  const clauses = [
    'COALESCE(shift_cleared, false) = false',
    'COALESCE(day_cleared, false) = false',
    "status NOT IN ('Paid', 'Closed', 'Voided')"
  ];

  const params = [];
  const staffConditions = [];

  if (staffId !== undefined && staffId !== null && staffId !== '') {
    staffConditions.push(`staff_id = $${params.length + 1}`);
    params.push(Number(staffId));
  }

  if (staffName !== undefined && staffName !== null && staffName !== '') {
    staffConditions.push(`staff_name = $${params.length + 1}`);
    params.push(String(staffName));
  }

  if (staffConditions.length > 0) {
    clauses.push(`(${staffConditions.join(' OR ')})`);
  }

  return { sql: clauses.join(' AND '), params };
}

export function buildOpenShiftCashierQueueClause({ staffId, staffName } = {}) {
  const clauses = [
    'COALESCE(shift_cleared, false) = false',
    "status = 'Confirmed'",
    "method != 'Credit'"
  ];

  const params = [];
  const staffConditions = [];

  if (staffId !== undefined && staffId !== null && staffId !== '') {
    staffConditions.push(`staff_id = $${params.length + 1}`);
    params.push(Number(staffId));
  }

  if (staffName !== undefined && staffName !== null && staffName !== '') {
    staffConditions.push(`requested_by = $${params.length + 1}`);
    params.push(String(staffName));
  }

  if (staffConditions.length > 0) {
    clauses.push(`(${staffConditions.join(' OR ')})`);
  }

  return { sql: clauses.join(' AND '), params };
}
