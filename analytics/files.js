(function () {
  var S = window.SCA;
  if (!S) return;

  function renderKpis(data) {
    var drawings = data.drawings || [];
    var cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
    var recent30 = 0, lastMonth = null;
    drawings.forEach(function (d) {
      var t = new Date(d.created_at);
      if (t >= cutoff30) recent30++;
      if (!lastMonth || t > new Date(lastMonth)) lastMonth = d.created_at;
    });
    var discs = {};
    drawings.forEach(function (d) { discs[S.cleanDiscipline(d.uploaded_by)] = true; });
    var lastActivity = 0;
    drawings.forEach(function (d) { var t = new Date(d.created_at); if (t > lastActivity) lastActivity = t; });
    var boxes = [
      { label: "Total Files", value: drawings.length, sub: "all-time uploads" },
      { label: "Uploaded (30 days)", value: recent30, sub: "recent" },
      { label: "Disciplines", value: Object.keys(discs).length, sub: "distinct" },
      { label: "Last Upload", value: S.timeAgo(lastActivity), sub: S.fmtDateTime(lastActivity) }
    ];
    document.getElementById("fileKpis").innerHTML = boxes.map(function (b) {
      return '<div class="info-box"><div class="ib-label">' + S.esc(b.label) + '</div>' +
        '<div class="ib-value">' + S.esc(b.value) + "<small> " + S.esc(b.sub) + "</small></div></div>";
    }).join("");
  }

  function renderDiscChart(data) {
    var counts = {};
    (data.drawings || []).forEach(function (d) {
      var disc = S.cleanDiscipline(d.uploaded_by);
      counts[disc] = (counts[disc] || 0) + 1;
    });
    var entries = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    S.makeChart("chartDiscAll", {
      type: "doughnut",
      data: {
        labels: entries,
        datasets: [{ data: entries.map(function (d) { return counts[d]; }), backgroundColor: S.PALETTE, borderWidth: 2 }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "right" } } }
    });
  }

  function renderUploadsChart(data) {
    var series = S.buildMonthlySeries(data.drawings || [], function (d) { return d.created_at; });
    S.makeChart("chartUploads", {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [{
          label: "Files",
          data: series.values,
          borderColor: S.GREEN,
          backgroundColor: "rgba(23,104,79,0.12)",
          fill: true,
          tension: 0.35
        }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  function renderFiles(data) {
    var tb = document.getElementById("filesTable");
    var sorted = (data.drawings || []).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    if (!sorted.length) { tb.innerHTML = '<tr><td colspan="4" class="muted">No files yet.</td></tr>'; return; }
    tb.innerHTML = sorted.slice(0, 40).map(function (f) {
      var p = S.projectById(data, f.project_id);
      return '<tr class="row-link" data-id="' + S.esc(f.project_id) + '">' +
        "<td><strong>" + S.esc(f.drawing_name || "—") + "</strong></td>" +
        "<td>" + S.esc(S.cleanDiscipline(f.uploaded_by)) + "</td>" +
        "<td>" + S.esc(p ? p.name : "deleted project") + "</td>" +
        "<td>" + S.fmtDateTime(f.created_at) + "</td>" +
        "</tr>";
    }).join("");
    tb.querySelectorAll("tr.row-link").forEach(function (tr) {
      tr.addEventListener("click", function () { window.location.href = "project.html?id=" + encodeURIComponent(tr.getAttribute("data-id")); });
    });
  }

  S.boot("files.html", function (data) {
    renderKpis(data);
    renderDiscChart(data);
    renderUploadsChart(data);
    renderFiles(data);
  });
})();