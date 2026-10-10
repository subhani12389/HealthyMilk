function getPagination(query, defaultLimit = 20, maxLimit = 100) {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit || query.pageSize, 10);
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(maxLimit, Math.max(1, parsedLimit))
    : defaultLimit;
  const page = Math.min(requestedPage, Math.floor(Number.MAX_SAFE_INTEGER / limit));
  return { page, limit, skip: (page - 1) * limit };
}

function paginationResult(page, limit, totalItems) {
  return { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) };
}

module.exports = { getPagination, paginationResult };
