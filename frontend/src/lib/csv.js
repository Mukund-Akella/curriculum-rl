function coerce(value) {
  const trimmed = value.trim();
  if (trimmed === "True") return true;
  if (trimmed === "False") return false;
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

// Parses a simple CSV string (header row + comma-separated rows) into an
// array of objects keyed by header name. No quoting/escaping support needed
// since the source data is plain numbers and True/False tokens.
export function parseCSV(text) {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = coerce(cells[idx] ?? "");
    });
    rows.push(row);
  }

  return rows;
}

export async function fetchCSV(path) {
  const response = await fetch(path);
  const text = await response.text();
  return parseCSV(text);
}
