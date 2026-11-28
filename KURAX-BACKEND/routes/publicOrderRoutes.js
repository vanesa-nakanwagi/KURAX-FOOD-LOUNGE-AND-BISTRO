import express from 'express';
import { randomUUID } from 'node:crypto';
import pool from '../db.js';
import {
  buildSalesRevenueBreakdown,
  createSalesJournalEntry,
} from '../helpers/accounting.js';
import {
  buildPublicOrderItems,
  calculatePublicOrderTotal,
  groupPublicOrderItemsByStation,
  markPublicOrderItemsPaid,
  normalizePublicCustomer,
} from '../helpers/publicOrderValidation.js';
import { consumeSoldOrderItems } from '../helpers/recipeConsumption.js';
import notificationService from '../helpers/notificationService.js';
import { buildStationOrderNotifications } from '../helpers/stationOrderNotifications.js';
import { syncRoutableStationTicketsForAllStations } from '../helpers/stationOrderTickets.js';
import requireCashier from '../middleware/cashierAuth.js';

const router = express.Router();

router.post('/payment-requests', async (req, res) => {
  const requestKey = String(req.body?.requestKey || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestKey)) {
    return res.status(400).json({ error: 'Invalid checkout request key. Please refresh checkout and retry.' });
  }

  let customer;
  let items;
  try {
    customer = normalizePublicCustomer(req.body?.customer);
    items = await buildPublicOrderItems(req.body?.items, async (type, id) => {
      const result = await pool.query(
        type === 'combo'
          ? `SELECT id, name, price + COALESCE(website_extra_fee, 0) AS price, category, station
             FROM public.combos
             WHERE id = $1 AND website_published = true
               AND COALESCE(is_available, true) = true`
          : `SELECT id, name, price + COALESCE(website_extra_fee, 0) AS price, category, station,
                      promotion_enabled, promotion_discount_type, promotion_discount_value,
                      promotion_discount_percent, promotion_starts_at, promotion_ends_at
               FROM public.menus
               WHERE id = $1 AND website_published = true
                 AND COALESCE(is_available, true) = true`,
        [id]
      );
      return result.rows[0] || null;
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message });
  }

  const total = calculatePublicOrderTotal(items);
  if (!Number.isFinite(total) || total <= 0) {
    return res.status(400).json({ error: 'The order total must be greater than zero.' });
  }

  const reference = `KX-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
  const paymentMethod = customer.paymentProvider === 'MTN' ? 'Momo-MTN' : 'Momo-Airtel';
  const client = await pool.connect();
  let clientReleased = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`public-order-request:${requestKey}`]);
    const existingResult = await client.query(
      `SELECT public_order_ref, total, payment_provider, status, preparation_status, items, mobile_money_number
       FROM public.public_payment_requests WHERE request_key = $1`,
      [requestKey]
    );
    if (existingResult.rows[0]) {
      const existing = existingResult.rows[0];
      await client.query('COMMIT');
      return res.status(200).json({
        orderReference: existing.public_order_ref,
        amount: Number(existing.total),
        paymentProvider: existing.payment_provider,
        status: existing.status,
        preparationStatus: existing.preparation_status,
        items: existing.items,
        mobileMoneyNumber: existing.mobile_money_number,
      });
    }

    const queueResult = await client.query(
      `INSERT INTO public.cashier_queue
         (order_ids, table_name, label, amount, method, status, requested_by,
          is_item, item, order_type, public_order_ref, created_at, updated_at, business_date)
       VALUES ('[]'::jsonb, 'PUBLIC-WEB', $1, $2, $3, 'Pending', $4,
               false, $5::jsonb, $6, $7, NOW(), NOW(), $8::date)
       RETURNING id`,
      [
        `Website order ${reference}`,
        total,
        paymentMethod,
        customer.customerName,
        JSON.stringify({ public_order_ref: reference, items }),
        customer.deliveryType === 'Home' ? 'Online Delivery' : 'Online Pickup',
        reference,
        req.businessDate,
      ]
    );
    const queueId = queueResult.rows[0].id;
    await client.query(
      `INSERT INTO public.public_payment_requests
         (cashier_queue_id, public_order_ref, request_key, status, customer_name, customer_email,
          mobile_money_number, payment_provider, delivery_type, city, location_desc,
          items, total, created_at, updated_at)
       VALUES ($1, $2, $3, 'Pending', $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, NOW(), NOW())`,
      [
        queueId,
        reference,
        requestKey,
        customer.customerName,
        customer.customerEmail,
        customer.mobileMoneyNumber,
        customer.paymentProvider,
        customer.deliveryType,
        customer.city,
        customer.locationDesc,
        JSON.stringify(items),
        total,
      ]
    );
    await client.query('COMMIT');
    client.release();
    clientReleased = true;
    try {
      const notification = await notificationService.sendToRoles(['CASHIER'], {
        type: 'PUBLIC_ORDER_PAYMENT_REQUEST',
        title: 'New website order',
        body: `${reference} from ${customer.customerName} is awaiting payment confirmation.`,
        referenceId: queueId,
        referenceType: 'cashier_queue',
        link: '/cashier',
      });
      if (notification.error || notification.failed || notification.noRecipients) {
        console.warn(`Public order cashier notification was not fully delivered for ${reference}:`, notification);
      }
    } catch (notificationError) {
      console.error(`Public order cashier notification failed for ${reference}:`, notificationError.message);
    }
    return res.status(201).json({
      orderReference: reference,
      amount: total,
      paymentProvider: customer.paymentProvider,
      status: 'Pending',
      preparationStatus: 'NotSent',
      items,
      mobileMoneyNumber: customer.mobileMoneyNumber,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Public payment request creation failed:', error.message);
    return res.status(500).json({ error: 'Unable to create your payment request. Please try again.' });
  } finally {
    if (!clientReleased) client.release();
  }
});

router.get('/payment-requests/:reference', async (req, res) => {
  const reference = String(req.params.reference || '').trim();
  if (!/^KX-[A-F0-9]{10}$/.test(reference)) {
    return res.status(400).json({ error: 'Invalid order reference.' });
  }

  try {
    const result = await pool.query(
      `SELECT public_order_ref, status, order_id, reject_reason, confirmed_at, preparation_status
       FROM public.public_payment_requests
       WHERE public_order_ref = $1`,
      [reference]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Payment request not found.' });
    const request = result.rows[0];
    return res.json({
      orderReference: request.public_order_ref,
      status: request.status,
      orderId: request.order_id,
      rejectionReason: request.reject_reason,
      confirmedAt: request.confirmed_at,
      preparationStatus: request.preparation_status,
    });
  } catch (error) {
    console.error('Public payment status lookup failed:', error.message);
    return res.status(500).json({ error: 'Unable to check payment status.' });
  }
});

router.patch('/payment-requests/:id/send-to-stations', requireCashier, (_req, res) => (
  res.status(409).json({ error: 'Confirm the payment and enter its transaction ID before sending this order to the stations.' })
));

router.patch('/payment-requests/:id/confirm', requireCashier, async (req, res) => {
  const queueId = Number(req.params.id);
  const transactionId = String(req.body?.transaction_id || '').trim();
  if (!Number.isInteger(queueId) || queueId <= 0) {
    return res.status(400).json({ error: 'Invalid cashier queue item.' });
  }
  if (transactionId.length < 4 || transactionId.length > 100 || !/^[A-Za-z0-9-]+$/.test(transactionId)) {
    return res.status(400).json({ error: 'Enter a valid mobile money transaction ID.' });
  }

  const client = await pool.connect();
  let committedOrderId;
  let committedItems;
  let transactionCommitted = false;
  let clientReleased = false;
  try {
    await client.query('BEGIN');
    const queueResult = await client.query(
      `SELECT * FROM public.cashier_queue WHERE id = $1 FOR UPDATE`,
      [queueId]
    );
    const queue = queueResult.rows[0];
    if (!queue?.public_order_ref) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Public payment request not found.' });
    }
    if (queue.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `This request is already ${String(queue.status).toLowerCase()}.` });
    }

    const requestResult = await client.query(
      `SELECT * FROM public.public_payment_requests
       WHERE cashier_queue_id = $1 FOR UPDATE`,
      [queueId]
    );
    const paymentRequest = requestResult.rows[0];
    if (!paymentRequest || paymentRequest.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This payment request is no longer pending.' });
    }
    const normalizedTransactionId = transactionId.toLowerCase();
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mobile-money-transaction:${normalizedTransactionId}`]);
    const duplicate = await client.query(
      `SELECT id FROM public.public_payment_requests
       WHERE lower(transaction_id) = $1 AND id <> $2
       UNION ALL
       SELECT id FROM public.cashier_queue
       WHERE lower(transaction_id) = $1 AND status = 'Confirmed' AND id <> $3
       UNION ALL
       SELECT id FROM public.orders
       WHERE lower(transaction_id) = $1
       UNION ALL
       SELECT id FROM public.credit_settlements
       WHERE lower(transaction_id) = $1
       LIMIT 1`,
      [normalizedTransactionId, paymentRequest.id, queueId]
    );
    if (duplicate.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That transaction ID has already been used.' });
    }

    const items = Array.isArray(paymentRequest.items)
      ? paymentRequest.items
      : JSON.parse(paymentRequest.items || '[]');
    const paymentMethod = paymentRequest.payment_provider === 'MTN' ? 'Momo-MTN' : 'Momo-Airtel';
    const paidAt = new Date();
    const paidItems = markPublicOrderItemsPaid(items, paymentMethod, paidAt);
    if (!paymentRequest.order_id) {
      let stationItems;
      try {
        stationItems = groupPublicOrderItemsByStation(paidItems);
      } catch (error) {
        await client.query('ROLLBACK');
        return res.status(error.statusCode || 400).json({ error: error.message });
      }
      if (!Object.values(stationItems).some((stationOrderItems) => stationOrderItems.length)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This website order has no items to send to a station.' });
      }

      const deliveryAddress = `${paymentRequest.city}, ${paymentRequest.location_desc}`.trim();
      const orderResult = await client.query(
        `INSERT INTO public.orders
           (table_name, staff_name, items, total, status, payment_method, is_paid,
            payment_confirmed, paid_at, transaction_id, public_order_ref, client_name,
            client_phone, order_type, delivery_address, delivery_note, timestamp,
            created_at, updated_at, date, business_date)
         VALUES ('PUBLIC-WEB', 'Public Website', $1::jsonb, $2, 'Pending', $3, true,
                 true, $4, $5, $6, $7, $8, $9, $10, $11, $4, NOW(), NOW(), $12::date, $12::date)
         RETURNING id`,
        [
          JSON.stringify(paidItems),
          paymentRequest.total,
          paymentMethod,
          paidAt,
          transactionId,
          paymentRequest.public_order_ref,
          paymentRequest.customer_name,
          paymentRequest.mobile_money_number,
          paymentRequest.delivery_type === 'Home' ? 'Online Delivery' : 'Online Pickup',
          deliveryAddress,
          paymentRequest.location_desc,
          req.businessDate,
        ]
      );
      committedOrderId = orderResult.rows[0].id;

    } else {
      const orderResult = await client.query(
        `UPDATE public.orders
         SET items = $1::jsonb, total = $2, payment_method = $3, is_paid = true,
             payment_confirmed = true, paid_at = $4, transaction_id = $5,
             timestamp = $4, updated_at = $4
         WHERE id = $6 AND public_order_ref = $7 AND payment_confirmed = false
         RETURNING id`,
        [
          JSON.stringify(paidItems),
          paymentRequest.total,
          paymentMethod,
          paidAt,
          transactionId,
          paymentRequest.order_id,
          paymentRequest.public_order_ref,
        ]
      );
      if (!orderResult.rows.length) {
        throw Object.assign(new Error('The prepared website order could not be finalized.'), { statusCode: 409 });
      }
      committedOrderId = orderResult.rows[0].id;
    }
    await syncRoutableStationTicketsForAllStations(client);
    committedItems = paidItems;

    await client.query(
      `UPDATE public.cashier_queue
       SET status = 'Confirmed', confirmed_by = $1, confirmed_at = NOW(),
           transaction_id = $2, updated_at = NOW(), business_date = $3::date
       WHERE id = $4`,
      [req.cashier.name, transactionId, req.businessDate, queueId]
    );
    await client.query(
      `UPDATE public.public_payment_requests
       SET status = 'Confirmed', transaction_id = $1, confirmed_by = $2,
           confirmed_at = NOW(), order_id = $3, preparation_status = 'Preparing',
           updated_at = NOW()
       WHERE id = $4`,
      [transactionId, req.cashier.name, committedOrderId, paymentRequest.id]
    );

    await createSalesJournalEntry({
      amount: paymentRequest.total,
      paymentMethod,
      revenueBreakdown: buildSalesRevenueBreakdown(paidItems, paymentRequest.total),
      description: `Public website order ${paymentRequest.public_order_ref}`,
      sourceTransaction: `public_payment_request:${paymentRequest.id}`,
      postedBy: req.cashier.name,
      entryDate: req.businessDate,
      queryable: client,
    });

    await client.query(
      `INSERT INTO public.daily_summary
         (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel,
          total_credit, total_mixed, total_settled_credits, order_count, updated_at)
       VALUES ($4::date, $1, 0, 0, $2, $3,
               0, 0, 0, 1, NOW())
       ON CONFLICT (summary_date) DO UPDATE SET
         total_gross = public.daily_summary.total_gross + EXCLUDED.total_gross,
         total_mtn = public.daily_summary.total_mtn + EXCLUDED.total_mtn,
         total_airtel = public.daily_summary.total_airtel + EXCLUDED.total_airtel,
         order_count = public.daily_summary.order_count + EXCLUDED.order_count,
         updated_at = NOW()`,
      [
        paymentRequest.total,
        paymentMethod === 'Momo-MTN' ? paymentRequest.total : 0,
        paymentMethod === 'Momo-Airtel' ? paymentRequest.total : 0,
        req.businessDate,
      ]
    );

    await client.query('COMMIT');
    transactionCommitted = true;
    client.release();
    clientReleased = true;
    for (const notification of buildStationOrderNotifications(
      committedOrderId,
      committedItems,
      paymentRequest.public_order_ref
    )) {
      try {
        const delivery = await notificationService.sendToRoles(notification.roles, notification.event);
        if (delivery.error || delivery.failed || delivery.noRecipients) {
          console.warn(`Public order ${notification.station} notification was not fully delivered for ${paymentRequest.public_order_ref}:`, delivery);
        }
      } catch (notificationError) {
        console.error(`Public order ${notification.station} notification failed for ${paymentRequest.public_order_ref}:`, notificationError.message);
      }
    }
    return res.json({
      success: true,
      orderId: committedOrderId,
      orderReference: paymentRequest.public_order_ref,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Public mobile money confirmation failed:', error.message);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Payment confirmation failed. No order was finalized.',
    });
  } finally {
    if (!clientReleased) client.release();
    if (transactionCommitted && committedOrderId && committedItems) {
      try {
        const consumption = await consumeSoldOrderItems({
          orderId: committedOrderId,
          items: committedItems,
          createdBy: req.cashier.name,
        });
        for (const entry of consumption.filter((record) => !['CONSUMED', 'CONSUMED_COST_REVIEW', 'ALREADY_CONSUMED'].includes(record.status))) {
          console.warn(`Recipe consumption ${entry.status} for public order #${committedOrderId}: ${entry.order_item}`);
        }
      } catch (error) {
        console.error(`Recipe consumption failed for public order #${committedOrderId}:`, error.message);
      }
    }
  }
});

router.patch('/payment-requests/:id/reject', requireCashier, async (req, res) => {
  const queueId = Number(req.params.id);
  const reason = String(req.body?.reason || 'Rejected by cashier').trim().slice(0, 500);
  if (!Number.isInteger(queueId) || queueId <= 0) {
    return res.status(400).json({ error: 'Invalid cashier queue item.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const queueResult = await client.query(
      `SELECT * FROM public.cashier_queue WHERE id = $1 FOR UPDATE`,
      [queueId]
    );
    const queue = queueResult.rows[0];
    if (!queue?.public_order_ref) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Public payment request not found.' });
    }
    if (queue.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `This request is already ${String(queue.status).toLowerCase()}.` });
    }

    await client.query(
      `UPDATE public.cashier_queue
       SET status = 'Rejected', reject_reason = $1, rejected_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [reason, queueId]
    );
    await client.query(
      `UPDATE public.public_payment_requests
       SET status = 'Rejected', reject_reason = $1, rejected_by = $2,
           rejected_at = NOW(), updated_at = NOW()
       WHERE cashier_queue_id = $3 AND status = 'Pending'`,
      [reason, req.cashier.name, queueId]
    );
    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Public payment rejection failed:', error.message);
    return res.status(500).json({ error: 'Unable to reject payment request.' });
  } finally {
    client.release();
  }
});

export default router;
