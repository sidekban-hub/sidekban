const ctxTinggi = document.getElementById("grafik-tinggi");
const ctxDebit = document.getElementById("grafik-debit");

function buatGrafik(canvas, warna, isi, awalDariNol) {
  const warnaTeks = "#94a3b8";
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: warna,
        backgroundColor: isi,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: warnaTeks, maxTicksLimit: 4, maxRotation: 0 }
        },
        y: {
          beginAtZero: awalDariNol,
          grid: { color: "rgba(148,163,184,0.25)" },
          ticks: { color: warnaTeks }
        }
      }
    }
  });
}

const grafikTinggi = ctxTinggi ? buatGrafik(ctxTinggi, "#378ADD", "rgba(55,138,221,0.12)", false) : null;
const grafikDebit = ctxDebit ? buatGrafik(ctxDebit, "#3B9A1E", "rgba(59,154,30,0.12)", true) : null;

async function loadRiwayatGrafik() {
  if (!supabaseClient || (!grafikTinggi && !grafikDebit)) return;

  const { data, error } = await supabaseClient
    .from("riwayat")
    .select("tinggi_air,debit_air,ts")
    .order("ts", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Gagal membaca riwayat:", error.message);
    return;
  }

  const entries = (data || []).reverse();
  const labels = entries.map(item => new Date(item.ts).toLocaleTimeString("id-ID"));

  if (grafikTinggi) {
    grafikTinggi.data.labels = labels;
    grafikTinggi.data.datasets[0].data = entries.map(item => item.tinggi_air);
    grafikTinggi.update();
  }

  if (grafikDebit) {
    grafikDebit.data.labels = labels;
    grafikDebit.data.datasets[0].data = entries.map(item => item.debit_air);
    grafikDebit.update();
  }
}

loadRiwayatGrafik();

if (supabaseClient) {
  supabaseClient.channel("riwayat-chart")
    .on("postgres_changes", { event: "*", schema: "public", table: "riwayat" }, loadRiwayatGrafik)
    .subscribe();
}