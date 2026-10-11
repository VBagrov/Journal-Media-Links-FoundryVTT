export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

export function notifyError(message, error, context) {
  console.error(`Journal Track Links | ${context}`, error);
  ui.notifications.error(message);
}
