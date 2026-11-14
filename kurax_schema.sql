--
-- PostgreSQL database dump
--

\restrict HY1ipLIs1lTyBm8omwjh7nLd6AXY9cxfHXtIFbCxJjCPVOeyHLdbx9av9fHbFbg

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: sync_credit_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_credit_balance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE credits
  SET
    balance     = amount - amount_paid,
    -- Also keep status in sync based on paid amount
    status      = CASE
                    WHEN amount_paid >= amount THEN 'FullySettled'
                    WHEN amount_paid > 0       THEN 'PartiallySettled'
                    ELSE status   -- leave Approved/Rejected as-is if no payments
                  END
  WHERE id = COALESCE(NEW.credit_id, OLD.credit_id);
  RETURN NEW;
END;
$$;


--
-- Name: update_credit_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_credit_balance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      UPDATE credits
      SET balance = amount - amount_paid
      WHERE id = NEW.id OR id = OLD.id;
      RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounting_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_audit_log (
    id integer NOT NULL,
    entity_type text NOT NULL,
    entity_id integer,
    action text NOT NULL,
    actor text,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: accounting_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounting_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounting_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounting_audit_log_id_seq OWNED BY public.accounting_audit_log.id;


--
-- Name: accounting_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_periods (
    id integer NOT NULL,
    period_name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'Open'::text NOT NULL,
    created_by text DEFAULT 'System'::text,
    closed_by text,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accounting_periods_status_check CHECK ((status = ANY (ARRAY['Open'::text, 'Closed'::text])))
);


--
-- Name: accounting_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounting_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounting_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounting_periods_id_seq OWNED BY public.accounting_periods.id;


--
-- Name: accounts_payable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_payable (
    id integer NOT NULL,
    reference text NOT NULL,
    supplier_name text,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    outstanding_balance numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'Unpaid'::text NOT NULL,
    due_date date,
    payment_method text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accounts_payable_status_check CHECK ((status = ANY (ARRAY['Unpaid'::text, 'Partially Paid'::text, 'Fully Paid'::text])))
);


--
-- Name: accounts_payable_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_payable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_payable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_payable_id_seq OWNED BY public.accounts_payable.id;


--
-- Name: accounts_receivable; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts_receivable (
    id integer NOT NULL,
    reference text NOT NULL,
    customer_name text,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    outstanding_balance numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'Outstanding'::text NOT NULL,
    payment_method text,
    settlement_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accounts_receivable_status_check CHECK ((status = ANY (ARRAY['Outstanding'::text, 'Partially Paid'::text, 'Fully Settled'::text])))
);


--
-- Name: accounts_receivable_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_receivable_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_receivable_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_receivable_id_seq OWNED BY public.accounts_receivable.id;


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    type text,
    actor text,
    role text,
    message text,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    action_text text
);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: barista_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barista_assignments (
    id integer NOT NULL,
    order_id integer,
    ticket_id integer,
    item_name text NOT NULL,
    assigned_to text NOT NULL,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT now()
);


--
-- Name: barista_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.barista_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: barista_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.barista_assignments_id_seq OWNED BY public.barista_assignments.id;


--
-- Name: barista_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barista_tickets (
    id integer NOT NULL,
    order_id integer,
    table_name text,
    staff_name text,
    staff_role text,
    items jsonb DEFAULT '[]'::jsonb,
    total numeric DEFAULT 0,
    status text DEFAULT 'Pending'::text,
    ticket_date date DEFAULT CURRENT_DATE,
    ready_at timestamp with time zone,
    cleared_by_kitchen boolean DEFAULT false,
    cleared_by text,
    cleared_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cleared_by_barista character varying(100),
    cleared_at_barista timestamp without time zone
);


--
-- Name: barista_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.barista_tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: barista_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.barista_tickets_id_seq OWNED BY public.barista_tickets.id;


--
-- Name: barman_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barman_assignments (
    id integer NOT NULL,
    order_id integer,
    ticket_id integer,
    item_name text NOT NULL,
    assigned_to text NOT NULL,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT now()
);


--
-- Name: barman_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.barman_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: barman_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.barman_assignments_id_seq OWNED BY public.barman_assignments.id;


--
-- Name: barman_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barman_tickets (
    id integer NOT NULL,
    order_id integer,
    table_name text,
    staff_name text,
    staff_role text,
    items jsonb DEFAULT '[]'::jsonb,
    total numeric DEFAULT 0,
    status text DEFAULT 'Pending'::text,
    ticket_date date DEFAULT CURRENT_DATE,
    ready_at timestamp with time zone,
    cleared_by_kitchen boolean DEFAULT false,
    cleared_by text,
    cleared_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cleared_by_barman character varying(100),
    cleared_at_barman timestamp without time zone
);


--
-- Name: barman_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.barman_tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: barman_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.barman_tickets_id_seq OWNED BY public.barman_tickets.id;


--
-- Name: business_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_targets (
    month_key character varying(7) NOT NULL,
    revenue_goal numeric DEFAULT 0,
    waiter_quota integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: cashier_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cashier_queue (
    id integer NOT NULL,
    order_ids jsonb,
    table_name text,
    label text,
    amount numeric DEFAULT 0 NOT NULL,
    method text DEFAULT 'Cash'::text NOT NULL,
    status text DEFAULT 'Pending'::text,
    requested_by text,
    staff_id integer,
    confirmed_by text,
    confirmed_at timestamp with time zone,
    rejected_at timestamp with time zone,
    reject_reason text,
    transaction_id text,
    is_item boolean DEFAULT false,
    item jsonb,
    credit_name text,
    credit_phone text,
    credit_pay_by text,
    order_type text DEFAULT 'dine-in'::text,
    rider_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    shift_cleared boolean DEFAULT false,
    item_name text DEFAULT 'Full Table'::text,
    items jsonb DEFAULT '[]'::jsonb,
    settlement_status text DEFAULT 'Pending'::text NOT NULL,
    public_order_ref text
);


--
-- Name: cashier_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cashier_queue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cashier_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cashier_queue_id_seq OWNED BY public.cashier_queue.id;


--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_of_accounts (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    account_type text NOT NULL,
    normal_balance text NOT NULL,
    is_active boolean DEFAULT true,
    parent_code text,
    description text,
    created_by text DEFAULT 'System'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chart_of_accounts_category_check CHECK ((category = ANY (ARRAY['Asset'::text, 'Liability'::text, 'Equity'::text, 'Revenue'::text, 'Expense'::text]))),
    CONSTRAINT chart_of_accounts_normal_balance_check CHECK ((normal_balance = ANY (ARRAY['Debit'::text, 'Credit'::text])))
);


--
-- Name: chart_of_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chart_of_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chart_of_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chart_of_accounts_id_seq OWNED BY public.chart_of_accounts.id;


--
-- Name: chef_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chef_assignments (
    id integer NOT NULL,
    order_id integer,
    ticket_id integer,
    item_name text NOT NULL,
    assigned_to text NOT NULL,
    assigned_by text,
    assigned_at timestamp with time zone DEFAULT now()
);


--
-- Name: chef_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chef_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chef_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chef_assignments_id_seq OWNED BY public.chef_assignments.id;


--
-- Name: combo_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combo_items (
    id integer NOT NULL,
    combo_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    quantity numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT combo_items_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: combo_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.combo_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: combo_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.combo_items_id_seq OWNED BY public.combo_items.id;


--
-- Name: combos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combos (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    category text DEFAULT 'Starters'::text NOT NULL,
    station text DEFAULT 'Kitchen'::text NOT NULL,
    image_url text,
    is_available boolean DEFAULT true NOT NULL,
    published boolean DEFAULT false NOT NULL,
    customer_visible boolean DEFAULT true NOT NULL,
    regular_total numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_percentage numeric(12,2) DEFAULT 0 NOT NULL,
    total_cost numeric(12,2) DEFAULT 0 NOT NULL,
    gross_profit numeric(12,2) DEFAULT 0 NOT NULL,
    margin_percentage numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    website_published boolean DEFAULT false NOT NULL,
    website_extra_fee numeric(12,2) DEFAULT 0 NOT NULL
);


--
-- Name: combos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.combos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: combos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.combos_id_seq OWNED BY public.combos.id;


--
-- Name: complimentary_correction_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.complimentary_correction_requests (
    id integer NOT NULL,
    order_id integer NOT NULL,
    order_item_index integer NOT NULL,
    requested_complimentary boolean NOT NULL,
    requested_waived_amount numeric(12,2) NOT NULL,
    reason text,
    previous_item jsonb NOT NULL,
    requested_by integer NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    review_note text,
    applied_at timestamp with time zone,
    CONSTRAINT complimentary_correction_requests_order_item_index_check CHECK ((order_item_index >= 0)),
    CONSTRAINT complimentary_correction_requests_requested_waived_amount_check CHECK ((requested_waived_amount >= (0)::numeric)),
    CONSTRAINT complimentary_correction_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])))
);


--
-- Name: complimentary_correction_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.complimentary_correction_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: complimentary_correction_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.complimentary_correction_requests_id_seq OWNED BY public.complimentary_correction_requests.id;


--
-- Name: credit_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_settlements (
    id integer NOT NULL,
    credit_id integer NOT NULL,
    amount_paid numeric(12,2) NOT NULL,
    method text NOT NULL,
    transaction_id text,
    notes text,
    settled_by text DEFAULT 'Cashier'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_settlements_amount_paid_check CHECK ((amount_paid > (0)::numeric)),
    CONSTRAINT credit_settlements_method_check CHECK ((method = ANY (ARRAY['Cash'::text, 'Card'::text, 'Momo-MTN'::text, 'Momo-Airtel'::text])))
);


--
-- Name: credit_settlements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_settlements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_settlements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_settlements_id_seq OWNED BY public.credit_settlements.id;


--
-- Name: credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credits (
    id integer NOT NULL,
    order_id integer,
    cashier_queue_id integer,
    table_name text,
    client_name text,
    client_phone text,
    pay_by text,
    amount numeric DEFAULT 0 NOT NULL,
    amount_paid numeric DEFAULT 0,
    approved_by text,
    requested_by text,
    waiter_name text,
    paid boolean DEFAULT false,
    paid_at timestamp with time zone,
    settled boolean DEFAULT false,
    settle_method text,
    settle_txn text,
    settle_notes text,
    settled_by text,
    status character varying(50) DEFAULT 'outstanding'::text,
    label text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    forwarded_by text,
    rejected_by text,
    balance numeric(12,2),
    forwarded_at timestamp without time zone,
    approved_at timestamp without time zone,
    settled_at timestamp without time zone,
    reject_reason text,
    rejected_at timestamp with time zone
);


--
-- Name: credits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credits_id_seq OWNED BY public.credits.id;


--
-- Name: daily_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_reconciliations (
    id integer NOT NULL,
    recon_date date NOT NULL,
    system_cash numeric DEFAULT 0,
    system_mtn numeric DEFAULT 0,
    system_airtel numeric DEFAULT 0,
    system_card numeric DEFAULT 0,
    physical_cash numeric DEFAULT 0,
    physical_mtn numeric DEFAULT 0,
    physical_airtel numeric DEFAULT 0,
    physical_card numeric DEFAULT 0,
    variance numeric DEFAULT 0,
    notes text,
    reconciled_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: daily_reconciliations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_reconciliations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_reconciliations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_reconciliations_id_seq OWNED BY public.daily_reconciliations.id;


--
-- Name: daily_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_summaries (
    id integer NOT NULL,
    summary_date date NOT NULL,
    total_gross numeric DEFAULT 0,
    total_cash numeric DEFAULT 0,
    total_card numeric DEFAULT 0,
    total_mtn numeric DEFAULT 0,
    total_airtel numeric DEFAULT 0,
    total_credit numeric DEFAULT 0,
    total_mixed numeric DEFAULT 0,
    order_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: daily_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_summaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_summaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_summaries_id_seq OWNED BY public.daily_summaries.id;


--
-- Name: daily_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_summary (
    id integer NOT NULL,
    summary_date date NOT NULL,
    total_gross numeric DEFAULT 0,
    total_cash numeric DEFAULT 0,
    total_card numeric DEFAULT 0,
    total_mtn numeric DEFAULT 0,
    total_airtel numeric DEFAULT 0,
    total_credit numeric DEFAULT 0,
    total_mixed numeric DEFAULT 0,
    order_count integer DEFAULT 0,
    day_closed boolean DEFAULT false,
    closed_by text,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    total_settled_credits numeric DEFAULT 0
);


--
-- Name: daily_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_summary_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_summary_id_seq OWNED BY public.daily_summary.id;


--
-- Name: day_closings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_closings (
    id integer NOT NULL,
    closing_date date NOT NULL,
    recorded_by text NOT NULL,
    gross numeric DEFAULT 0,
    cash numeric DEFAULT 0,
    mtn numeric DEFAULT 0,
    airtel numeric DEFAULT 0,
    card numeric DEFAULT 0,
    credit numeric DEFAULT 0,
    order_count integer DEFAULT 0,
    closed_at timestamp with time zone DEFAULT now(),
    final_cash numeric DEFAULT 0,
    final_card numeric DEFAULT 0,
    final_mtn numeric DEFAULT 0,
    final_airtel numeric DEFAULT 0,
    final_gross numeric DEFAULT 0,
    notes text
);


--
-- Name: day_closings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.day_closings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: day_closings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.day_closings_id_seq OWNED BY public.day_closings.id;


--
-- Name: delivery_riders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_riders (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    status text DEFAULT 'available'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    active boolean DEFAULT true
);


--
-- Name: delivery_riders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.delivery_riders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: delivery_riders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.delivery_riders_id_seq OWNED BY public.delivery_riders.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    event_date date,
    event_time text,
    image_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    published boolean DEFAULT true,
    date date DEFAULT CURRENT_DATE,
    location character varying(255),
    status character varying(50) DEFAULT 'live'::character varying,
    "time" time without time zone,
    tags text[] DEFAULT '{}'::text[]
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: general_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.general_ledger (
    id integer NOT NULL,
    journal_entry_id integer NOT NULL,
    account_code text NOT NULL,
    account_name text NOT NULL,
    debit numeric(12,2) DEFAULT 0,
    credit numeric(12,2) DEFAULT 0,
    entry_date date NOT NULL,
    description text,
    source_transaction text,
    posted_by text,
    created_at timestamp with time zone DEFAULT now(),
    business_time time without time zone
);


--
-- Name: general_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.general_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: general_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.general_ledger_id_seq OWNED BY public.general_ledger.id;


--
-- Name: inventory_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustments (
    id integer NOT NULL,
    item_id integer,
    location_id integer,
    adjustment_type text NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    reason text,
    business_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_adjustments_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['ADJUSTMENT_IN'::text, 'ADJUSTMENT_OUT'::text])))
);


--
-- Name: inventory_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_adjustments_id_seq OWNED BY public.inventory_adjustments.id;


--
-- Name: inventory_consumptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_consumptions (
    id integer NOT NULL,
    order_id integer,
    order_item_id text,
    recipe_id integer,
    recipe_version text,
    item_id integer,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'g'::text NOT NULL,
    station text,
    business_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by text,
    reference_number text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_consumptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_consumptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_consumptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_consumptions_id_seq OWNED BY public.inventory_consumptions.id;


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id integer NOT NULL,
    item_name text NOT NULL,
    sku text,
    category text,
    unit text DEFAULT 'kg'::text NOT NULL,
    base_unit text DEFAULT 'g'::text NOT NULL,
    minimum_stock_level numeric(12,3) DEFAULT 0 NOT NULL,
    current_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    inventory_value numeric(12,2) DEFAULT 0 NOT NULL,
    supplier_id integer,
    location_id integer,
    station text,
    is_active boolean DEFAULT true NOT NULL,
    created_by text,
    updated_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_unit text,
    purchase_conversion_factor numeric(12,6) DEFAULT 1 NOT NULL
);


--
-- Name: inventory_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_items_id_seq OWNED BY public.inventory_items.id;


--
-- Name: inventory_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_locations (
    id integer NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'STORE'::text NOT NULL,
    parent_id integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_locations_id_seq OWNED BY public.inventory_locations.id;


--
-- Name: inventory_recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_recipes (
    id integer NOT NULL,
    menu_item_id integer,
    menu_name text NOT NULL,
    station text NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    created_by text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text,
    CONSTRAINT inventory_recipes_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text, 'APPROVED'::text, 'ACTIVE'::text, 'INACTIVE'::text])))
);


--
-- Name: inventory_recipes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_recipes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_recipes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_recipes_id_seq OWNED BY public.inventory_recipes.id;


--
-- Name: inventory_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_snapshots (
    id integer NOT NULL,
    snapshot_date date NOT NULL,
    total_value numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    created_by text DEFAULT 'Accountant'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_snapshots_id_seq OWNED BY public.inventory_snapshots.id;


--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transactions (
    id integer NOT NULL,
    item_id integer,
    reference_number text,
    transaction_type text NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_value numeric(12,2) DEFAULT 0 NOT NULL,
    source_location_id integer,
    destination_location_id integer,
    station text,
    order_id integer,
    recipe_id integer,
    recipe_version text,
    supplier_id integer,
    business_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['PURCHASE'::text, 'CONSUMPTION'::text, 'TRANSFER_IN'::text, 'TRANSFER_OUT'::text, 'WASTE'::text, 'ADJUSTMENT_IN'::text, 'ADJUSTMENT_OUT'::text, 'RETURN_TO_SUPPLIER'::text, 'STOCK_COUNT'::text, 'REVERSAL'::text])))
);


--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_transactions_id_seq OWNED BY public.inventory_transactions.id;


--
-- Name: inventory_transfer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transfer_items (
    id integer NOT NULL,
    transfer_id integer,
    item_id integer,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_transfer_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_transfer_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_transfer_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_transfer_items_id_seq OWNED BY public.inventory_transfer_items.id;


--
-- Name: inventory_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_transfers (
    id integer NOT NULL,
    reference_number text NOT NULL,
    source_location_id integer,
    destination_location_id integer,
    status text DEFAULT 'PENDING'::text NOT NULL,
    notes text,
    business_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_transfers_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'COMPLETED'::text, 'REVERSED'::text])))
);


--
-- Name: inventory_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_transfers_id_seq OWNED BY public.inventory_transfers.id;


--
-- Name: inventory_waste; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_waste (
    id integer NOT NULL,
    item_id integer,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'kg'::text NOT NULL,
    station text,
    reason text,
    business_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by text,
    approved_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_waste_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_waste_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_waste_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_waste_id_seq OWNED BY public.inventory_waste.id;


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id integer NOT NULL,
    reference text NOT NULL,
    entry_date date NOT NULL,
    description text NOT NULL,
    source_transaction text,
    posted_by text DEFAULT 'System'::text NOT NULL,
    approved_by text,
    approved_at timestamp with time zone,
    status text DEFAULT 'Posted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    reversal_of integer,
    reversal_reason text,
    business_time time without time zone,
    posted_at timestamp with time zone DEFAULT now() NOT NULL,
    system_type text DEFAULT 'MAIN'::text NOT NULL,
    transaction_type text,
    transaction_amount numeric(12,2),
    selected_account_code text,
    counterpart_account_code text,
    classification text,
    reference_number text,
    transaction_request_id text,
    transaction_payload_hash text,
    posted_by_id text,
    CONSTRAINT journal_entries_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Posted'::text, 'Reversed'::text, 'Voided'::text]))),
    CONSTRAINT journal_entries_system_type_check CHECK ((system_type = ANY (ARRAY['MAIN'::text, 'SHISHA'::text])))
);


--
-- Name: journal_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.journal_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: journal_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.journal_entries_id_seq OWNED BY public.journal_entries.id;


--
-- Name: kitchen_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kitchen_tickets (
    id integer NOT NULL,
    order_id integer,
    table_name text,
    staff_name text,
    staff_role text,
    items jsonb DEFAULT '[]'::jsonb,
    total numeric DEFAULT 0,
    status text DEFAULT 'Pending'::text,
    ticket_date date DEFAULT CURRENT_DATE,
    ready_at timestamp with time zone,
    cleared_by_kitchen boolean DEFAULT false,
    cleared_by text,
    cleared_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cleared_at_kitchen timestamp without time zone
);


--
-- Name: kitchen_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kitchen_tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kitchen_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kitchen_tickets_id_seq OWNED BY public.kitchen_tickets.id;


--
-- Name: menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menus (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    price numeric DEFAULT 0 NOT NULL,
    category text,
    station text,
    image_url text,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    published boolean DEFAULT true,
    available boolean DEFAULT true,
    customer_visible boolean DEFAULT false,
    is_active boolean DEFAULT true,
    website_published boolean DEFAULT false NOT NULL,
    website_extra_fee numeric(12,2) DEFAULT 0 NOT NULL,
    promotion_enabled boolean DEFAULT false NOT NULL,
    promotion_discount_type text DEFAULT 'percentage'::text NOT NULL,
    promotion_discount_value numeric(12,2) DEFAULT 0 NOT NULL,
    promotion_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    promotion_starts_at timestamp with time zone,
    promotion_ends_at timestamp with time zone
);


--
-- Name: menus_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menus_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menus_id_seq OWNED BY public.menus.id;


--
-- Name: monthly_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_expenses (
    id integer NOT NULL,
    month text NOT NULL,
    category text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    description text,
    entered_by text,
    updated_at timestamp with time zone DEFAULT now(),
    payment_method text DEFAULT 'Cash'::text NOT NULL
);


--
-- Name: monthly_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_expenses_id_seq OWNED BY public.monthly_expenses.id;


--
-- Name: monthly_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_targets (
    id integer NOT NULL,
    month text NOT NULL,
    revenue numeric DEFAULT 0,
    order_count integer DEFAULT 0,
    set_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: monthly_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_targets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_targets_id_seq OWNED BY public.monthly_targets.id;


--
-- Name: notification_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_devices (
    id integer NOT NULL,
    user_scope text NOT NULL,
    user_id integer NOT NULL,
    firebase_installation_id text NOT NULL,
    fcm_token text NOT NULL,
    platform text NOT NULL,
    user_agent text,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    installation_id text,
    browser text DEFAULT 'unknown'::text,
    is_pwa boolean DEFAULT false NOT NULL,
    permission_status text DEFAULT 'default'::text NOT NULL,
    notifications_enabled boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT notification_devices_platform_check CHECK ((platform = ANY (ARRAY['web'::text, 'android'::text, 'ios'::text]))),
    CONSTRAINT notification_devices_user_scope_check CHECK ((user_scope = ANY (ARRAY['restaurant'::text, 'shisha'::text])))
);


--
-- Name: notification_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_devices_id_seq OWNED BY public.notification_devices.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    table_name text,
    staff_name text,
    staff_id integer,
    staff_role text,
    items jsonb DEFAULT '[]'::jsonb,
    total numeric DEFAULT 0,
    status text DEFAULT 'Pending'::text,
    payment_method text DEFAULT 'Cash'::text,
    is_paid boolean DEFAULT false,
    sent_to_cashier boolean DEFAULT false,
    shift_cleared boolean DEFAULT false,
    day_cleared boolean DEFAULT false,
    void_reason text,
    "timestamp" timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    rider_id integer,
    rider_name text,
    rider_phone text,
    delivery_status text DEFAULT 'Pending'::text,
    order_type text DEFAULT 'Dine-in'::text,
    client_name text,
    client_phone text,
    delivery_address text,
    delivery_note text,
    dispatched_at timestamp with time zone,
    delivered_at timestamp with time zone,
    is_archived boolean DEFAULT false,
    is_permitted boolean DEFAULT false,
    date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp with time zone,
    transaction_id text,
    payment_confirmed boolean DEFAULT false,
    credit_approved boolean DEFAULT false,
    original_order_ids jsonb DEFAULT '[]'::jsonb,
    public_order_ref text,
    special_bill_discount_amount numeric(12,2) DEFAULT 0 NOT NULL
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: petty_cash; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.petty_cash (
    id integer NOT NULL,
    entry_date date NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    direction text DEFAULT 'OUT'::text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    description text NOT NULL,
    logged_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: petty_cash_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.petty_cash_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: petty_cash_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.petty_cash_id_seq OWNED BY public.petty_cash.id;


--
-- Name: petty_cash_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.petty_cash_transactions (
    id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    type character varying(20) DEFAULT 'expense'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    created_by character varying(100)
);


--
-- Name: petty_cash_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.petty_cash_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: petty_cash_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.petty_cash_transactions_id_seq OWNED BY public.petty_cash_transactions.id;


--
-- Name: physical_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.physical_counts (
    id integer NOT NULL,
    count_date date,
    cash numeric DEFAULT 0,
    momo_mtn numeric DEFAULT 0,
    momo_airtel numeric DEFAULT 0,
    card numeric DEFAULT 0,
    notes text,
    submitted_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    mtn numeric DEFAULT 0,
    airtel numeric DEFAULT 0,
    credit_settled_today numeric DEFAULT 0,
    credit_outstanding_today numeric DEFAULT 0,
    saved boolean DEFAULT false
);


--
-- Name: physical_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.physical_counts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: physical_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.physical_counts_id_seq OWNED BY public.physical_counts.id;


--
-- Name: public_payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_payment_requests (
    id integer NOT NULL,
    cashier_queue_id integer NOT NULL,
    public_order_ref text NOT NULL,
    request_key text,
    status text DEFAULT 'Pending'::text NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    mobile_money_number text NOT NULL,
    payment_provider text NOT NULL,
    delivery_type text NOT NULL,
    city text NOT NULL,
    location_desc text DEFAULT ''::text NOT NULL,
    items jsonb NOT NULL,
    total numeric(12,2) NOT NULL,
    order_id integer,
    transaction_id text,
    confirmed_by text,
    confirmed_at timestamp with time zone,
    rejected_by text,
    rejected_at timestamp with time zone,
    reject_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    preparation_status text DEFAULT 'NotSent'::text NOT NULL,
    CONSTRAINT public_payment_requests_delivery_type_check CHECK ((delivery_type = ANY (ARRAY['Home'::text, 'Store'::text]))),
    CONSTRAINT public_payment_requests_payment_provider_check CHECK ((payment_provider = ANY (ARRAY['MTN'::text, 'AIRTEL'::text]))),
    CONSTRAINT public_payment_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Confirmed'::text, 'Rejected'::text]))),
    CONSTRAINT public_payment_requests_total_check CHECK ((total > (0)::numeric))
);


--
-- Name: public_payment_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.public_payment_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: public_payment_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.public_payment_requests_id_seq OWNED BY public.public_payment_requests.id;


--
-- Name: purchase_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_receipt_items (
    id integer NOT NULL,
    purchase_id integer,
    item_id integer,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'kg'::text,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_cost numeric(12,2) DEFAULT 0 NOT NULL,
    location_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    normalized_stock_quantity numeric(12,3),
    conversion_factor numeric(12,6),
    transaction_reference text
);


--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_receipt_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_receipt_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_receipt_items_id_seq OWNED BY public.purchase_receipt_items.id;


--
-- Name: purchase_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_receipts (
    id integer NOT NULL,
    supplier_id integer,
    receipt_number text,
    payment_method text DEFAULT 'Cash'::text,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    business_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL
);


--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_receipts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_receipts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_receipts_id_seq OWNED BY public.purchase_receipts.id;


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id integer NOT NULL,
    purchase_date date NOT NULL,
    supplier text,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    invoice_number text,
    notes text,
    created_by text DEFAULT 'Accountant'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchases_id_seq OWNED BY public.purchases.id;


--
-- Name: recipe_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_ingredients (
    id integer NOT NULL,
    recipe_id integer NOT NULL,
    ingredient_item_id integer,
    ingredient_name text NOT NULL,
    quantity numeric(12,3) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'g'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recipe_ingredients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recipe_ingredients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recipe_ingredients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recipe_ingredients_id_seq OWNED BY public.recipe_ingredients.id;


--
-- Name: restaurant_production_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_production_events (
    id bigint NOT NULL,
    work_id bigint NOT NULL,
    event_type text NOT NULL,
    from_staff_id integer,
    to_staff_id integer,
    actor_id integer,
    from_status text,
    to_status text,
    quantity numeric(12,2),
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: restaurant_production_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurant_production_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurant_production_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurant_production_events_id_seq OWNED BY public.restaurant_production_events.id;


--
-- Name: restaurant_production_pin_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_production_pin_attempts (
    identifier_hash text NOT NULL,
    failures integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: restaurant_production_work; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_production_work (
    id bigint NOT NULL,
    station text NOT NULL,
    order_id integer NOT NULL,
    ticket_id integer NOT NULL,
    item_index integer NOT NULL,
    item_name text NOT NULL,
    item_notes text,
    table_name text,
    order_created_at timestamp with time zone,
    quantity numeric(12,2) NOT NULL,
    completed_quantity numeric(12,2) DEFAULT 0 NOT NULL,
    staff_id integer,
    staff_name text,
    status text DEFAULT 'Unclaimed'::text NOT NULL,
    claimed_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ready_at timestamp with time zone,
    notification_status text DEFAULT 'Pending'::text NOT NULL,
    notified_at timestamp with time zone,
    item_price numeric(12,2),
    CONSTRAINT restaurant_production_work_completed_quantity_check CHECK ((completed_quantity >= (0)::numeric)),
    CONSTRAINT restaurant_production_work_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT restaurant_production_work_station_check CHECK ((station = ANY (ARRAY['kitchen'::text, 'bar'::text, 'barista'::text])))
);


--
-- Name: restaurant_production_work_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurant_production_work_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurant_production_work_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurant_production_work_id_seq OWNED BY public.restaurant_production_work.id;


--
-- Name: riders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.riders (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    status text DEFAULT 'Available'::text
);


--
-- Name: riders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.riders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: riders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.riders_id_seq OWNED BY public.riders.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    staff_id integer,
    staff_name text,
    role text,
    shift_date date DEFAULT CURRENT_DATE,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    total_orders integer DEFAULT 0,
    total_sales numeric DEFAULT 0
);


--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shifts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: shisha_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    shisha_package_id integer,
    package_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    CONSTRAINT shisha_order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT shisha_order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: shisha_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_order_items_id_seq OWNED BY public.shisha_order_items.id;


--
-- Name: shisha_order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_order_status_history (
    id integer NOT NULL,
    order_id integer NOT NULL,
    from_status text,
    to_status text NOT NULL,
    action text NOT NULL,
    actor_id integer NOT NULL,
    actor_name text NOT NULL,
    actor_role text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shisha_order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_order_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_order_status_history_id_seq OWNED BY public.shisha_order_status_history.id;


--
-- Name: shisha_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_orders (
    id integer NOT NULL,
    department text DEFAULT 'SHISHA'::text NOT NULL,
    shisha_waiter_id integer NOT NULL,
    table_id text NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    order_status text DEFAULT 'PENDING'::text NOT NULL,
    assigned_chef_id integer,
    payment_status text DEFAULT 'UNPAID'::text NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    outstanding_amount numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    day_cleared boolean DEFAULT false NOT NULL,
    CONSTRAINT shisha_orders_department_check CHECK ((department = 'SHISHA'::text))
);


--
-- Name: shisha_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_orders_id_seq OWNED BY public.shisha_orders.id;


--
-- Name: shisha_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_packages (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(12,2) NOT NULL,
    image_url text,
    is_available boolean DEFAULT true NOT NULL,
    published boolean DEFAULT false NOT NULL,
    visibility text DEFAULT 'INTERNAL'::text NOT NULL,
    public_visible boolean DEFAULT false NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shisha_packages_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT shisha_packages_public_visible_check CHECK ((public_visible = false)),
    CONSTRAINT shisha_packages_visibility_check CHECK ((visibility = 'INTERNAL'::text))
);


--
-- Name: shisha_packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_packages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_packages_id_seq OWNED BY public.shisha_packages.id;


--
-- Name: shisha_payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_payment_requests (
    id integer NOT NULL,
    order_id integer NOT NULL,
    requested_by integer NOT NULL,
    payment_method text NOT NULL,
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    transaction_id text,
    notes text,
    confirmed_by integer,
    confirmed_by_name text,
    confirmed_by_role text,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    client_name text,
    client_phone text,
    expected_payment_date date,
    CONSTRAINT shisha_payment_requests_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: shisha_payment_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_payment_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_payment_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_payment_requests_id_seq OWNED BY public.shisha_payment_requests.id;


--
-- Name: shisha_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_payments (
    id integer NOT NULL,
    order_id integer NOT NULL,
    payment_request_id integer,
    payment_method text NOT NULL,
    amount numeric(12,2) NOT NULL,
    transaction_id text,
    notes text,
    confirmed_by integer NOT NULL,
    confirmed_by_name text NOT NULL,
    confirmed_by_role text NOT NULL,
    payment_status text DEFAULT 'CONFIRMED'::text NOT NULL,
    confirmed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shisha_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: shisha_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_payments_id_seq OWNED BY public.shisha_payments.id;


--
-- Name: shisha_production_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_production_events (
    id bigint NOT NULL,
    work_id bigint NOT NULL,
    event_type text NOT NULL,
    from_staff_id integer,
    to_staff_id integer,
    actor_id integer,
    from_status text,
    to_status text,
    quantity numeric(12,2),
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shisha_production_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_production_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_production_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_production_events_id_seq OWNED BY public.shisha_production_events.id;


--
-- Name: shisha_production_pin_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_production_pin_attempts (
    staff_id integer NOT NULL,
    failures integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shisha_production_work; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_production_work (
    id bigint NOT NULL,
    order_id integer NOT NULL,
    order_item_id integer NOT NULL,
    item_name text NOT NULL,
    table_id text,
    order_notes text,
    unit_price numeric(12,2),
    order_created_at timestamp with time zone,
    quantity numeric(12,2) NOT NULL,
    completed_quantity numeric(12,2) DEFAULT 0 NOT NULL,
    staff_id integer,
    staff_name text,
    status text DEFAULT 'Unclaimed'::text NOT NULL,
    claimed_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ready_at timestamp with time zone,
    notification_status text DEFAULT 'Pending'::text NOT NULL,
    notified_at timestamp with time zone,
    CONSTRAINT shisha_production_work_completed_quantity_check CHECK ((completed_quantity >= (0)::numeric)),
    CONSTRAINT shisha_production_work_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: shisha_production_work_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_production_work_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_production_work_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_production_work_id_seq OWNED BY public.shisha_production_work.id;


--
-- Name: shisha_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_staff (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    pin_salt text NOT NULL,
    pin_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pin_encrypted text,
    CONSTRAINT shisha_staff_role_check CHECK ((role = ANY (ARRAY['SHISHA_HOD'::text, 'SHISHA_WAITER'::text, 'SHISHA_CHEF'::text])))
);


--
-- Name: shisha_staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_staff_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_staff_id_seq OWNED BY public.shisha_staff.id;


--
-- Name: shisha_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_tickets (
    id integer NOT NULL,
    order_id integer NOT NULL,
    table_name text,
    staff_name text,
    items jsonb DEFAULT '[]'::jsonb,
    total numeric DEFAULT 0,
    status text DEFAULT 'Pending'::text,
    ticket_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: shisha_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_tickets_id_seq OWNED BY public.shisha_tickets.id;


--
-- Name: shisha_void_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shisha_void_requests (
    id integer NOT NULL,
    order_id integer NOT NULL,
    order_item_id integer NOT NULL,
    requested_by integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    resolved_by integer,
    resolved_by_name text,
    resolved_by_role text,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT shisha_void_requests_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT shisha_void_requests_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT shisha_void_requests_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text]))),
    CONSTRAINT shisha_void_requests_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: shisha_void_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shisha_void_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shisha_void_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shisha_void_requests_id_seq OWNED BY public.shisha_void_requests.id;


--
-- Name: site_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_visits (
    id integer NOT NULL,
    page text,
    ip text,
    user_agent text,
    visited_at timestamp with time zone DEFAULT now()
);


--
-- Name: site_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_visits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: site_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_visits_id_seq OWNED BY public.site_visits.id;


--
-- Name: sms_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_log (
    id integer NOT NULL,
    recipient text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'sent'::text,
    provider text,
    sent_at timestamp with time zone DEFAULT now()
);


--
-- Name: sms_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sms_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sms_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sms_log_id_seq OWNED BY public.sms_log.id;


--
-- Name: special_bill_discount_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.special_bill_discount_audit (
    id integer NOT NULL,
    order_id integer NOT NULL,
    queue_id integer,
    discount_type text DEFAULT 'fixed'::text NOT NULL,
    discount_value numeric(12,2) DEFAULT 0 NOT NULL,
    original_bill_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    final_payable_amount numeric(12,2) DEFAULT 0 NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    applied_by integer,
    applied_by_name text DEFAULT ''::text NOT NULL,
    max_discount_type text DEFAULT 'percentage'::text NOT NULL,
    max_discount_value numeric(12,2) DEFAULT 0 NOT NULL,
    config_updated_by integer,
    config_updated_by_name text,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: special_bill_discount_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.special_bill_discount_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: special_bill_discount_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.special_bill_discount_audit_id_seq OWNED BY public.special_bill_discount_audit.id;


--
-- Name: special_discount_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.special_discount_settings (
    id smallint DEFAULT 1 NOT NULL,
    max_discount_type text DEFAULT 'percentage'::text NOT NULL,
    max_discount_value numeric(12,2) DEFAULT 0 NOT NULL,
    max_discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    updated_by integer,
    updated_by_name text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT special_discount_settings_id_check CHECK ((id = 1))
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id integer NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    role text DEFAULT 'WAITER'::text NOT NULL,
    password_hash text,
    is_active boolean DEFAULT true,
    is_permitted boolean DEFAULT false,
    daily_order_target integer DEFAULT 0,
    monthly_income_target numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pin text,
    is_requesting boolean DEFAULT false,
    pin_salt text,
    pin_hash text
);


--
-- Name: staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;


--
-- Name: staff_order_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_order_goals (
    id integer NOT NULL,
    staff_id integer,
    daily_order_target integer DEFAULT 0,
    monthly_income_target numeric DEFAULT 0,
    set_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: staff_order_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_order_goals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_order_goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_order_goals_id_seq OWNED BY public.staff_order_goals.id;


--
-- Name: staff_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_shifts (
    id integer NOT NULL,
    staff_id integer,
    staff_name text,
    role text,
    shift_date date DEFAULT CURRENT_DATE,
    total_cash numeric DEFAULT 0,
    total_mtn numeric DEFAULT 0,
    total_airtel numeric DEFAULT 0,
    total_card numeric DEFAULT 0,
    gross_total numeric DEFAULT 0,
    petty_cash_spent numeric DEFAULT 0,
    order_count integer DEFAULT 0,
    ended_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    total_orders integer DEFAULT 0,
    credit_approved_amt numeric DEFAULT 0,
    credit_approved integer DEFAULT 0,
    credit_rejected integer DEFAULT 0
);


--
-- Name: staff_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_shifts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_shifts_id_seq OWNED BY public.staff_shifts.id;


--
-- Name: stock_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_counts (
    id integer NOT NULL,
    item_id integer,
    location_id integer,
    system_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    physical_quantity numeric(12,3) DEFAULT 0 NOT NULL,
    variance numeric(12,3) DEFAULT 0 NOT NULL,
    reason text,
    business_date date DEFAULT CURRENT_DATE NOT NULL,
    counted_by text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_counts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_counts_id_seq OWNED BY public.stock_counts.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tables (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'Available'::character varying,
    last_order_id integer,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: tables_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tables_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tables_id_seq OWNED BY public.tables.id;


--
-- Name: void_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.void_requests (
    id integer NOT NULL,
    order_id integer,
    item_name text NOT NULL,
    reason text,
    table_name text,
    waiter_name text,
    requested_by text,
    status text DEFAULT 'Pending'::text,
    approved_by text,
    rejected_by text,
    resolved_by text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    chef_name text,
    original_price numeric(10,2),
    original_quantity integer,
    item_total numeric(10,2),
    assigned_chef text,
    station text DEFAULT 'kitchen'::text
);


--
-- Name: void_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.void_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: void_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.void_requests_id_seq OWNED BY public.void_requests.id;


--
-- Name: accounting_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_audit_log ALTER COLUMN id SET DEFAULT nextval('public.accounting_audit_log_id_seq'::regclass);


--
-- Name: accounting_periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_periods ALTER COLUMN id SET DEFAULT nextval('public.accounting_periods_id_seq'::regclass);


--
-- Name: accounts_payable id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_payable ALTER COLUMN id SET DEFAULT nextval('public.accounts_payable_id_seq'::regclass);


--
-- Name: accounts_receivable id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_receivable ALTER COLUMN id SET DEFAULT nextval('public.accounts_receivable_id_seq'::regclass);


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: barista_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barista_assignments ALTER COLUMN id SET DEFAULT nextval('public.barista_assignments_id_seq'::regclass);


--
-- Name: barista_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barista_tickets ALTER COLUMN id SET DEFAULT nextval('public.barista_tickets_id_seq'::regclass);


--
-- Name: barman_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barman_assignments ALTER COLUMN id SET DEFAULT nextval('public.barman_assignments_id_seq'::regclass);


--
-- Name: barman_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barman_tickets ALTER COLUMN id SET DEFAULT nextval('public.barman_tickets_id_seq'::regclass);


--
-- Name: cashier_queue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_queue ALTER COLUMN id SET DEFAULT nextval('public.cashier_queue_id_seq'::regclass);


--
-- Name: chart_of_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts ALTER COLUMN id SET DEFAULT nextval('public.chart_of_accounts_id_seq'::regclass);


--
-- Name: chef_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chef_assignments ALTER COLUMN id SET DEFAULT nextval('public.chef_assignments_id_seq'::regclass);


--
-- Name: combo_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_items ALTER COLUMN id SET DEFAULT nextval('public.combo_items_id_seq'::regclass);


--
-- Name: combos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos ALTER COLUMN id SET DEFAULT nextval('public.combos_id_seq'::regclass);


--
-- Name: complimentary_correction_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complimentary_correction_requests ALTER COLUMN id SET DEFAULT nextval('public.complimentary_correction_requests_id_seq'::regclass);


--
-- Name: credit_settlements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_settlements ALTER COLUMN id SET DEFAULT nextval('public.credit_settlements_id_seq'::regclass);


--
-- Name: credits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits ALTER COLUMN id SET DEFAULT nextval('public.credits_id_seq'::regclass);


--
-- Name: daily_reconciliations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_reconciliations ALTER COLUMN id SET DEFAULT nextval('public.daily_reconciliations_id_seq'::regclass);


--
-- Name: daily_summaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summaries ALTER COLUMN id SET DEFAULT nextval('public.daily_summaries_id_seq'::regclass);


--
-- Name: daily_summary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summary ALTER COLUMN id SET DEFAULT nextval('public.daily_summary_id_seq'::regclass);


--
-- Name: day_closings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_closings ALTER COLUMN id SET DEFAULT nextval('public.day_closings_id_seq'::regclass);


--
-- Name: delivery_riders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_riders ALTER COLUMN id SET DEFAULT nextval('public.delivery_riders_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: general_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_ledger ALTER COLUMN id SET DEFAULT nextval('public.general_ledger_id_seq'::regclass);


--
-- Name: inventory_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments ALTER COLUMN id SET DEFAULT nextval('public.inventory_adjustments_id_seq'::regclass);


--
-- Name: inventory_consumptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumptions ALTER COLUMN id SET DEFAULT nextval('public.inventory_consumptions_id_seq'::regclass);


--
-- Name: inventory_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_items_id_seq'::regclass);


--
-- Name: inventory_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations ALTER COLUMN id SET DEFAULT nextval('public.inventory_locations_id_seq'::regclass);


--
-- Name: inventory_recipes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_recipes ALTER COLUMN id SET DEFAULT nextval('public.inventory_recipes_id_seq'::regclass);


--
-- Name: inventory_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_snapshots ALTER COLUMN id SET DEFAULT nextval('public.inventory_snapshots_id_seq'::regclass);


--
-- Name: inventory_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions ALTER COLUMN id SET DEFAULT nextval('public.inventory_transactions_id_seq'::regclass);


--
-- Name: inventory_transfer_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_items ALTER COLUMN id SET DEFAULT nextval('public.inventory_transfer_items_id_seq'::regclass);


--
-- Name: inventory_transfers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers ALTER COLUMN id SET DEFAULT nextval('public.inventory_transfers_id_seq'::regclass);


--
-- Name: inventory_waste id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_waste ALTER COLUMN id SET DEFAULT nextval('public.inventory_waste_id_seq'::regclass);


--
-- Name: journal_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries ALTER COLUMN id SET DEFAULT nextval('public.journal_entries_id_seq'::regclass);


--
-- Name: kitchen_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_tickets ALTER COLUMN id SET DEFAULT nextval('public.kitchen_tickets_id_seq'::regclass);


--
-- Name: menus id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menus ALTER COLUMN id SET DEFAULT nextval('public.menus_id_seq'::regclass);


--
-- Name: monthly_expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_expenses ALTER COLUMN id SET DEFAULT nextval('public.monthly_expenses_id_seq'::regclass);


--
-- Name: monthly_targets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_targets ALTER COLUMN id SET DEFAULT nextval('public.monthly_targets_id_seq'::regclass);


--
-- Name: notification_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_devices ALTER COLUMN id SET DEFAULT nextval('public.notification_devices_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: petty_cash id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petty_cash ALTER COLUMN id SET DEFAULT nextval('public.petty_cash_id_seq'::regclass);


--
-- Name: petty_cash_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petty_cash_transactions ALTER COLUMN id SET DEFAULT nextval('public.petty_cash_transactions_id_seq'::regclass);


--
-- Name: physical_counts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_counts ALTER COLUMN id SET DEFAULT nextval('public.physical_counts_id_seq'::regclass);


--
-- Name: public_payment_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_payment_requests ALTER COLUMN id SET DEFAULT nextval('public.public_payment_requests_id_seq'::regclass);


--
-- Name: purchase_receipt_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_receipt_items_id_seq'::regclass);


--
-- Name: purchase_receipts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts ALTER COLUMN id SET DEFAULT nextval('public.purchase_receipts_id_seq'::regclass);


--
-- Name: purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases ALTER COLUMN id SET DEFAULT nextval('public.purchases_id_seq'::regclass);


--
-- Name: recipe_ingredients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients ALTER COLUMN id SET DEFAULT nextval('public.recipe_ingredients_id_seq'::regclass);


--
-- Name: restaurant_production_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_production_events ALTER COLUMN id SET DEFAULT nextval('public.restaurant_production_events_id_seq'::regclass);


--
-- Name: restaurant_production_work id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_production_work ALTER COLUMN id SET DEFAULT nextval('public.restaurant_production_work_id_seq'::regclass);


--
-- Name: riders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riders ALTER COLUMN id SET DEFAULT nextval('public.riders_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: shisha_order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_order_items ALTER COLUMN id SET DEFAULT nextval('public.shisha_order_items_id_seq'::regclass);


--
-- Name: shisha_order_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_order_status_history ALTER COLUMN id SET DEFAULT nextval('public.shisha_order_status_history_id_seq'::regclass);


--
-- Name: shisha_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_orders ALTER COLUMN id SET DEFAULT nextval('public.shisha_orders_id_seq'::regclass);


--
-- Name: shisha_packages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_packages ALTER COLUMN id SET DEFAULT nextval('public.shisha_packages_id_seq'::regclass);


--
-- Name: shisha_payment_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_payment_requests ALTER COLUMN id SET DEFAULT nextval('public.shisha_payment_requests_id_seq'::regclass);


--
-- Name: shisha_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_payments ALTER COLUMN id SET DEFAULT nextval('public.shisha_payments_id_seq'::regclass);


--
-- Name: shisha_production_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_production_events ALTER COLUMN id SET DEFAULT nextval('public.shisha_production_events_id_seq'::regclass);


--
-- Name: shisha_production_work id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_production_work ALTER COLUMN id SET DEFAULT nextval('public.shisha_production_work_id_seq'::regclass);


--
-- Name: shisha_staff id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_staff ALTER COLUMN id SET DEFAULT nextval('public.shisha_staff_id_seq'::regclass);


--
-- Name: shisha_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_tickets ALTER COLUMN id SET DEFAULT nextval('public.shisha_tickets_id_seq'::regclass);


--
-- Name: shisha_void_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_void_requests ALTER COLUMN id SET DEFAULT nextval('public.shisha_void_requests_id_seq'::regclass);


--
-- Name: site_visits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_visits ALTER COLUMN id SET DEFAULT nextval('public.site_visits_id_seq'::regclass);


--
-- Name: sms_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_log ALTER COLUMN id SET DEFAULT nextval('public.sms_log_id_seq'::regclass);


--
-- Name: special_bill_discount_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_bill_discount_audit ALTER COLUMN id SET DEFAULT nextval('public.special_bill_discount_audit_id_seq'::regclass);


--
-- Name: staff id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);


--
-- Name: staff_order_goals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_order_goals ALTER COLUMN id SET DEFAULT nextval('public.staff_order_goals_id_seq'::regclass);


--
-- Name: staff_shifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts ALTER COLUMN id SET DEFAULT nextval('public.staff_shifts_id_seq'::regclass);


--
-- Name: stock_counts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_counts ALTER COLUMN id SET DEFAULT nextval('public.stock_counts_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: tables id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables ALTER COLUMN id SET DEFAULT nextval('public.tables_id_seq'::regclass);


--
-- Name: void_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.void_requests ALTER COLUMN id SET DEFAULT nextval('public.void_requests_id_seq'::regclass);


--
-- Name: accounting_audit_log accounting_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_audit_log
    ADD CONSTRAINT accounting_audit_log_pkey PRIMARY KEY (id);


--
-- Name: accounting_periods accounting_periods_period_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_periods
    ADD CONSTRAINT accounting_periods_period_name_key UNIQUE (period_name);


--
-- Name: accounting_periods accounting_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_periods
    ADD CONSTRAINT accounting_periods_pkey PRIMARY KEY (id);


--
-- Name: accounts_payable accounts_payable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_payable
    ADD CONSTRAINT accounts_payable_pkey PRIMARY KEY (id);


--
-- Name: accounts_receivable accounts_receivable_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts_receivable
    ADD CONSTRAINT accounts_receivable_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: barista_assignments barista_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barista_assignments
    ADD CONSTRAINT barista_assignments_pkey PRIMARY KEY (id);


--
-- Name: barista_tickets barista_tickets_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barista_tickets
    ADD CONSTRAINT barista_tickets_order_id_key UNIQUE (order_id);


--
-- Name: barista_tickets barista_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barista_tickets
    ADD CONSTRAINT barista_tickets_pkey PRIMARY KEY (id);


--
-- Name: barman_assignments barman_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barman_assignments
    ADD CONSTRAINT barman_assignments_pkey PRIMARY KEY (id);


--
-- Name: barman_tickets barman_tickets_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barman_tickets
    ADD CONSTRAINT barman_tickets_order_id_key UNIQUE (order_id);


--
-- Name: barman_tickets barman_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barman_tickets
    ADD CONSTRAINT barman_tickets_pkey PRIMARY KEY (id);


--
-- Name: business_targets business_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_targets
    ADD CONSTRAINT business_targets_pkey PRIMARY KEY (month_key);


--
-- Name: cashier_queue cashier_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_queue
    ADD CONSTRAINT cashier_queue_pkey PRIMARY KEY (id);


--
-- Name: chart_of_accounts chart_of_accounts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_code_key UNIQUE (code);


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);


--
-- Name: chef_assignments chef_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chef_assignments
    ADD CONSTRAINT chef_assignments_pkey PRIMARY KEY (id);


--
-- Name: combo_items combo_items_combo_id_menu_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_items
    ADD CONSTRAINT combo_items_combo_id_menu_item_id_key UNIQUE (combo_id, menu_item_id);


--
-- Name: combo_items combo_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_items
    ADD CONSTRAINT combo_items_pkey PRIMARY KEY (id);


--
-- Name: combos combos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combos
    ADD CONSTRAINT combos_pkey PRIMARY KEY (id);


--
-- Name: complimentary_correction_requests complimentary_correction_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complimentary_correction_requests
    ADD CONSTRAINT complimentary_correction_requests_pkey PRIMARY KEY (id);


--
-- Name: credit_settlements credit_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_settlements
    ADD CONSTRAINT credit_settlements_pkey PRIMARY KEY (id);


--
-- Name: credits credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_pkey PRIMARY KEY (id);


--
-- Name: daily_reconciliations daily_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_reconciliations
    ADD CONSTRAINT daily_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: daily_reconciliations daily_reconciliations_recon_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_reconciliations
    ADD CONSTRAINT daily_reconciliations_recon_date_key UNIQUE (recon_date);


--
-- Name: daily_summaries daily_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summaries
    ADD CONSTRAINT daily_summaries_pkey PRIMARY KEY (id);


--
-- Name: daily_summaries daily_summaries_summary_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summaries
    ADD CONSTRAINT daily_summaries_summary_date_key UNIQUE (summary_date);


--
-- Name: daily_summary daily_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summary
    ADD CONSTRAINT daily_summary_pkey PRIMARY KEY (id);


--
-- Name: daily_summary daily_summary_summary_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_summary
    ADD CONSTRAINT daily_summary_summary_date_key UNIQUE (summary_date);


--
-- Name: day_closings day_closings_closing_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_closings
    ADD CONSTRAINT day_closings_closing_date_key UNIQUE (closing_date);


--
-- Name: day_closings day_closings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_closings
    ADD CONSTRAINT day_closings_pkey PRIMARY KEY (id);


--
-- Name: delivery_riders delivery_riders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_riders
    ADD CONSTRAINT delivery_riders_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: general_ledger general_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_ledger
    ADD CONSTRAINT general_ledger_pkey PRIMARY KEY (id);


--
-- Name: inventory_adjustments inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: inventory_consumptions inventory_consumptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumptions
    ADD CONSTRAINT inventory_consumptions_pkey PRIMARY KEY (id);


--
-- Name: inventory_consumptions inventory_consumptions_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumptions
    ADD CONSTRAINT inventory_consumptions_reference_number_key UNIQUE (reference_number);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_locations inventory_locations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_name_key UNIQUE (name);


--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (id);


--
-- Name: inventory_recipes inventory_recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_recipes
    ADD CONSTRAINT inventory_recipes_pkey PRIMARY KEY (id);


--
-- Name: inventory_snapshots inventory_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_snapshots
    ADD CONSTRAINT inventory_snapshots_pkey PRIMARY KEY (id);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: inventory_transfer_items inventory_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_items
    ADD CONSTRAINT inventory_transfer_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_transfers inventory_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_pkey PRIMARY KEY (id);


--
-- Name: inventory_transfers inventory_transfers_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_reference_number_key UNIQUE (reference_number);


--
-- Name: inventory_waste inventory_waste_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_waste
    ADD CONSTRAINT inventory_waste_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_reference_key UNIQUE (reference);


--
-- Name: kitchen_tickets kitchen_tickets_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_tickets
    ADD CONSTRAINT kitchen_tickets_order_id_key UNIQUE (order_id);


--
-- Name: kitchen_tickets kitchen_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_tickets
    ADD CONSTRAINT kitchen_tickets_pkey PRIMARY KEY (id);


--
-- Name: menus menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_pkey PRIMARY KEY (id);


--
-- Name: monthly_expenses monthly_expenses_month_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_expenses
    ADD CONSTRAINT monthly_expenses_month_category_key UNIQUE (month, category);


--
-- Name: monthly_expenses monthly_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_expenses
    ADD CONSTRAINT monthly_expenses_pkey PRIMARY KEY (id);


--
-- Name: monthly_targets monthly_targets_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_targets
    ADD CONSTRAINT monthly_targets_month_key UNIQUE (month);


--
-- Name: monthly_targets monthly_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_targets
    ADD CONSTRAINT monthly_targets_pkey PRIMARY KEY (id);


--
-- Name: notification_devices notification_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_devices
    ADD CONSTRAINT notification_devices_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: petty_cash petty_cash_expense_only; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.petty_cash
    ADD CONSTRAINT petty_cash_expense_only CHECK ((direction = 'OUT'::text)) NOT VALID;


--
-- Name: petty_cash petty_cash_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petty_cash
    ADD CONSTRAINT petty_cash_pkey PRIMARY KEY (id);


--
-- Name: petty_cash_transactions petty_cash_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petty_cash_transactions
    ADD CONSTRAINT petty_cash_transactions_pkey PRIMARY KEY (id);


--
-- Name: physical_counts physical_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.physical_counts
    ADD CONSTRAINT physical_counts_pkey PRIMARY KEY (id);


--
-- Name: public_payment_requests public_payment_requests_cashier_queue_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_payment_requests
    ADD CONSTRAINT public_payment_requests_cashier_queue_id_key UNIQUE (cashier_queue_id);


--
-- Name: public_payment_requests public_payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_payment_requests
    ADD CONSTRAINT public_payment_requests_pkey PRIMARY KEY (id);


--
-- Name: public_payment_requests public_payment_requests_public_order_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_payment_requests
    ADD CONSTRAINT public_payment_requests_public_order_ref_key UNIQUE (public_order_ref);


--
-- Name: purchase_receipt_items purchase_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipts purchase_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- Name: restaurant_production_events restaurant_production_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_production_events
    ADD CONSTRAINT restaurant_production_events_pkey PRIMARY KEY (id);


--
-- Name: restaurant_production_pin_attempts restaurant_production_pin_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_production_pin_attempts
    ADD CONSTRAINT restaurant_production_pin_attempts_pkey PRIMARY KEY (identifier_hash);


--
-- Name: restaurant_production_work restaurant_production_work_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_production_work
    ADD CONSTRAINT restaurant_production_work_pkey PRIMARY KEY (id);


--
-- Name: restaurant_production_work restaurant_production_work_station_ticket_id_item_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_production_work
    ADD CONSTRAINT restaurant_production_work_station_ticket_id_item_index_key UNIQUE (station, ticket_id, item_index);


--
-- Name: riders riders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.riders
    ADD CONSTRAINT riders_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: shisha_order_items shisha_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_order_items
    ADD CONSTRAINT shisha_order_items_pkey PRIMARY KEY (id);


--
-- Name: shisha_order_status_history shisha_order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_order_status_history
    ADD CONSTRAINT shisha_order_status_history_pkey PRIMARY KEY (id);


--
-- Name: shisha_orders shisha_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_orders
    ADD CONSTRAINT shisha_orders_pkey PRIMARY KEY (id);


--
-- Name: shisha_packages shisha_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_packages
    ADD CONSTRAINT shisha_packages_pkey PRIMARY KEY (id);


--
-- Name: shisha_payment_requests shisha_payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_payment_requests
    ADD CONSTRAINT shisha_payment_requests_pkey PRIMARY KEY (id);


--
-- Name: shisha_payments shisha_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_payments
    ADD CONSTRAINT shisha_payments_pkey PRIMARY KEY (id);


--
-- Name: shisha_production_events shisha_production_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_production_events
    ADD CONSTRAINT shisha_production_events_pkey PRIMARY KEY (id);


--
-- Name: shisha_production_pin_attempts shisha_production_pin_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_production_pin_attempts
    ADD CONSTRAINT shisha_production_pin_attempts_pkey PRIMARY KEY (staff_id);


--
-- Name: shisha_production_work shisha_production_work_order_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_production_work
    ADD CONSTRAINT shisha_production_work_order_item_id_key UNIQUE (order_item_id);


--
-- Name: shisha_production_work shisha_production_work_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_production_work
    ADD CONSTRAINT shisha_production_work_pkey PRIMARY KEY (id);


--
-- Name: shisha_staff shisha_staff_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_staff
    ADD CONSTRAINT shisha_staff_email_key UNIQUE (email);


--
-- Name: shisha_staff shisha_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_staff
    ADD CONSTRAINT shisha_staff_pkey PRIMARY KEY (id);


--
-- Name: shisha_tickets shisha_tickets_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_tickets
    ADD CONSTRAINT shisha_tickets_order_id_key UNIQUE (order_id);


--
-- Name: shisha_tickets shisha_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_tickets
    ADD CONSTRAINT shisha_tickets_pkey PRIMARY KEY (id);


--
-- Name: shisha_void_requests shisha_void_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_void_requests
    ADD CONSTRAINT shisha_void_requests_pkey PRIMARY KEY (id);


--
-- Name: site_visits site_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_visits
    ADD CONSTRAINT site_visits_pkey PRIMARY KEY (id);


--
-- Name: sms_log sms_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_log
    ADD CONSTRAINT sms_log_pkey PRIMARY KEY (id);


--
-- Name: special_bill_discount_audit special_bill_discount_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_bill_discount_audit
    ADD CONSTRAINT special_bill_discount_audit_pkey PRIMARY KEY (id);


--
-- Name: special_discount_settings special_discount_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_discount_settings
    ADD CONSTRAINT special_discount_settings_pkey PRIMARY KEY (id);


--
-- Name: staff staff_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_key UNIQUE (email);


--
-- Name: staff_order_goals staff_order_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_order_goals
    ADD CONSTRAINT staff_order_goals_pkey PRIMARY KEY (id);


--
-- Name: staff_order_goals staff_order_goals_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_order_goals
    ADD CONSTRAINT staff_order_goals_staff_id_key UNIQUE (staff_id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_shifts staff_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_pkey PRIMARY KEY (id);


--
-- Name: stock_counts stock_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (name);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tables tables_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_name_key UNIQUE (name);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: void_requests void_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.void_requests
    ADD CONSTRAINT void_requests_pkey PRIMARY KEY (id);


--
-- Name: cashier_queue_public_order_ref_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cashier_queue_public_order_ref_unique ON public.cashier_queue USING btree (public_order_ref) WHERE (public_order_ref IS NOT NULL);


--
-- Name: complimentary_correction_one_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX complimentary_correction_one_pending_idx ON public.complimentary_correction_requests USING btree (order_id, order_item_index) WHERE (status = 'Pending'::text);


--
-- Name: complimentary_correction_status_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX complimentary_correction_status_date_idx ON public.complimentary_correction_requests USING btree (status, requested_at DESC);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_type ON public.activity_logs USING btree (type);


--
-- Name: idx_barista_tickets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_barista_tickets_created_at ON public.barista_tickets USING btree (created_at);


--
-- Name: idx_barista_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_barista_tickets_status ON public.barista_tickets USING btree (status);


--
-- Name: idx_barista_tickets_ticket_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_barista_tickets_ticket_date ON public.barista_tickets USING btree (ticket_date);


--
-- Name: idx_barman_tickets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_barman_tickets_created_at ON public.barman_tickets USING btree (created_at);


--
-- Name: idx_barman_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_barman_tickets_status ON public.barman_tickets USING btree (status);


--
-- Name: idx_barman_tickets_ticket_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_barman_tickets_ticket_date ON public.barman_tickets USING btree (ticket_date);


--
-- Name: idx_business_targets_month_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_targets_month_key ON public.business_targets USING btree (month_key);


--
-- Name: idx_cashier_queue_requested_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashier_queue_requested_by ON public.cashier_queue USING btree (requested_by);


--
-- Name: idx_cashier_queue_shift_cleared; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashier_queue_shift_cleared ON public.cashier_queue USING btree (shift_cleared);


--
-- Name: idx_cashier_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cashier_queue_status ON public.cashier_queue USING btree (status);


--
-- Name: idx_chef_assignments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chef_assignments_order_id ON public.chef_assignments USING btree (order_id);


--
-- Name: idx_credit_settlements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_settlements_created_at ON public.credit_settlements USING btree (created_at DESC);


--
-- Name: idx_credit_settlements_credit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_settlements_credit_id ON public.credit_settlements USING btree (credit_id);


--
-- Name: idx_credits_client_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credits_client_name ON public.credits USING btree (client_name);


--
-- Name: idx_credits_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credits_created_at ON public.credits USING btree (created_at DESC);


--
-- Name: idx_credits_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credits_order_id ON public.credits USING btree (order_id);


--
-- Name: idx_credits_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credits_paid ON public.credits USING btree (paid);


--
-- Name: idx_credits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credits_status ON public.credits USING btree (status);


--
-- Name: idx_credits_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credits_table_name ON public.credits USING btree (table_name);


--
-- Name: idx_day_closings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_day_closings_date ON public.day_closings USING btree (closing_date);


--
-- Name: idx_inventory_consumptions_recipe_business_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_consumptions_recipe_business_date ON public.inventory_consumptions USING btree (recipe_id, business_date);


--
-- Name: idx_inventory_transactions_type_business_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_transactions_type_business_date ON public.inventory_transactions USING btree (transaction_type, business_date);


--
-- Name: idx_kitchen_tickets_cleared_by_kitchen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kitchen_tickets_cleared_by_kitchen ON public.kitchen_tickets USING btree (cleared_by_kitchen);


--
-- Name: idx_kitchen_tickets_ticket_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kitchen_tickets_ticket_date ON public.kitchen_tickets USING btree (ticket_date);


--
-- Name: idx_orders_day_cleared; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_day_cleared ON public.orders USING btree (day_cleared);


--
-- Name: idx_orders_items_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_items_gin ON public.orders USING gin (items jsonb_path_ops);


--
-- Name: idx_orders_payment_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_method ON public.orders USING btree (payment_method);


--
-- Name: idx_orders_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_staff_id ON public.orders USING btree (staff_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_table_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_table_name ON public.orders USING btree (table_name);


--
-- Name: idx_orders_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_timestamp ON public.orders USING btree ("timestamp" DESC);


--
-- Name: idx_petty_cash_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_petty_cash_entry_date ON public.petty_cash USING btree (entry_date);


--
-- Name: idx_staff_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_name ON public.staff USING btree (name);


--
-- Name: idx_staff_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_role ON public.staff USING btree (role);


--
-- Name: idx_void_requests_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_void_requests_order_id ON public.void_requests USING btree (order_id);


--
-- Name: idx_void_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_void_requests_status ON public.void_requests USING btree (status);


--
-- Name: journal_entries_account_transaction_request_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX journal_entries_account_transaction_request_unique ON public.journal_entries USING btree (transaction_request_id) WHERE (transaction_request_id IS NOT NULL);


--
-- Name: journal_entries_reversal_of_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX journal_entries_reversal_of_unique ON public.journal_entries USING btree (reversal_of) WHERE (reversal_of IS NOT NULL);


--
-- Name: notification_devices_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_devices_user_active_idx ON public.notification_devices USING btree (user_scope, user_id) WHERE (is_active = true);


--
-- Name: notification_devices_user_installation_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_devices_user_installation_unique ON public.notification_devices USING btree (user_scope, user_id, installation_id) WHERE (installation_id IS NOT NULL);


--
-- Name: notification_devices_user_scope_user_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_devices_user_scope_user_active_idx ON public.notification_devices USING btree (user_scope, user_id) WHERE ((active = true) OR (is_active = true));


--
-- Name: public_payment_requests_request_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX public_payment_requests_request_key_unique ON public.public_payment_requests USING btree (request_key) WHERE (request_key IS NOT NULL);


--
-- Name: public_payment_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX public_payment_requests_status_idx ON public.public_payment_requests USING btree (status, created_at DESC);


--
-- Name: public_payment_requests_transaction_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX public_payment_requests_transaction_id_unique ON public.public_payment_requests USING btree (lower(transaction_id)) WHERE (transaction_id IS NOT NULL);


--
-- Name: restaurant_production_events_work_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_production_events_work_idx ON public.restaurant_production_events USING btree (work_id, created_at);


--
-- Name: restaurant_production_terminal_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX restaurant_production_terminal_event_idx ON public.restaurant_production_events USING btree (work_id) WHERE (event_type = ANY (ARRAY['VOIDED'::text, 'CANCELLED'::text]));


--
-- Name: restaurant_production_work_staff_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_production_work_staff_date_idx ON public.restaurant_production_work USING btree (staff_id, claimed_at DESC);


--
-- Name: restaurant_production_work_station_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX restaurant_production_work_station_status_idx ON public.restaurant_production_work USING btree (station, status);


--
-- Name: shisha_orders_chef_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_orders_chef_idx ON public.shisha_orders USING btree (assigned_chef_id, order_status);


--
-- Name: shisha_orders_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_orders_created_idx ON public.shisha_orders USING btree (created_at DESC);


--
-- Name: shisha_orders_waiter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_orders_waiter_idx ON public.shisha_orders USING btree (shisha_waiter_id, created_at DESC);


--
-- Name: shisha_payment_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_payment_requests_status_idx ON public.shisha_payment_requests USING btree (status, created_at DESC);


--
-- Name: shisha_payments_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_payments_order_idx ON public.shisha_payments USING btree (order_id, confirmed_at DESC);


--
-- Name: shisha_production_work_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_production_work_order_idx ON public.shisha_production_work USING btree (order_id, status);


--
-- Name: shisha_production_work_staff_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_production_work_staff_idx ON public.shisha_production_work USING btree (staff_id, claimed_at DESC);


--
-- Name: shisha_tickets_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_tickets_date_idx ON public.shisha_tickets USING btree (ticket_date);


--
-- Name: shisha_void_requests_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_void_requests_order_idx ON public.shisha_void_requests USING btree (order_id, status);


--
-- Name: shisha_void_requests_pending_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shisha_void_requests_pending_item_idx ON public.shisha_void_requests USING btree (order_item_id) WHERE (status = 'PENDING'::text);


--
-- Name: shisha_void_requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shisha_void_requests_status_idx ON public.shisha_void_requests USING btree (status, created_at DESC);


--
-- Name: special_bill_discount_audit_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX special_bill_discount_audit_date_idx ON public.special_bill_discount_audit USING btree (applied_at DESC);


--
-- Name: special_bill_discount_audit_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX special_bill_discount_audit_order_idx ON public.special_bill_discount_audit USING btree (order_id, applied_at DESC);


--
-- Name: credit_settlements trg_sync_credit_balance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_credit_balance AFTER INSERT OR DELETE OR UPDATE ON public.credit_settlements FOR EACH ROW EXECUTE FUNCTION public.sync_credit_balance();


--
-- Name: barista_assignments barista_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barista_assignments
    ADD CONSTRAINT barista_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: barista_assignments barista_assignments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barista_assignments
    ADD CONSTRAINT barista_assignments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.barista_tickets(id) ON DELETE CASCADE;


--
-- Name: barista_tickets barista_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barista_tickets
    ADD CONSTRAINT barista_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: barman_assignments barman_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barman_assignments
    ADD CONSTRAINT barman_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: barman_assignments barman_assignments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barman_assignments
    ADD CONSTRAINT barman_assignments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.barman_tickets(id) ON DELETE CASCADE;


--
-- Name: barman_tickets barman_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barman_tickets
    ADD CONSTRAINT barman_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: cashier_queue cashier_queue_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_queue
    ADD CONSTRAINT cashier_queue_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: chef_assignments chef_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chef_assignments
    ADD CONSTRAINT chef_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: chef_assignments chef_assignments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chef_assignments
    ADD CONSTRAINT chef_assignments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.kitchen_tickets(id) ON DELETE CASCADE;


--
-- Name: combo_items combo_items_combo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_items
    ADD CONSTRAINT combo_items_combo_id_fkey FOREIGN KEY (combo_id) REFERENCES public.combos(id) ON DELETE CASCADE;


--
-- Name: combo_items combo_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_items
    ADD CONSTRAINT combo_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menus(id) ON DELETE RESTRICT;


--
-- Name: complimentary_correction_requests complimentary_correction_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complimentary_correction_requests
    ADD CONSTRAINT complimentary_correction_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: complimentary_correction_requests complimentary_correction_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complimentary_correction_requests
    ADD CONSTRAINT complimentary_correction_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.staff(id);


--
-- Name: complimentary_correction_requests complimentary_correction_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.complimentary_correction_requests
    ADD CONSTRAINT complimentary_correction_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.staff(id);


--
-- Name: credit_settlements credit_settlements_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_settlements
    ADD CONSTRAINT credit_settlements_credit_id_fkey FOREIGN KEY (credit_id) REFERENCES public.credits(id) ON DELETE CASCADE;


--
-- Name: credits credits_cashier_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_cashier_queue_id_fkey FOREIGN KEY (cashier_queue_id) REFERENCES public.cashier_queue(id) ON DELETE SET NULL;


--
-- Name: credits credits_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: general_ledger general_ledger_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_ledger
    ADD CONSTRAINT general_ledger_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: inventory_adjustments inventory_adjustments_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_adjustments inventory_adjustments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_consumptions inventory_consumptions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumptions
    ADD CONSTRAINT inventory_consumptions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_consumptions inventory_consumptions_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_consumptions
    ADD CONSTRAINT inventory_consumptions_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.inventory_recipes(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: inventory_locations inventory_locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_transactions inventory_transactions_source_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_source_location_id_fkey FOREIGN KEY (source_location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_transactions inventory_transactions_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: inventory_transfer_items inventory_transfer_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_items
    ADD CONSTRAINT inventory_transfer_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: inventory_transfer_items inventory_transfer_items_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfer_items
    ADD CONSTRAINT inventory_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.inventory_transfers(id) ON DELETE CASCADE;


--
-- Name: inventory_transfers inventory_transfers_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_transfers inventory_transfers_source_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_transfers
    ADD CONSTRAINT inventory_transfers_source_location_id_fkey FOREIGN KEY (source_location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: inventory_waste inventory_waste_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_waste
    ADD CONSTRAINT inventory_waste_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_reversal_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_reversal_of_fkey FOREIGN KEY (reversal_of) REFERENCES public.journal_entries(id);


--
-- Name: kitchen_tickets kitchen_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_tickets
    ADD CONSTRAINT kitchen_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: public_payment_requests public_payment_requests_cashier_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_payment_requests
    ADD CONSTRAINT public_payment_requests_cashier_queue_id_fkey FOREIGN KEY (cashier_queue_id) REFERENCES public.cashier_queue(id) ON DELETE CASCADE;


--
-- Name: purchase_receipt_items purchase_receipt_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: purchase_receipt_items purchase_receipt_items_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: purchase_receipt_items purchase_receipt_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchase_receipts(id) ON DELETE CASCADE;


--
-- Name: purchase_receipts purchase_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: recipe_ingredients recipe_ingredients_ingredient_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_ingredient_item_id_fkey FOREIGN KEY (ingredient_item_id) REFERENCES public.inventory_items(id) ON DELETE SET NULL;


--
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.inventory_recipes(id) ON DELETE CASCADE;


--
-- Name: shifts shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: shisha_order_items shisha_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_order_items
    ADD CONSTRAINT shisha_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shisha_orders(id) ON DELETE CASCADE;


--
-- Name: shisha_order_items shisha_order_items_shisha_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_order_items
    ADD CONSTRAINT shisha_order_items_shisha_package_id_fkey FOREIGN KEY (shisha_package_id) REFERENCES public.shisha_packages(id) ON DELETE SET NULL;


--
-- Name: shisha_order_status_history shisha_order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_order_status_history
    ADD CONSTRAINT shisha_order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shisha_orders(id) ON DELETE CASCADE;


--
-- Name: shisha_orders shisha_orders_assigned_chef_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_orders
    ADD CONSTRAINT shisha_orders_assigned_chef_id_fkey FOREIGN KEY (assigned_chef_id) REFERENCES public.shisha_staff(id);


--
-- Name: shisha_orders shisha_orders_shisha_waiter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_orders
    ADD CONSTRAINT shisha_orders_shisha_waiter_id_fkey FOREIGN KEY (shisha_waiter_id) REFERENCES public.shisha_staff(id);


--
-- Name: shisha_packages shisha_packages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_packages
    ADD CONSTRAINT shisha_packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.shisha_staff(id);


--
-- Name: shisha_payment_requests shisha_payment_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_payment_requests
    ADD CONSTRAINT shisha_payment_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shisha_orders(id) ON DELETE CASCADE;


--
-- Name: shisha_payment_requests shisha_payment_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_payment_requests
    ADD CONSTRAINT shisha_payment_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.shisha_staff(id);


--
-- Name: shisha_payments shisha_payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_payments
    ADD CONSTRAINT shisha_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shisha_orders(id) ON DELETE CASCADE;


--
-- Name: shisha_payments shisha_payments_payment_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_payments
    ADD CONSTRAINT shisha_payments_payment_request_id_fkey FOREIGN KEY (payment_request_id) REFERENCES public.shisha_payment_requests(id);


--
-- Name: shisha_tickets shisha_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_tickets
    ADD CONSTRAINT shisha_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: shisha_void_requests shisha_void_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_void_requests
    ADD CONSTRAINT shisha_void_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.shisha_orders(id) ON DELETE CASCADE;


--
-- Name: shisha_void_requests shisha_void_requests_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_void_requests
    ADD CONSTRAINT shisha_void_requests_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.shisha_order_items(id) ON DELETE CASCADE;


--
-- Name: shisha_void_requests shisha_void_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_void_requests
    ADD CONSTRAINT shisha_void_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.shisha_staff(id);


--
-- Name: shisha_void_requests shisha_void_requests_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shisha_void_requests
    ADD CONSTRAINT shisha_void_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.shisha_staff(id);


--
-- Name: special_bill_discount_audit special_bill_discount_audit_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_bill_discount_audit
    ADD CONSTRAINT special_bill_discount_audit_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: special_bill_discount_audit special_bill_discount_audit_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_bill_discount_audit
    ADD CONSTRAINT special_bill_discount_audit_config_updated_by_fkey FOREIGN KEY (config_updated_by) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: special_bill_discount_audit special_bill_discount_audit_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_bill_discount_audit
    ADD CONSTRAINT special_bill_discount_audit_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: special_bill_discount_audit special_bill_discount_audit_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_bill_discount_audit
    ADD CONSTRAINT special_bill_discount_audit_queue_id_fkey FOREIGN KEY (queue_id) REFERENCES public.cashier_queue(id) ON DELETE SET NULL;


--
-- Name: special_discount_settings special_discount_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_discount_settings
    ADD CONSTRAINT special_discount_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: staff_order_goals staff_order_goals_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_order_goals
    ADD CONSTRAINT staff_order_goals_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_shifts staff_shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: stock_counts stock_counts_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;


--
-- Name: stock_counts stock_counts_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_counts
    ADD CONSTRAINT stock_counts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE SET NULL;


--
-- Name: void_requests void_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.void_requests
    ADD CONSTRAINT void_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict HY1ipLIs1lTyBm8omwjh7nLd6AXY9cxfHXtIFbCxJjCPVOeyHLdbx9av9fHbFbg

