import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import API_URL from "../../config/api";

function formatDetails(details) {
  if (typeof details === "string") return details;
  return JSON.stringify(details || {}, null, 2);
}

export default function AccountingAuditTrail({ dark = false }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEntries = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/accountant/accounting/audit-trail`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setEntries(data.entries || []);
    } catch (loadError) {
      setError(loadError.message || "Could not load the audit trail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const border = dark ? "border-white/10" : "border-gray-200";
  const text = dark ? "text-zinc-100" : "text-gray-900";
  const muted = dark ? "text-zinc-400" : "text-gray-500";

  return (
    <section className={`${text} space-y-4`}>
      <header className={`flex flex-wrap items-center justify-between gap-3 border-b ${border} pb-4`}>
        <div>
          <h2 className="text-xl font-bold">Accounting Audit Trail</h2>
          <p className={`mt-1 text-sm ${muted}`}>Latest 100 accounting events</p>
        </div>
        <button
          type="button"
          onClick={loadEntries}
          disabled={loading}
          aria-label="Refresh audit trail"
          title="Refresh audit trail"
          className={`inline-flex items-center gap-2 rounded-md border ${border} px-3 py-2 text-sm font-semibold disabled:opacity-50`}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && <p role="alert" className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className={`overflow-x-auto border-b ${border}`}>
        {loading ? (
          <p className={`py-10 text-center text-sm ${muted}`}>Loading audit trail...</p>
        ) : entries.length ? (
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className={`border-b ${border}`}>
                {["Date", "Entity", "Entity ID", "Action", "Actor", "Details"].map((heading) => (
                  <th key={heading} className={`whitespace-nowrap px-3 py-3 text-xs font-bold ${muted}`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className={`border-b ${border}`}>
                  <td className="whitespace-nowrap px-3 py-3">{entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}</td>
                  <td className="px-3 py-3">{entry.entity_type || "-"}</td>
                  <td className="px-3 py-3">{entry.entity_id ?? "-"}</td>
                  <td className="px-3 py-3 font-semibold">{entry.action || "-"}</td>
                  <td className="px-3 py-3">{entry.actor || "-"}</td>
                  <td className="max-w-[360px] px-3 py-3">
                    <details>
                      <summary className="cursor-pointer font-semibold text-yellow-700">View details</summary>
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{formatDetails(entry.details)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !error ? (
          <p className={`py-10 text-center text-sm ${muted}`}>No accounting audit events found.</p>
        ) : null}
      </div>
    </section>
  );
}