export function parsePagination(query) {
  if (query.page === undefined) return null;

  const page = Number(query.page);
  const pageSize = Number(query.limit ?? 20);
  const search = String(query.search || '').trim();
  const sortOrder = String(query.sortOrder || 'desc').toLowerCase();

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error('page must be a positive integer.');
  }
  if (![10, 20, 50].includes(pageSize)) {
    throw new Error('limit must be 10, 20, or 50.');
  }
  if (search.length > 200) {
    throw new Error('search must be 200 characters or fewer.');
  }
  if (!['asc', 'desc'].includes(sortOrder)) {
    throw new Error('sortOrder must be asc or desc.');
  }

  return { page, pageSize, search, sortBy: String(query.sortBy || ''), sortOrder };
}

export function getPageWindow(totalRecords, pagination) {
  const totalPages = Math.ceil(totalRecords / pagination.pageSize);
  const currentPage = totalPages ? Math.min(pagination.page, totalPages) : 1;

  return {
    currentPage,
    pageSize: pagination.pageSize,
    totalRecords,
    totalPages,
    offset: (currentPage - 1) * pagination.pageSize,
  };
}

export function toSearchPattern(search) {
  const escaped = String(search).replace(/[!%_]/g, '!$&');
  return `%${escaped}%`;
}