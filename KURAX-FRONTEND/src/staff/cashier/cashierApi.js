export function cashierAuthHeaders(includeJsonContentType = false) {
  let token = "";
  try {
    token = JSON.parse(localStorage.getItem("kurax_user") || "{}").token || "";
  } catch (error) {
    console.error("Unable to read cashier session:", error);
  }

  return {
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
