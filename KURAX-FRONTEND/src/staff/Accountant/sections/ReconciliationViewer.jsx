import React, { useCallback, useEffect, useState } from "react";
import { useData } from "../../../customer/components/context/DataContext";
import API_URL from "../../../config/api";
import ReconciliationOverview from "./ReconciliationOverview";
import PaymentReconciliationSection from "./PaymentReconciliationSection";
import { kampalaDate } from "../utils/helpers";

export default function ReconciliationViewer({ userName = "Staff", dark = false, onlyReconciliation = false }) {
  const { todaySummary, dayClosed, refreshData } = useData() || {};
  const [physical, setPhysical] = useState(null);
  const [credits, setCredits] = useState(null);
  const [pettyCash, setPettyCash] = useState(null);
  const [voidRequests, setVoidRequests] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [summaryRes, physicalRes, creditsRes, pettyRes, voidsRes, profitRes] = await Promise.all([
        fetch(`${API_URL}/api/accountant/today?t=${Date.now()}`),
        fetch(`${API_URL}/api/accountant/physical-count?t=${Date.now()}`),
        fetch(`${API_URL}/api/cashier-ops/credits?t=${Date.now()}`),
        fetch(`${API_URL}/api/accountant/petty-cash?date=${kampalaDate()}`),
        fetch(`${API_URL}/api/orders/void-requests`),
        fetch(`${API_URL}/api/summaries/monthly-profit?month=${selectedMonth}`),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (physicalRes.ok) setPhysical(await physicalRes.json());
      if (creditsRes.ok) {
        const rows = await creditsRes.json();
        const now = new Date();
        setCredits(rows.filter(credit => {
          const created = new Date(credit.created_at);
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }));
      }
      if (pettyRes.ok) setPettyCash(await pettyRes.json());
      if (voidsRes.ok) setVoidRequests(await voidsRes.json());
      if (profitRes.ok) setProfitData(await profitRes.json());
      setError([summaryRes, physicalRes, creditsRes, pettyRes, voidsRes, profitRes].some(response => !response.ok));
    } catch (requestError) {
      console.error("Reconciliation viewer load failed:", requestError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const [summary, setSummary] = useState(null);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const src = summary || todaySummary || {};
  const sys = {
    cash: Number(src.total_cash) || 0,
    card: Number(src.total_card) || 0,
    mtn: Number(src.total_mtn) || 0,
    airtel: Number(src.total_airtel) || 0,
    gross: Number(src.total_gross) || 0,
    orders: Number(src.order_count) || 0,
    credit_settlements: Number(src.total_settled_credits ?? src.credit_settlements_today) || 0,
  };
  const physCash = Number(physical?.cash) || 0;
  const physMomoMTN = Number(physical?.mtn) || 0;
  const physMomoAirtel = Number(physical?.airtel) || 0;
  const physCard = Number(physical?.card) || 0;
  const pettyCashIn = Number(pettyCash?.total_in) || 0;
  const adjustedCash = physCash - pettyCashIn;

  if (onlyReconciliation) {
    return (
      <PaymentReconciliationSection
        sys={sys}
        physCash={physCash}
        physMomoMTN={physMomoMTN}
        physMomoAirtel={physMomoAirtel}
        physCard={physCard}
        varCash={adjustedCash - sys.cash}
        varMTN={physMomoMTN - sys.mtn}
        varAirtel={physMomoAirtel - sys.airtel}
        varCard={physCard - sys.card}
        summaryAvailable={Boolean(summary || todaySummary) && !error}
        physicalAvailable={Boolean(physical) && !loading}
        credits={credits}
        creditsAvailable={Array.isArray(credits)}
      />
    );
  }

  return (
    <ReconciliationOverview
      dayClosed={dayClosed}
      sys={sys}
      physCash={physCash}
      physMomoMTN={physMomoMTN}
      physMomoAirtel={physMomoAirtel}
      physCard={physCard}
      pettyCashIn={pettyCashIn}
      pettyCashToday={pettyCash}
      varCash={adjustedCash - sys.cash}
      varMTN={physMomoMTN - sys.mtn}
      varAirtel={physMomoAirtel - sys.airtel}
      varCard={physCard - sys.card}
      varTotal={(adjustedCash - sys.cash) + (physMomoMTN - sys.mtn) + (physMomoAirtel - sys.airtel) + (physCard - sys.card)}
      hasPhysicalCount={Boolean(physical) && !loading}
      creditsLedger={credits}
      creditsLoading={loading}
      voidRequests={voidRequests || []}
      voidRequestsLoading={loading}
      profitData={profitData}
      profitLoad={loading}
      selectedMonth={selectedMonth}
      setSelectedMonth={setSelectedMonth}
      userName={userName}
      summaryAvailable={Boolean(summary || todaySummary) && !error}
      refreshDashboard={async () => { await load(); await refreshData?.(); }}
      setActiveSection={() => {}}
      handleDayClosure={() => {}}
      isFinalizing={false}
      error={error ? "Data source error." : null}
      dark={dark}
    />
  );
}
