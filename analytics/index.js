(function () {
  var S = window.SCA;
  if (!S) return;

  function kpis(data) {
    var cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);

    var newUsers = 0;
    (data.profiles || []).forEach(function (u) { if (new Date(u.created_at) >= cutoff30) newUsers++; });

    var activeUserIds = {};
    (data.notifications || []).forEach(function (n) {
      if (new Date(n.created_at) >= cutoff30 && n.user_id) activeUserIds[n.user_id] = true;
    });

    var filesByProject = (data.drawings || []).reduce(function (m, d) { m[d.project_id] = (m[d.project_id] || 0) + 1; return m; }, {});
    var fileCount = Object.keys(filesByProject).reduce(function (a, k) { return a + filesByProject[k]; }, 0);

    return {
      totalUsers: (data.profiles || []).length,
      newUsers30: newUsers,
      activeUsers: Object.keys(activeUserIds).length,
      activeProjects: (data.projects || []).length,
      deletedProjects: (data.deleted || []).length,
      totalProjects: (data.projects || []).length + (data.deleted || []).length,
      totalFiles: fileCount,
      totalComments: (data.comments || []).length,
      totalInvites: (data.invites || []).length
    };
  }

  function renderKpis(data) {
    var k = kpis(data);
    var defs = [
      { label: "Total Users", value: k.totalUsers, sub: k.newUsers30 + " new in last 30 days", gold: false },
      { label: "Monthly Active Users", value: k.activeUsers, sub: "active in last 30 days", gold: true },
      { label: "Active Projects", value: k.activeProjects, sub: "currently running", gold: false },
      { label: "Total Projects", value: k.totalProjects, sub: k.deletedProjects + " deleted", gold: false },
      { label: "Total Files", value: k.totalFiles, sub: "all-time uploads", gold: false },
      { label: "Total Comments", value: k.totalComments, sub: "all-time comments", gold: false },
      { label: "Total Invites", value: k.totalInvites, sub: "sent to consultants", gold: false }
    ];
    document.getElementById("kpiGrid").innerHTML = defs.map(function (d) {
      return '<div class="kpi' + (d.gold ? " gold" : "") + '">' +
        '<div class="kpi-label">' + S.esc(d.label) + '</div>' +
        '<div class="kpi-value">' + d.value + '</div>' +
        (d.sub ? '<div class="kpi-sub">' + S.esc(d.sub) + "</div>" : "") +
        "</div>";
    }).join("");
  }

  function renderQuick(data) {
    var k = kpis(data);
    var segments = [
      { label: "Active Projects", value: k.activeProjects, href: "projects.html", sub: "view & drill in" },
      { label: "Deleted Projects", value: k.deletedProjects, href: "deleted.html", sub: "archive" },
      { label: "Files Uploaded", value: k.totalFiles, href: "files.html", sub: "all-time" },
      { label: "User Accounts", value: k.totalUsers, href: "users.html", sub: "all sign-ups" },
      { label: "Data Sync", value: S.fmtDate(new Date(data.ts)), href: "sync.html", sub: "freshness & sources" }
    ];
    document.getElementById("quickGrid").innerHTML = segments.map(function (s) {
      return '<a href="' + s.href + '" style="text-decoration:none;color:inherit;">' +
        '<div class="kpi" style="cursor:pointer;">' +
        '<div class="kpi-label">' + S.esc(s.label) + '</div>' +
        '<div class="kpi-value">' + S.esc(s.value) + '</div>' +
        '<div class="kpi-sub">' + S.esc(s.sub) + ' &rsaquo;</div>' +
        "</div></a>";
    }).join("");
  }

  function renderCharts(data) {
    var projects = data.projects || [];

    var growth = S.buildMonthlySeries(data.profiles || [], function (u) { return u.created_at; });
    S.makeChart("chartGrowth", {
      type: "line",
      data: {
        labels: growth.labels,
        datasets: [{
          label: "Total users",
          data: S.cumulative(growth.values),
          borderColor: S.GREEN,
          backgroundColor: "rgba(23,104,79,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 3
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    var typeCount = {};
    projects.forEach(function (p) {
      var t = p.project_type || "Unspecified";
      typeCount[t] = (typeCount[t] || 0) + 1;
    });
    var typeLabels = Object.keys(typeCount);
    S.makeChart("chartTypes", {
      type: "doughnut",
      data: {
        labels: typeLabels,
        datasets: [{
          data: typeLabels.map(function (t) { return typeCount[t]; }),
          backgroundColor: S.PALETTE,
          borderWidth: 2
        }]
      },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "right" } } }
    });

    var filesByProject = (data.drawings || []).reduce(function (m, d) { m[d.project_id] = (m[d.project_id] || 0) + 1; return m; }, {});
    var withFiles = projects.map(function (p) { return { name: p.name, n: filesByProject[p.id] || 0, id: p.id }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    S.makeChart("chartFiles", {
      type: "bar",
      data: {
        labels: withFiles.map(function (x) { return x.name; }),
        datasets: [{
          label: "Files",
          data: withFiles.map(function (x) { return x.n; }),
          backgroundColor: S.GREEN,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      },
      onClick: function (ev, el) {
        if (el && el.length) window.location.href = "project.html?id=" + withFiles[el[0].index].id;
      }
    });

    var commentsByProject = (data.comments || []).reduce(function (m, c) { m[c.project_id] = (m[c.project_id] || 0) + 1; return m; }, {});
    var withComments = projects.map(function (p) { return { name: p.name, n: commentsByProject[p.id] || 0, id: p.id }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    S.makeChart("chartComments", {
      type: "bar",
      data: {
        labels: withComments.map(function (x) { return x.name; }),
        datasets: [{
          label: "Comments",
          data: withComments.map(function (x) { return x.n; }),
          backgroundColor: S.GOLD,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      },
      onClick: function (ev, el) {
        if (el && el.length) window.location.href = "project.html?id=" + withComments[el[0].index].id;
      }
    });
  }

  function renderActivity(data) {
    var feed = [];
    (data.drawings || []).forEach(function (d) {
      feed.push({
        t: d.created_at,
        type: "upload",
        html: '<span class="pill upload">Upload</span><strong>' + S.esc(S.cleanDiscipline(d.uploaded_by)) +
              '</strong> added "' + S.esc(d.drawing_name) + '" &middot; ' + S.esc(projectName(data, d.project_id))
      });
    });
    (data.comments || []).forEach(function (c) {
      var prof = S.profileById(data, c.user_id);
      var name = prof ? (prof.full_name || prof.email) : (c.user_id || "Unknown");
      feed.push({
        t: c.created_at,
        type: "comment",
        html: '<span class="pill comment">Comment</span><strong>' + S.esc(name) + '</strong> on "' + S.esc(c.drawing_name) +
              '" &middot; ' + S.esc(projectName(data, c.project_id))
      });
    });
    (data.notifications || []).forEach(function (n) {
      feed.push({
        t: n.created_at,
        type: "activity",
        html: '<span class="pill activity">Activity</span>' + S.esc(n.body || "")
      });
    });
    feed.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
    var items = feed.slice(0, 18);
    var feedEl = document.getElementById("activityFeed");
    if (!items.length) {
      feedEl.innerHTML = '<li class="empty-note">No activity yet.</li>';
      return;
    }
    var names = {};
    (data.profiles || []).forEach(function (p) { names[p.id] = p.full_name || p.email; });
    feedEl.innerHTML = items.map(function (f) {
      return "<li>" +
        '<div class="a-avatar"><div class="avatar">SC</div></div>' +
        '<div class="a-body">' + f.html + '<div class="a-meta">' + S.fmtDateTime(f.t) + "</div></div>" +
        '<div class="a-time">' + S.timeAgo(f.t) + "</div>" +
        "</li>";
    }).join("");
  }

  function projectName(data, id) {
    var p = S.projectById(data, id);
    return p ? p.name : "deleted project";
  }

  S.boot("index.html", function (data) {
    renderKpis(data);
    renderQuick(data);
    renderCharts(data);
    renderActivity(data);
  });
})();