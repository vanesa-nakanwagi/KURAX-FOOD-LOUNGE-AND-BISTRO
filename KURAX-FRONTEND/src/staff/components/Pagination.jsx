import React from "react";

const PAGE_SIZES = [10, 20, 50];

export default function Pagination({
  page,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const firstRecord = totalRecords ? (currentPage - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(currentPage * pageSize, totalRecords);
  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => startPage + index,
  );

  const buttonClass = "min-w-8 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 py-3 text-gray-700">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-gray-500">Showing {firstRecord}–{lastRecord} of {totalRecords} records</p>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Rows
          <select
            aria-label="Records per page"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-800"
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className={buttonClass} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
          Previous
        </button>
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            aria-label={`Go to page ${pageNumber}`}
            aria-current={pageNumber === currentPage ? "page" : undefined}
            onClick={() => onPageChange(pageNumber)}
            className={`${buttonClass} ${pageNumber === currentPage ? "border-yellow-500 bg-yellow-500 text-black" : "border-gray-300 bg-white hover:bg-gray-100"}`}
          >
            {pageNumber}
          </button>
        ))}
        <span className="px-1 text-xs text-gray-500">of {totalPages}</span>
        <button type="button" className={buttonClass} onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
          Next
        </button>
      </div>
    </nav>
  );
}