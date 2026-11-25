export function orderItemUnitPriceSql(item = 'item') {
  return `COALESCE(
    NULLIF(${item}->'drink_serving'->>'unit_selling_price', '')::numeric,
    NULLIF(${item}->>'price', '')::numeric,
    NULLIF(${item}->>'unit_price', '')::numeric
  )`;
}

function servingLineAmountSql(item) {
  return `${orderItemUnitPriceSql(item)}
    * COALESCE(NULLIF(${item}->>'quantity', '')::numeric, 1)`;
}

function originalAmountSql(item) {
  return `COALESCE(
    CASE WHEN jsonb_typeof(${item}->'drink_serving') = 'object'
      THEN ${servingLineAmountSql(item)}
    END,
    NULLIF(${item}->>'originalLineAmount', '')::numeric,
    COALESCE(
      NULLIF(${item}->>'originalUnitPrice', '')::numeric,
      NULLIF(${item}->>'original_unit_price', '')::numeric
    ) * COALESCE(NULLIF(${item}->>'quantity', '')::numeric, 1),
    CASE
      WHEN COALESCE(${item}->>'complimentary', 'false') = 'true'
        AND NULLIF(${item}->>'payableAmount', '') IS NOT NULL
      THEN NULLIF(${item}->>'payableAmount', '')::numeric
        + COALESCE(NULLIF(${item}->>'complimentaryWaivedAmount', '')::numeric, 0)
    END,
    COALESCE(
      NULLIF(${item}->>'price', '')::numeric,
      NULLIF(${item}->>'unit_price', '')::numeric,
      0
    ) * COALESCE(NULLIF(${item}->>'quantity', '')::numeric, 1)
  )`;
}

function storedLineAmountSql(item) {
  return `COALESCE(
    CASE WHEN jsonb_typeof(${item}->'drink_serving') = 'object'
      THEN LEAST(
        ${servingLineAmountSql(item)},
        COALESCE(
          NULLIF(${item}->>'line_total', '')::numeric,
          NULLIF(${item}->>'lineTotal', '')::numeric,
          ${servingLineAmountSql(item)}
        )
      )
    END,
    NULLIF(${item}->>'line_total', '')::numeric,
    NULLIF(${item}->>'lineTotal', '')::numeric,
    COALESCE(
      NULLIF(${item}->>'price', '')::numeric,
      NULLIF(${item}->>'unit_price', '')::numeric
    ) * COALESCE(NULLIF(${item}->>'quantity', '')::numeric, 1)
  )`;
}

export function orderItemGrossAmountSql(item = 'item') {
  return originalAmountSql(item);
}

export function orderItemNetAmountSql(item = 'item') {
  return `GREATEST(
    0,
    ${originalAmountSql(item)}
      - COALESCE(NULLIF(${item}->>'menuDiscountAmount', '')::numeric, 0)
      - COALESCE(NULLIF(${item}->>'specialBillDiscountAmount', '')::numeric, 0)
      - COALESCE(NULLIF(${item}->>'complimentaryWaivedAmount', '')::numeric, 0)
  )`;
}

export function orderItemPayableAmountSql(item = 'item') {
  return `CASE WHEN COALESCE(${item}->>'complimentary', 'false') = 'true'
    THEN LEAST(
      COALESCE(
        NULLIF(${item}->>'payableAmount', '')::numeric,
        GREATEST(
          0,
          ${originalAmountSql(item)} - COALESCE(NULLIF(${item}->>'complimentaryWaivedAmount', '')::numeric, 0)
        )
      ),
      GREATEST(
        0,
        ${originalAmountSql(item)} - COALESCE(NULLIF(${item}->>'complimentaryWaivedAmount', '')::numeric, 0)
      )
    )
    ELSE ${storedLineAmountSql(item)}
  END`;
}
