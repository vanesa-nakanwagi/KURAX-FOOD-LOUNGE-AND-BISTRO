export const CASHIER_SESSION_KEY = "kurax_cashier_session";

export function readCashierSession() {
  try {
    const savedCashier = JSON.parse(localStorage.getItem(CASHIER_SESSION_KEY) || "null");
    if (
      savedCashier?.token &&
      String(savedCashier.role || "").toUpperCase() === "CASHIER"
    ) {
      return savedCashier;
    }

    const savedStaff = JSON.parse(localStorage.getItem("kurax_user") || "null");
    if (
      savedStaff?.token &&
      String(savedStaff.role || "").toUpperCase() === "CASHIER"
    ) {
      localStorage.setItem(CASHIER_SESSION_KEY, JSON.stringify(savedStaff));
      return savedStaff;
    }
  } catch (error) {
    console.error("Unable to read cashier session:", error);
  }

  return null;
}

export function cashierAuthHeaders(includeJsonContentType = false) {
  const token = readCashierSession()?.token || "";

  return {
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
