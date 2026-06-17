export function statusClass(status: string): string {
  if (status === "completed") {
    return "status status-completed";
  }
  if (status === "reversed") {
    return "status status-reversed";
  }
  return "status status-failed";
}
