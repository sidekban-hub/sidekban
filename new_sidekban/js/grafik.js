const URUTAN_LEVEL_HUJAN = ["tidak-hujan", "gerimis", "deras"];
const NAMA_LEVEL_HUJAN = {
  "tidak-hujan": "Tidak hujan",
  "gerimis": "Gerimis",
  "deras": "Deras"
};

window.setCurahHujan = function (level) {
  const badge = document.getElementById("hujan-badge");
  const segmen = document.querySelectorAll("#hujan-bar .hujan-seg");
  const label = document.querySelectorAll("#hujan-label span");
  const indeks = URUTAN_LEVEL_HUJAN.indexOf(level);

  segmen.forEach((el, i) => el.classList.toggle("aktif", indeks >= 0 && i <= indeks));
  label.forEach(el => el.classList.toggle("aktif", el.dataset.level === level));

  if (badge) {
    badge.textContent = indeks >= 0 ? NAMA_LEVEL_HUJAN[level] : "--";
    badge.className = "hujan-badge " + (indeks >= 0 ? "hujan-" + level : "hujan-none");
  }
};

// ===== Grafik ketinggian dan debit =====
(function () {
  if (typeof Chart === "undefined") {
    console.error("Chart.js belum dimuat.");
    return;
  }
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    console.error("Supabase belum tersedia. Periksa js/supabase-config.js.");
    return;
  }

  const MAX_TITIK = 30;
  let kunciTerakhir = null;

  function buatGrafik(idCanvas, nama, warna, satuan) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return null;

    return new Chart(canvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: nama,
          data: [],
          borderColor: warna,
          backgroundColor: warna + "22",
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
          y: { beginAtZero: true, title: { display: true, text: satuan } }
        }
      }
    });
  }

  const grafikTinggi = buatGrafik("grafik-tinggi", "Ketinggian air", "#2563eb", "cm");
  const grafikDebit = buatGrafik("grafik-debit", "Debit air", "#16a34a", "L/min");

  function tambah(grafik, label, nilai) {
    if (!grafik) return;
    grafik.data.labels.push(label);
    grafik.data.datasets[0].data.push(Number.isFinite(nilai) ? nilai : null);
    while (grafik.data.labels.length > MAX_TITIK) {
      grafik.data.labels.shift();
      grafik.data.datasets[0].data.shift();
    }
  }

  function tambahTitik(baris) {
    if (!baris) return;
    const kunci = String(baris.id ?? "") + "|" + String(baris.timestamp ?? "");
    if (kunci === kunciTerakhir) return;
    kunciTerakhir = kunci;

    const waktu = baris.timestamp ? new Date(baris.timestamp) : null;
    const label = waktu && !Number.isNaN(waktu.getTime())
      ? waktu.toLocaleTimeString("id-ID")
      : "--";

    tambah(grafikTinggi, label, Number(baris.tinggi_air));
    tambah(grafikDebit, label, Number(baris.debit_air));
  }

  function perbarui() {
    [grafikTinggi, grafikDebit].forEach(g => g && g.update("none"));
  }

  async function muatRiwayat() {
    const { data, error } = await supabaseClient
      .from("sensor")
      .select("*")
      .order("id", { ascending: false })
      .limit(MAX_TITIK);

    if (error) {
      console.error("Gagal memuat riwayat grafik:", error.message);
      return;
    }
    (data || []).reverse().forEach(tambahTitik);
    perbarui();
  }

  muatRiwayat();

  supabaseClient
    .channel("grafik-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "sensor" }, payload => {
      if (payload.new && Object.keys(payload.new).length) {
        tambahTitik(payload.new);
        perbarui();
      }
    })
    .subscribe();
})();