import test from "node:test";
import assert from "node:assert/strict";
import { isCompletedTodayTicket } from "./departmentTicketStatus.js";

test("counts a ticket completed before midnight in Kampala on that date", () => {
  assert.equal(isCompletedTodayTicket({
    status: "Ready",
    ticket_date: "2026-12-28",
    ready_at: "2026-12-28T20:30:00.000Z",
  }, "2026-12-28"), true);
});

test("does not count an older ready ticket surfaced with active station work", () => {
  assert.equal(isCompletedTodayTicket({
    status: "Ready",
    ticket_date: "2026-12-27",
    ready_at: "2026-12-27T18:00:00.000Z",
    updated_at: "2026-12-28T08:00:00.000Z",
  }, "2026-12-28"), false);
});

test("uses the Kampala date when completion falls across UTC midnight", () => {
  assert.equal(isCompletedTodayTicket({
    status: "Ready",
    ready_at: "2026-12-28T21:30:00.000Z",
  }, "2026-12-29"), true);
  assert.equal(isCompletedTodayTicket({
    status: "Ready",
    ready_at: "2026-12-28T21:30:00.000Z",
  }, "2026-12-28"), false);
});

test("uses updated_at for directly completed tickets without ready_at", () => {
  assert.equal(isCompletedTodayTicket({
    status: "Served",
    ticket_date: "2026-12-27",
    updated_at: "2026-12-28T08:00:00.000Z",
  }, "2026-12-28"), true);
});

test("does not count active tickets as completed", () => {
  assert.equal(isCompletedTodayTicket({
    status: "Preparing",
    ready_at: "2026-12-28T08:00:00.000Z",
  }, "2026-12-28"), false);
});
