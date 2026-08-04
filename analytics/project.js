(function () {
  var S = window.SCA;
  if (!S) return;

  function getProjectId() {
    var m = /[?&]id=([^&]+)/.exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function renderStorage(data, p) {
    S.loadStorage(true, S.buildValidPaths(data.drawings)).then(function (st) {
      var subEl = document.getElementById("storageSub");
      if (!subEl) return;
      var pId = String(p.id);
      if (st.error) {
        subEl.textContent = "Storage unavailable: " + st.error;
        S.makeChart("chartStorage", { type: "bar", data: { labels: ["—"], datasets: [{ data: [0], backgroundColor: "#eceff1" }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        return;
      }
      var bucketBytes = st.bytesByProject || {};
      var projBytes = bucketBytes[pId] || 0;
      if (projBytes <= 0) {
        subEl.textContent = "No storage usage for this project.";
        S.makeChart("chartStorage", { type: "bar", data: { labels: ["—"], datasets: [{ data: [0], backgroundColor: "#eceff1" }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
        return;
      }
      var files = S.drawingsForProject(data, p.id);
      var avg = files.length > 0 ? projBytes / files.length : 0;
      subEl.textContent = S.fmtBytes(projBytes) + " total \u00b7 " + files.length + " files \u00b7 avg " + S.fmtBytes(avg);

      var folderMap = st.bytesByFolder || {};
      var levels = Object.keys(folderMap).filter(function (path) {
        return String(path).split("/")[0] === pId;
      });
      var labels = levels.map(function (path) {
        var parts = String(path).split("/");
        return parts.length > 1 ? S.cleanDiscipline(parts[1]) : "(root)";
      });
      var values = levels.map(function (path) { return folderMap[path]; });

      S.makeChart("chartStorage", {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Size",
            data: values,
            backgroundColor: S.GREEN,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: "y",
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: function (ctx) { return " " + S.fmtBytes(ctx.parsed.x || 0); } } }
          },
          scales: { x: { beginAtZero: true } }
        }
      });
    });
  }

  function headerGear(data, p) {
    document.getElementById("projTitle").textContent = p.name || "Project";
    var badge = document.getElementById("projBadge");
    var st = (p.status || "Active").toLowerCase();
    badge.textContent = st === "deleted" || st === "deleted_projects" ? "DELETED" : "ACTIVE";
    badge.className = "badge " + (st === "deleted" || st === "deleted_projects" ? "deleted" : "active");
    document.getElementById("projSub").textContent = [p.location, p.project_type, "created " + S.fmtDate(p.created_at)].filter(Boolean).join("  \u00b7  ");
  }

  function renderKpis(data, p) {
    var files = S.drawingsForProject(data, p.id);
    var comments = S.commentsForProject(data, p.id);
    var notif = S.notificationsForProject(data, p.id);
    var members = S.membersOfProject(data, p);
    var accepted = members.filter(function (m) { return m.status === "Accepted" || m.status === "Admin"; }).length;
    var invited = members.filter(function (m) { return m.status !== "Accepted" && m.status !== "Admin"; }).length;

    var lastAct = null;
    files.forEach(function (f) { if (!lastAct || new Date(f.created_at) > new Date(lastAct)) lastAct = f.created_at; });
    comments.forEach(function (c) { if (!lastAct || new Date(c.created_at) > new Date(lastAct)) lastAct = c.created_at; });
    notif.forEach(function (n) { if (!lastAct || new Date(n.created_at) > new Date(lastAct)) lastAct = n.created_at; });

    var discMap = S.uploadCountsByDiscipline(data, p.id);
    var strongDiscs = Object.keys(discMap).filter(function (d) { return discMap[d] >= 5; }).join(", ");

    var boxes = [
      { label: "Files", value: files.length, sub: "total uploads" },
      { label: "Comments", value: comments.length, sub: "all-time" },
      { label: "Active Members", value: accepted, sub: invited ? invited + " still invited" : "owners + accepted" },
      { label: "Disciplines", value: Object.keys(discMap).length, sub: strongDiscs || "—" },
      { label: "Last Interaction", value: S.timeAgo(lastAct), sub: S.fmtDateTime(lastAct) }
    ];
    document.getElementById("projKpis").innerHTML = boxes.map(function (b) {
      return '<div class="info-box"><div class="ib-label">' + S.esc(b.label) + '</div>' +
        '<div class="ib-value">' + S.esc(b.value) + '<small> ' + S.esc(b.sub) + "</small>" + "</div></div>";
    }).join("");
  }

  function renderDiscChart(data, p) {
    var discMap = S.uploadCountsByDiscipline(data, p.id);
    var entries = Object.keys(discMap).sort(function (a, b) { return discMap[b] - discMap[a]; });
    S.makeChart("chartDisc", {
      type: "doughnut",
      data: {
        labels: entries,
        datasets: [{
          data: entries.map(function (d) { return discMap[d]; }),
          backgroundColor: S.PALETTE,
          borderWidth: 2
        }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "right" } } }
    });
  }

  function renderTimeline(data, p) {
    var files = S.drawingsForProject(data, p.id);
    var comments = S.commentsForProject(data, p.id);
    var fSeries = S.buildMonthlySeries(files, function (f) { return f.created_at; });
    var cSeries = S.buildMonthlySeries(comments, function (c) { return c.created_at; });
    var labels = Array.from(new Set(fSeries.labels.concat(cSeries.labels))).sort();
    function vals(series) {
      return labels.map(function (l) {
        var i = series.labels.indexOf(l);
        return i === -1 ? 0 : series.values[i];
      });
    }
    S.makeChart("chartTimeline", {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Files", data: vals(fSeries), backgroundColor: S.GREEN, borderRadius: 3 },
          { label: "Comments", data: vals(cSeries), backgroundColor: S.GOLD, borderRadius: 3 }
        ]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true, stacked: false, ticks: { precision: 0 } } } }
    });
  }

  function renderMembers(data, p) {
    var members = S.membersOfProject(data, p);
    var discMap = S.uploadCountsByDiscipline(data, p.id);
    var tb = document.getElementById("membersTable");
    if (!members.length) {
      tb.innerHTML = '<tr><td colspan="8" class="muted">No members yet.</td></tr>';
      return;
    }
    tb.innerHTML = members.map(function (m) {
      var comments = S.commentsForUser(data, m.userId).filter(function (c) { return String(c.project_id) === String(p.id); }).length;
      var files = (m.role !== "Admin" ? (discMap[m.role] || 0) : null);
      var lastAct = S.lastActivityOfUser(data, p.id, m.userId);
      var isGold = m.kind === "Admin";
      var badgeCls = m.status === "Accepted" ? "member" : (m.status === "Admin" ? "active" : "invited");
      return "<tr>" +
        '<td><div class="user-cell"><div class="avatar' + (isGold ? " gold" : "") + '">' + S.esc(S.initialsOf({ full_name: m.name, email: m.email })) + "</div><strong>" + S.esc(m.name) + "</strong></div></td>" +
        "<td>" + S.esc(m.email || "—") + "</td>" +
        "<td>" + S.esc(m.role || "—") + "</td>" +
        '<td><span class="badge ' + badgeCls + '">' + S.esc(m.status) + "</span></td>" +
        '<td class="num">' + comments + "</td>" +
        '<td class="num">' + (files === null ? "—" : (S.fmtNum(files))) + "</td>" +
        "<td>" + S.fmtDate(m.joined) + "</td>" +
        "<td>" + (lastAct ? S.fmtDateTime(lastAct) + '<div style="font-size:11px;color:var(--muted);">' + S.timeAgo(lastAct) + "</div>" : '<span class="muted">No activity</span>') + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderFiles(data, p) {
    var files = S.drawingsForProject(data, p.id);
    var sorted = files.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var tb = document.getElementById("filesTable");
    if (!sorted.length) { tb.innerHTML = '<tr><td colspan="4" class="muted">No files yet.</td></tr>'; return; }
    tb.innerHTML = sorted.map(function (f) {
      return "<tr>" +
        "<td><strong>" + S.esc(f.drawing_name || "—") + "</strong></td>" +
        "<td>" + S.esc(S.cleanDiscipline(f.uploaded_by)) + "</td>" +
        '<td class="num">' + (f.revision_number != null ? f.revision_number : "—") + "</td>" +
        "<td>" + S.fmtDateTime(f.created_at) + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderComments(data, p) {
    var comments = S.commentsForProject(data, p.id);
    var sorted = comments.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var tb = document.getElementById("commentsTable");
    if (!sorted.length) { tb.innerHTML = '<tr><td colspan="4" class="muted">No comments yet.</td></tr>'; return; }
    tb.innerHTML = sorted.map(function (c) {
      var prof = S.profileById(data, c.user_id);
      var name = prof ? (prof.full_name || prof.email) : (c.user_id || "Unknown");
      return "<tr>" +
        '<td><div class="user-cell"><div class="avatar">' + S.esc(S.initialsOf(prof || { email: c.user_id })) + "</div><strong>" + S.esc(name) + "</strong></div></td>" +
        "<td>" + S.esc(c.drawing_name || "—") + "</td>" +
        "<td>" + S.esc((c.body || "").length > 90 ? (c.body.slice(0, 90) + "\u2026") : (c.body || "—")) + "</td>" +
        "<td>" + S.fmtDateTime(c.created_at) + "</td>" +
        "</tr>";
    }).join("");
  }

  S.boot("project.html", function (data) {
    var id = getProjectId();
    var p = S.projectById(data, id);
    if (!p) {
      document.getElementById("mainContent").innerHTML = '<div class="error-box">Project not found. <a href="projects.html" style="color:var(--green);font-weight:700;">Back to projects</a></div>';
      return;
    }
    headerGear(data, p);
    renderKpis(data, p);
    renderDiscChart(data, p);
    renderTimeline(data, p);
    renderMembers(data, p);
    renderFiles(data, p);
    renderComments(data, p);
    renderStorage(data, p);
  });
})();