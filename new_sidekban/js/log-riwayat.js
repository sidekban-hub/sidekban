// Halaman riwayat status banjir menggunakan tabel Supabase "log_status".
let semuaLog = [];
let statusSekarang = { status: "--", tinggi_air: "-", debit_air: "-" };

function formatTanggal(ts) {
  return new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}
function formatJam(ts) { return new Date(ts).toLocaleTimeString("id-ID"); }
function buatBadge(status) {
  let cls = "badge-aman";
  if (status === "Waspada") cls = "badge-waspada";
  if (status === "Bahaya") cls = "badge-bahaya";
  return `<span class="badge ${cls}">${status}</span>`;
}
function badgeKelas(status) {
  if (status === "Waspada") return "nilai status status-waspada";
  if (status === "Bahaya") return "nilai status status-bahaya";
  return "nilai status status-aman";
}
function renderStat() {
  document.getElementById("stat-total").textContent = semuaLog.length;
  const bahayaTerakhir = semuaLog.find(item => item.status === "Bahaya");
  document.getElementById("stat-bahaya").textContent = bahayaTerakhir
    ? `${formatTanggal(bahayaTerakhir.ts)} · ${formatJam(bahayaTerakhir.ts)}` : "Belum ada";
  const el = document.getElementById("stat-status");
  el.textContent = statusSekarang.status;
  el.className = badgeKelas(statusSekarang.status);
}
function renderTabel() {
  const filter = document.getElementById("filter-status").value;
  const tbody = document.getElementById("isi-tabel");
  tbody.innerHTML = "";
  const data = filter === "semua" ? semuaLog : semuaLog.filter(item => item.status === filter);
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:28px;">Belum ada data</td></tr>`;
    return;
  }
  data.forEach((item, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${formatTanggal(item.ts)}</td><td>${formatJam(item.ts)}</td><td>${buatBadge(item.status)}</td><td>${item.tinggi_air ?? "-"}</td><td>${item.debit_air ?? "-"}</td>`;
    tbody.appendChild(tr);
  });
}
async function loadLog() {
  if (!supabaseClient) return;
  const [logResult, sensorResult] = await Promise.all([
    supabaseClient.from("log_status").select("*").order("ts", { ascending: false }).limit(100),
    supabaseClient.from("sensor").select("*").order("id", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (!logResult.error) semuaLog = logResult.data || [];
  if (!sensorResult.error && sensorResult.data) statusSekarang = sensorResult.data;
  renderTabel(); renderStat();
}
document.getElementById("filter-status").addEventListener("change", renderTabel);
loadLog();
if (supabaseClient) {
  supabaseClient.channel("status-history")
    .on("postgres_changes", { event: "*", schema: "public", table: "log_status" }, loadLog)
    .on("postgres_changes", { event: "*", schema: "public", table: "sensor" }, loadLog)
    .subscribe();
}
