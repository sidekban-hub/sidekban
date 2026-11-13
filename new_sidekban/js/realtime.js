// Membaca data sensor terbaru dan menilai kesehatan aliran data secara konservatif.
const elTinggi = document.getElementById("tinggi-air");
const elDebit = document.getElementById("debit-air");
const elStatus = document.getElementById("status");
const elTimestamp = document.getElementById("timestamp");
const elUpdate = document.getElementById("waktu-update");

// Nama kolom curah hujan di tabel "sensor". Ganti jika nama kolomnya berbeda.
const KOLOM_HUJAN = "curah_hujan";

let realtimeConnected = false;
let lastSensorData = null;

// Mengubah nilai kolom hujan menjadi "tidak-hujan" | "gerimis" | "deras".
// Mendukung teks (mis. "Gerimis") maupun angka 0-100 (0 = tidak hujan, <=50 = gerimis, >50 = deras).
function tentukanLevelHujan(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;

  const teks = String(nilai).trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (teks === "tidak-hujan" || teks === "cerah") return "tidak-hujan";
  if (teks === "gerimis") return "gerimis";
  if (teks === "deras" || teks === "hujan-deras") return "deras";

  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka < 0) return null;
  if (angka === 0) return "tidak-hujan";
  if (angka <= 50) return "gerimis";
  return "deras";
}

function setHealth(id, state, message) {
  const dot = document.getElementById(id + "-dot");
  const text = document.getElementById(id);
  if (!dot || !text) return;
  dot.className = "health-dot " + state;
  text.textContent = message;
}

function updateSensorHealth(data = lastSensorData) {
  const badge = document.getElementById("sensor-health-badge");
  const note = document.getElementById("sensor-health-note");
  if (!badge) return; // Halaman selain dashboard tidak memiliki panel ini.

  setHealth("health-connection", supabaseClient ? "good" : "bad",
    supabaseClient ? "Konfigurasi Supabase tersedia" : "Konfigurasi Supabase belum tersedia");
  setHealth("health-realtime", realtimeConnected ? "good" : "warn",
    realtimeConnected ? "Langganan perubahan aktif" : "Kanal real-time belum terhubung");

  if (!data) {
    setHealth("health-freshness", "warn", "Belum ada data sensor");
    setHealth("health-values", "warn", "Belum dapat diperiksa");
    badge.className = "panel-tag tag-abu";
    badge.textContent = "Menunggu data";
    note.textContent = "Pastikan perangkat mengirim data ke tabel sensor dan konfigurasi Supabase sudah benar.";
    return;
  }

  const timestamp = data.timestamp ? new Date(data.timestamp) : null;
  const ageMs = timestamp && !Number.isNaN(timestamp.getTime()) ? Date.now() - timestamp.getTime() : null;
  const fresh = ageMs !== null && ageMs >= -60000 && ageMs <= 120000;
  setHealth("health-freshness", fresh ? "good" : "warn",
    ageMs === null ? "Timestamp tidak tersedia/invalid" :
    ageMs < -60000 ? "Timestamp berada di masa depan" :
    fresh ? "Diperbarui " + Math.max(0, Math.round(ageMs / 1000)) + " detik lalu" :
    "Data sudah lama (" + Math.round(ageMs / 60000) + " menit)");

  const height = Number(data.tinggi_air);
  const flow = Number(data.debit_air);
  const heightValid = data.tinggi_air !== null && data.tinggi_air !== "" && Number.isFinite(height) && height >= 0;
  const flowValid = data.debit_air !== null && data.debit_air !== "" && Number.isFinite(flow) && flow >= 0;
  const statusValid = ["aman", "waspada", "siaga", "bahaya"].includes(String(data.status ?? "").toLowerCase());
  const valuesValid = heightValid && flowValid && statusValid;
  setHealth("health-values", valuesValid ? "good" : "bad",
    valuesValid ? "Nilai terisi dan tidak negatif; status dikenali" :
    "Periksa tinggi, debit, atau label status dari perangkat");

  const ok = !!supabaseClient && realtimeConnected && fresh && valuesValid;
  badge.className = "panel-tag " + (ok ? "tag-hijau" : "tag-abu");
  badge.textContent = ok ? "Data tampak normal" : "Perlu pemeriksaan";
  if (note) {
    note.textContent = ok
      ? "Data diterima dengan baik dan masih baru. Ini belum membuktikan akurasi sensor; lakukan uji pembanding/kalibrasi untuk memastikan pembacaan benar."
      : "Belum semua pemeriksaan lulus. Periksa koneksi internet/Supabase, daya dan kabel sensor, format data, serta waktu pengiriman perangkat.";
  }
}

function renderSensor(data) {
  if (!data) return;
  lastSensorData = data;
  if (elTinggi) elTinggi.textContent = data.tinggi_air ?? "--";
  if (elDebit) elDebit.textContent = data.debit_air ?? "--";

  if (typeof window.setCurahHujan === "function") {
    window.setCurahHujan(tentukanLevelHujan(data[KOLOM_HUJAN]));
  }

  const rawStatus = String(data.status ?? "").trim();
  const normalizedStatus = rawStatus.toLowerCase() === "waspada" ? "Siaga" :
    rawStatus.toLowerCase() === "siaga" ? "Siaga" :
    rawStatus.toLowerCase() === "aman" ? "Aman" :
    rawStatus.toLowerCase() === "bahaya" ? "Bahaya" : (rawStatus || "--");
  if (elStatus) {
    elStatus.textContent = normalizedStatus;
    elStatus.classList.remove("status-aman", "status-waspada", "status-bahaya");
    if (normalizedStatus === "Aman") elStatus.classList.add("status-aman");
    else if (normalizedStatus === "Siaga") elStatus.classList.add("status-waspada");
    else if (normalizedStatus === "Bahaya") elStatus.classList.add("status-bahaya");
  }
  const ring = document.getElementById("status-ringkas-indikator");
  const ringLabel = document.getElementById("status-ringkas-label");
  const ringDesc = document.getElementById("status-ringkas-deskripsi");
  const ringBadge = document.getElementById("status-ringkas-badge");
  if (ring && ringLabel && ringDesc && ringBadge) {
    ring.classList.remove("status-menunggu", "status-aman", "status-siaga", "status-bahaya");
    const descriptions = {
      "Aman": "Pembacaan status menunjukkan kondisi normal.",
      "Siaga": "Perlu perhatian. Pantau perubahan ketinggian dan debit air.",
      "Bahaya": "Peringatan tinggi. Segera periksa kondisi lapangan dan ikuti prosedur keselamatan."
    };
    if (["Aman", "Siaga", "Bahaya"].includes(normalizedStatus)) {
      ring.classList.add("status-" + normalizedStatus.toLowerCase());
      ringLabel.textContent = normalizedStatus.toUpperCase();
      ringDesc.textContent = descriptions[normalizedStatus];
      ringBadge.textContent = normalizedStatus;
      ringBadge.className = "panel-tag " + (normalizedStatus === "Aman" ? "tag-hijau" : "tag-abu");
    } else {
      ring.classList.add("status-menunggu");
      ringLabel.textContent = "STATUS TIDAK DIKENAL";
      ringDesc.textContent = "Periksa nilai status yang dikirim perangkat sensor.";
      ringBadge.textContent = "Periksa data";
      ringBadge.className = "panel-tag tag-abu";
    }
  }
  const ts = data.timestamp ? new Date(data.timestamp) : null;
  if (ts && !Number.isNaN(ts.getTime())) {
    const jam = ts.toLocaleTimeString("id-ID");
    if (elTimestamp) elTimestamp.textContent = jam;
    if (elUpdate) elUpdate.textContent = "Terakhir update: " + jam;
  }
  updateSensorHealth(data);
}

async function loadSensor() {
  if (!supabaseClient) {
    if (elUpdate) elUpdate.textContent = "Konfigurasi Supabase belum diisi";
    updateSensorHealth(null);
    return;
  }
  const { data, error } = await supabaseClient.from("sensor").select("*").order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.error("Gagal membaca sensor:", error.message);
    if (elUpdate) elUpdate.textContent = "Gagal membaca data sensor";
    updateSensorHealth(null);
    return;
  }
  if (data) renderSensor(data);
  else updateSensorHealth(null);
}
loadSensor();

if (supabaseClient) {
  supabaseClient.channel("sensor-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "sensor" }, payload => {
      if (payload.new && Object.keys(payload.new).length) renderSensor(payload.new);
    })
    .subscribe(status => {
      realtimeConnected = status === "SUBSCRIBED";
      updateSensorHealth();
      if (elUpdate && status === "CHANNEL_ERROR") elUpdate.textContent = "Koneksi real-time bermasalah";
    });
}

// Memperbarui penilaian umur data walau perangkat tidak mengirim data baru.
setInterval(() => updateSensorHealth(), 15000);
