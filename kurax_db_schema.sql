

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: sync_credit_balance(); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.sync_credit_balance() OWNER TO postgres;

--
-- Name: update_credit_balance(); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.update_credit_balance() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: barista_assignments; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.barista_assignments OWNER TO postgres;

--
-- Name: barista_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.barista_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.barista_assignments_id_seq OWNER TO postgres;

--
-- Name: barista_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barista_assignments_id_seq OWNED BY public.barista_assignments.id;


--
-- Name: barista_tickets; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.barista_tickets OWNER TO postgres;

--
-- Name: barista_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.barista_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.barista_tickets_id_seq OWNER TO postgres;

--
-- Name: barista_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barista_tickets_id_seq OWNED BY public.barista_tickets.id;


--
-- Name: barman_assignments; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.barman_assignments OWNER TO postgres;

--
-- Name: barman_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.barman_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.barman_assignments_id_seq OWNER TO postgres;

--
-- Name: barman_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barman_assignments_id_seq OWNED BY public.barman_assignments.id;


--
-- Name: barman_tickets; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.barman_tickets OWNER TO postgres;

--
-- Name: barman_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.barman_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.barman_tickets_id_seq OWNER TO postgres;

--
-- Name: barman_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.barman_tickets_id_seq OWNED BY public.barman_tickets.id;


--
-- Name: business_targets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_targets (
    month_key character varying(7) NOT NULL,
    revenue_goal numeric DEFAULT 0,
    waiter_quota integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.business_targets OWNER TO postgres;

--
-- Name: cashier_queue; Type: TABLE; Schema: public; Owner: postgres
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
    items jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.cashier_queue OWNER TO postgres;

--
-- Name: cashier_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cashier_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cashier_queue_id_seq OWNER TO postgres;

--
-- Name: cashier_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cashier_queue_id_seq OWNED BY public.cashier_queue.id;


--
-- Name: chef_assignments; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.chef_assignments OWNER TO postgres;

--
-- Name: chef_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chef_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chef_assignments_id_seq OWNER TO postgres;

--
-- Name: chef_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chef_assignments_id_seq OWNED BY public.chef_assignments.id;


--
-- Name: credit_settlements; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.credit_settlements OWNER TO postgres;

--
-- Name: credit_settlements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.credit_settlements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credit_settlements_id_seq OWNER TO postgres;

--
-- Name: credit_settlements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.credit_settlements_id_seq OWNED BY public.credit_settlements.id;


--
-- Name: credits; Type: TABLE; Schema: public; Owner: postgres
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
    reject_reason text
);


ALTER TABLE public.credits OWNER TO postgres;

--
-- Name: credits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.credits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credits_id_seq OWNER TO postgres;

--
-- Name: credits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.credits_id_seq OWNED BY public.credits.id;


--
-- Name: daily_reconciliations; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.daily_reconciliations OWNER TO postgres;

--
-- Name: daily_reconciliations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_reconciliations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_reconciliations_id_seq OWNER TO postgres;

--
-- Name: daily_reconciliations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_reconciliations_id_seq OWNED BY public.daily_reconciliations.id;


--
-- Name: daily_summaries; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.daily_summaries OWNER TO postgres;

--
-- Name: daily_summaries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_summaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_summaries_id_seq OWNER TO postgres;

--
-- Name: daily_summaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_summaries_id_seq OWNED BY public.daily_summaries.id;


--
-- Name: daily_summary; Type: TABLE; Schema: public; Owner: postgres
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
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.daily_summary OWNER TO postgres;

--
-- Name: daily_summary_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.daily_summary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.daily_summary_id_seq OWNER TO postgres;

--
-- Name: daily_summary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.daily_summary_id_seq OWNED BY public.daily_summary.id;


--
-- Name: day_closings; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.day_closings OWNER TO postgres;

--
-- Name: day_closings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.day_closings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.day_closings_id_seq OWNER TO postgres;

--
-- Name: day_closings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.day_closings_id_seq OWNED BY public.day_closings.id;


--
-- Name: delivery_riders; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.delivery_riders OWNER TO postgres;

--
-- Name: delivery_riders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.delivery_riders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.delivery_riders_id_seq OWNER TO postgres;

--
-- Name: delivery_riders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.delivery_riders_id_seq OWNED BY public.delivery_riders.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.events_id_seq OWNER TO postgres;

--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: kitchen_tickets; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.kitchen_tickets OWNER TO postgres;

--
-- Name: kitchen_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kitchen_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kitchen_tickets_id_seq OWNER TO postgres;

--
-- Name: kitchen_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kitchen_tickets_id_seq OWNED BY public.kitchen_tickets.id;


--
-- Name: menus; Type: TABLE; Schema: public; Owner: postgres
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
    available boolean DEFAULT true
);


ALTER TABLE public.menus OWNER TO postgres;

--
-- Name: menus_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.menus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menus_id_seq OWNER TO postgres;

--
-- Name: menus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.menus_id_seq OWNED BY public.menus.id;


--
-- Name: monthly_expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_expenses (
    id integer NOT NULL,
    month text NOT NULL,
    category text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    description text,
    entered_by text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.monthly_expenses OWNER TO postgres;

--
-- Name: monthly_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.monthly_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.monthly_expenses_id_seq OWNER TO postgres;

--
-- Name: monthly_expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.monthly_expenses_id_seq OWNED BY public.monthly_expenses.id;


--
-- Name: monthly_targets; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.monthly_targets OWNER TO postgres;

--
-- Name: monthly_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.monthly_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.monthly_targets_id_seq OWNER TO postgres;

--
-- Name: monthly_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.monthly_targets_id_seq OWNED BY public.monthly_targets.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
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
    transaction_id text
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: petty_cash; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.petty_cash OWNER TO postgres;

--
-- Name: petty_cash_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.petty_cash_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.petty_cash_id_seq OWNER TO postgres;

--
-- Name: petty_cash_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.petty_cash_id_seq OWNED BY public.petty_cash.id;


--
-- Name: petty_cash_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.petty_cash_transactions (
    id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    type character varying(20) DEFAULT 'expense'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    created_by character varying(100)
);


ALTER TABLE public.petty_cash_transactions OWNER TO postgres;

--
-- Name: petty_cash_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.petty_cash_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.petty_cash_transactions_id_seq OWNER TO postgres;

--
-- Name: petty_cash_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.petty_cash_transactions_id_seq OWNED BY public.petty_cash_transactions.id;


--
-- Name: physical_counts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.physical_counts (
    id integer NOT NULL,
    count_date date NOT NULL,
    cash numeric DEFAULT 0,
    momo_mtn numeric DEFAULT 0,
    momo_airtel numeric DEFAULT 0,
    card numeric DEFAULT 0,
    notes text,
    submitted_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.physical_counts OWNER TO postgres;

--
-- Name: physical_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.physical_counts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.physical_counts_id_seq OWNER TO postgres;

--
-- Name: physical_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.physical_counts_id_seq OWNED BY public.physical_counts.id;


--
-- Name: riders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.riders (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    status text DEFAULT 'Available'::text
);


ALTER TABLE public.riders OWNER TO postgres;

--
-- Name: riders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.riders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.riders_id_seq OWNER TO postgres;

--
-- Name: riders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.riders_id_seq OWNED BY public.riders.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shifts_id_seq OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: site_visits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_visits (
    id integer NOT NULL,
    page text,
    ip text,
    user_agent text,
    visited_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.site_visits OWNER TO postgres;

--
-- Name: site_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.site_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.site_visits_id_seq OWNER TO postgres;

--
-- Name: site_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.site_visits_id_seq OWNED BY public.site_visits.id;


--
-- Name: sms_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_log (
    id integer NOT NULL,
    recipient text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'sent'::text,
    provider text,
    sent_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sms_log OWNER TO postgres;

--
-- Name: sms_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sms_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sms_log_id_seq OWNER TO postgres;

--
-- Name: sms_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sms_log_id_seq OWNED BY public.sms_log.id;


--
-- Name: staff; Type: TABLE; Schema: public; Owner: postgres
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
    is_requesting boolean DEFAULT false
);


ALTER TABLE public.staff OWNER TO postgres;

--
-- Name: staff_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_id_seq OWNER TO postgres;

--
-- Name: staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;


--
-- Name: staff_order_goals; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.staff_order_goals OWNER TO postgres;

--
-- Name: staff_order_goals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_order_goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_order_goals_id_seq OWNER TO postgres;

--
-- Name: staff_order_goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_order_goals_id_seq OWNED BY public.staff_order_goals.id;


--
-- Name: staff_shifts; Type: TABLE; Schema: public; Owner: postgres
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
    total_orders integer DEFAULT 0
);


ALTER TABLE public.staff_shifts OWNER TO postgres;

--
-- Name: staff_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_shifts_id_seq OWNER TO postgres;

--
-- Name: staff_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_shifts_id_seq OWNED BY public.staff_shifts.id;


--
-- Name: tables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tables (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'Available'::character varying,
    last_order_id integer,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tables OWNER TO postgres;

--
-- Name: tables_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tables_id_seq OWNER TO postgres;

--
-- Name: tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tables_id_seq OWNED BY public.tables.id;


--
-- Name: void_requests; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.void_requests OWNER TO postgres;

--
-- Name: void_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.void_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.void_requests_id_seq OWNER TO postgres;

--
-- Name: void_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.void_requests_id_seq OWNED BY public.void_requests.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: barista_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barista_assignments ALTER COLUMN id SET DEFAULT nextval('public.barista_assignments_id_seq'::regclass);


--
-- Name: barista_tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barista_tickets ALTER COLUMN id SET DEFAULT nextval('public.barista_tickets_id_seq'::regclass);


--
-- Name: barman_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barman_assignments ALTER COLUMN id SET DEFAULT nextval('public.barman_assignments_id_seq'::regclass);


--
-- Name: barman_tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barman_tickets ALTER COLUMN id SET DEFAULT nextval('public.barman_tickets_id_seq'::regclass);


--
-- Name: cashier_queue id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cashier_queue ALTER COLUMN id SET DEFAULT nextval('public.cashier_queue_id_seq'::regclass);


--
-- Name: chef_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chef_assignments ALTER COLUMN id SET DEFAULT nextval('public.chef_assignments_id_seq'::regclass);


--
-- Name: credit_settlements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_settlements ALTER COLUMN id SET DEFAULT nextval('public.credit_settlements_id_seq'::regclass);


--
-- Name: credits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits ALTER COLUMN id SET DEFAULT nextval('public.credits_id_seq'::regclass);


--
-- Name: daily_reconciliations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reconciliations ALTER COLUMN id SET DEFAULT nextval('public.daily_reconciliations_id_seq'::regclass);


--
-- Name: daily_summaries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_summaries ALTER COLUMN id SET DEFAULT nextval('public.daily_summaries_id_seq'::regclass);


--
-- Name: daily_summary id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_summary ALTER COLUMN id SET DEFAULT nextval('public.daily_summary_id_seq'::regclass);


--
-- Name: day_closings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.day_closings ALTER COLUMN id SET DEFAULT nextval('public.day_closings_id_seq'::regclass);


--
-- Name: delivery_riders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_riders ALTER COLUMN id SET DEFAULT nextval('public.delivery_riders_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: kitchen_tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_tickets ALTER COLUMN id SET DEFAULT nextval('public.kitchen_tickets_id_seq'::regclass);


--
-- Name: menus id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menus ALTER COLUMN id SET DEFAULT nextval('public.menus_id_seq'::regclass);


--
-- Name: monthly_expenses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_expenses ALTER COLUMN id SET DEFAULT nextval('public.monthly_expenses_id_seq'::regclass);


--
-- Name: monthly_targets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_targets ALTER COLUMN id SET DEFAULT nextval('public.monthly_targets_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: petty_cash id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.petty_cash ALTER COLUMN id SET DEFAULT nextval('public.petty_cash_id_seq'::regclass);


--
-- Name: petty_cash_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.petty_cash_transactions ALTER COLUMN id SET DEFAULT nextval('public.petty_cash_transactions_id_seq'::regclass);


--
-- Name: physical_counts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.physical_counts ALTER COLUMN id SET DEFAULT nextval('public.physical_counts_id_seq'::regclass);


--
-- Name: riders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riders ALTER COLUMN id SET DEFAULT nextval('public.riders_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: site_visits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_visits ALTER COLUMN id SET DEFAULT nextval('public.site_visits_id_seq'::regclass);


--
-- Name: sms_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_log ALTER COLUMN id SET DEFAULT nextval('public.sms_log_id_seq'::regclass);


--
-- Name: staff id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);


--
-- Name: staff_order_goals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_order_goals ALTER COLUMN id SET DEFAULT nextval('public.staff_order_goals_id_seq'::regclass);


--
-- Name: staff_shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_shifts ALTER COLUMN id SET DEFAULT nextval('public.staff_shifts_id_seq'::regclass);


--
-- Name: tables id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables ALTER COLUMN id SET DEFAULT nextval('public.tables_id_seq'::regclass);


--
-- Name: void_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.void_requests ALTER COLUMN id SET DEFAULT nextval('public.void_requests_id_seq'::regclass);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: barista_assignments barista_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barista_assignments
    ADD CONSTRAINT barista_assignments_pkey PRIMARY KEY (id);


--
-- Name: barista_tickets barista_tickets_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barista_tickets
    ADD CONSTRAINT barista_tickets_order_id_key UNIQUE (order_id);


--
-- Name: barista_tickets barista_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barista_tickets
    ADD CONSTRAINT barista_tickets_pkey PRIMARY KEY (id);


--
-- Name: barman_assignments barman_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barman_assignments
    ADD CONSTRAINT barman_assignments_pkey PRIMARY KEY (id);


--
-- Name: barman_tickets barman_tickets_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barman_tickets
    ADD CONSTRAINT barman_tickets_order_id_key UNIQUE (order_id);


--
-- Name: barman_tickets barman_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barman_tickets
    ADD CONSTRAINT barman_tickets_pkey PRIMARY KEY (id);


--
-- Name: business_targets business_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_targets
    ADD CONSTRAINT business_targets_pkey PRIMARY KEY (month_key);


--
-- Name: cashier_queue cashier_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cashier_queue
    ADD CONSTRAINT cashier_queue_pkey PRIMARY KEY (id);


--
-- Name: chef_assignments chef_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chef_assignments
    ADD CONSTRAINT chef_assignments_pkey PRIMARY KEY (id);


--
-- Name: credit_settlements credit_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_settlements
    ADD CONSTRAINT credit_settlements_pkey PRIMARY KEY (id);


--
-- Name: credits credits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_pkey PRIMARY KEY (id);


--
-- Name: daily_reconciliations daily_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reconciliations
    ADD CONSTRAINT daily_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: daily_reconciliations daily_reconciliations_recon_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reconciliations
    ADD CONSTRAINT daily_reconciliations_recon_date_key UNIQUE (recon_date);


--
-- Name: daily_summaries daily_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_summaries
    ADD CONSTRAINT daily_summaries_pkey PRIMARY KEY (id);


--
-- Name: daily_summaries daily_summaries_summary_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_summaries
    ADD CONSTRAINT daily_summaries_summary_date_key UNIQUE (summary_date);


--
-- Name: daily_summary daily_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_summary
    ADD CONSTRAINT daily_summary_pkey PRIMARY KEY (id);


--
-- Name: daily_summary daily_summary_summary_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_summary
    ADD CONSTRAINT daily_summary_summary_date_key UNIQUE (summary_date);


--
-- Name: day_closings day_closings_closing_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.day_closings
    ADD CONSTRAINT day_closings_closing_date_key UNIQUE (closing_date);


--
-- Name: day_closings day_closings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.day_closings
    ADD CONSTRAINT day_closings_pkey PRIMARY KEY (id);


--
-- Name: delivery_riders delivery_riders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_riders
    ADD CONSTRAINT delivery_riders_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: kitchen_tickets kitchen_tickets_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_tickets
    ADD CONSTRAINT kitchen_tickets_order_id_key UNIQUE (order_id);


--
-- Name: kitchen_tickets kitchen_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_tickets
    ADD CONSTRAINT kitchen_tickets_pkey PRIMARY KEY (id);


--
-- Name: menus menus_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.menus
    ADD CONSTRAINT menus_pkey PRIMARY KEY (id);


--
-- Name: monthly_expenses monthly_expenses_month_category_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_expenses
    ADD CONSTRAINT monthly_expenses_month_category_key UNIQUE (month, category);


--
-- Name: monthly_expenses monthly_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_expenses
    ADD CONSTRAINT monthly_expenses_pkey PRIMARY KEY (id);


--
-- Name: monthly_targets monthly_targets_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_targets
    ADD CONSTRAINT monthly_targets_month_key UNIQUE (month);


--
-- Name: monthly_targets monthly_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_targets
    ADD CONSTRAINT monthly_targets_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: petty_cash petty_cash_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.petty_cash
    ADD CONSTRAINT petty_cash_pkey PRIMARY KEY (id);


--
-- Name: petty_cash_transactions petty_cash_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.petty_cash_transactions
    ADD CONSTRAINT petty_cash_transactions_pkey PRIMARY KEY (id);


--
-- Name: physical_counts physical_counts_count_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.physical_counts
    ADD CONSTRAINT physical_counts_count_date_key UNIQUE (count_date);


--
-- Name: physical_counts physical_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.physical_counts
    ADD CONSTRAINT physical_counts_pkey PRIMARY KEY (id);


--
-- Name: riders riders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.riders
    ADD CONSTRAINT riders_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: site_visits site_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_visits
    ADD CONSTRAINT site_visits_pkey PRIMARY KEY (id);


--
-- Name: sms_log sms_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_log
    ADD CONSTRAINT sms_log_pkey PRIMARY KEY (id);


--
-- Name: staff staff_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_key UNIQUE (email);


--
-- Name: staff_order_goals staff_order_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_order_goals
    ADD CONSTRAINT staff_order_goals_pkey PRIMARY KEY (id);


--
-- Name: staff_order_goals staff_order_goals_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_order_goals
    ADD CONSTRAINT staff_order_goals_staff_id_key UNIQUE (staff_id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_shifts staff_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_pkey PRIMARY KEY (id);


--
-- Name: tables tables_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_name_key UNIQUE (name);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: void_requests void_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.void_requests
    ADD CONSTRAINT void_requests_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_type ON public.activity_logs USING btree (type);


--
-- Name: idx_barista_tickets_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_barista_tickets_created_at ON public.barista_tickets USING btree (created_at);


--
-- Name: idx_barista_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_barista_tickets_status ON public.barista_tickets USING btree (status);


--
-- Name: idx_barista_tickets_ticket_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_barista_tickets_ticket_date ON public.barista_tickets USING btree (ticket_date);


--
-- Name: idx_barman_tickets_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_barman_tickets_created_at ON public.barman_tickets USING btree (created_at);


--
-- Name: idx_barman_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_barman_tickets_status ON public.barman_tickets USING btree (status);


--
-- Name: idx_barman_tickets_ticket_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_barman_tickets_ticket_date ON public.barman_tickets USING btree (ticket_date);


--
-- Name: idx_business_targets_month_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_business_targets_month_key ON public.business_targets USING btree (month_key);


--
-- Name: idx_cashier_queue_requested_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cashier_queue_requested_by ON public.cashier_queue USING btree (requested_by);


--
-- Name: idx_cashier_queue_shift_cleared; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cashier_queue_shift_cleared ON public.cashier_queue USING btree (shift_cleared);


--
-- Name: idx_cashier_queue_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cashier_queue_status ON public.cashier_queue USING btree (status);


--
-- Name: idx_chef_assignments_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chef_assignments_order_id ON public.chef_assignments USING btree (order_id);


--
-- Name: idx_credit_settlements_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_settlements_created_at ON public.credit_settlements USING btree (created_at DESC);


--
-- Name: idx_credit_settlements_credit_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_settlements_credit_id ON public.credit_settlements USING btree (credit_id);


--
-- Name: idx_credits_client_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credits_client_name ON public.credits USING btree (client_name);


--
-- Name: idx_credits_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credits_created_at ON public.credits USING btree (created_at DESC);


--
-- Name: idx_credits_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credits_order_id ON public.credits USING btree (order_id);


--
-- Name: idx_credits_paid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credits_paid ON public.credits USING btree (paid);


--
-- Name: idx_credits_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credits_status ON public.credits USING btree (status);


--
-- Name: idx_credits_table_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credits_table_name ON public.credits USING btree (table_name);


--
-- Name: idx_day_closings_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_day_closings_date ON public.day_closings USING btree (closing_date);


--
-- Name: idx_kitchen_tickets_cleared_by_kitchen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kitchen_tickets_cleared_by_kitchen ON public.kitchen_tickets USING btree (cleared_by_kitchen);


--
-- Name: idx_kitchen_tickets_ticket_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kitchen_tickets_ticket_date ON public.kitchen_tickets USING btree (ticket_date);


--
-- Name: idx_orders_day_cleared; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_day_cleared ON public.orders USING btree (day_cleared);


--
-- Name: idx_orders_payment_method; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_payment_method ON public.orders USING btree (payment_method);


--
-- Name: idx_orders_staff_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_staff_id ON public.orders USING btree (staff_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_table_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_table_name ON public.orders USING btree (table_name);


--
-- Name: idx_orders_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_timestamp ON public.orders USING btree ("timestamp" DESC);


--
-- Name: idx_petty_cash_entry_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_petty_cash_entry_date ON public.petty_cash USING btree (entry_date);


--
-- Name: idx_staff_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_name ON public.staff USING btree (name);


--
-- Name: idx_staff_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_role ON public.staff USING btree (role);


--
-- Name: idx_void_requests_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_void_requests_order_id ON public.void_requests USING btree (order_id);


--
-- Name: idx_void_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_void_requests_status ON public.void_requests USING btree (status);


--
-- Name: credit_settlements trg_sync_credit_balance; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_credit_balance AFTER INSERT OR DELETE OR UPDATE ON public.credit_settlements FOR EACH ROW EXECUTE FUNCTION public.sync_credit_balance();


--
-- Name: barista_assignments barista_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barista_assignments
    ADD CONSTRAINT barista_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: barista_assignments barista_assignments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barista_assignments
    ADD CONSTRAINT barista_assignments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.barista_tickets(id) ON DELETE CASCADE;


--
-- Name: barista_tickets barista_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barista_tickets
    ADD CONSTRAINT barista_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: barman_assignments barman_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barman_assignments
    ADD CONSTRAINT barman_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: barman_assignments barman_assignments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barman_assignments
    ADD CONSTRAINT barman_assignments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.barman_tickets(id) ON DELETE CASCADE;


--
-- Name: barman_tickets barman_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barman_tickets
    ADD CONSTRAINT barman_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: cashier_queue cashier_queue_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cashier_queue
    ADD CONSTRAINT cashier_queue_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: chef_assignments chef_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chef_assignments
    ADD CONSTRAINT chef_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: chef_assignments chef_assignments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chef_assignments
    ADD CONSTRAINT chef_assignments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.kitchen_tickets(id) ON DELETE CASCADE;


--
-- Name: credit_settlements credit_settlements_credit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_settlements
    ADD CONSTRAINT credit_settlements_credit_id_fkey FOREIGN KEY (credit_id) REFERENCES public.credits(id) ON DELETE CASCADE;


--
-- Name: credits credits_cashier_queue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_cashier_queue_id_fkey FOREIGN KEY (cashier_queue_id) REFERENCES public.cashier_queue(id) ON DELETE SET NULL;


--
-- Name: credits credits_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: kitchen_tickets kitchen_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kitchen_tickets
    ADD CONSTRAINT kitchen_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: shifts shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: staff_order_goals staff_order_goals_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_order_goals
    ADD CONSTRAINT staff_order_goals_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_shifts staff_shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: void_requests void_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.void_requests
    ADD CONSTRAINT void_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict aXjbc5lp3YvyxT8CXp18l2eTrJy2telCry3QW21DVmhihiNA2F3aKZsoRoET2zZ

