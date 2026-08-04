(function () {
  var S = window.SCA;
  if (!S) return;

  function statsFor(data, p) {
    var files = S.drawingsForProject(data, p.id).length;
    var comments = S.commentsForProject(data, p.id).length;
    var members = S.membersOfProject(data, p);
    var activeCount = members.filter(function (m) { return m.status === "Accepted" || m.status === "Admin"; }).length;
    return { files: files, comments: comments, members: activeCount };
  }

  var storageMap = {};

  function fmtSize(bytes) {
    if (!bytes) return "0 MB";
    return S.fmtBytes(bytes);
  }

  function renderKpis(data) {
    var projects = data.projects || [];
    var totalFiles = 0, totalComments = 0, totalMembers = 0, totalBytes = 0;
    projects.forEach(function (p) {
      var s = statsFor(data, p);
      totalFiles += s.files; totalComments += s.comments; totalMembers += s.members;
      totalBytes += storageMap[p.id] || 0;
    });
    var boxes = [
      { label: "Active Projects", value: projects.length, sub: "currently running" },
      { label: "Total Files", value: totalFiles, sub: "across these projects" },
      { label: "Total Storage", value: S.fmtBytes(totalBytes), sub: "DB-tracked files", gold: true },
      { label: "Total Comments", value: totalComments, sub: "across these projects" },
      { label: "Active Members", value: totalMembers, sub: "owners + accepted" }
    ];
    document.getElementById("projectKpis").innerHTML = boxes.map(function (b) {
      return '<div class="info-box" style="' + (b.gold ? "border-left-color:var(--gold);" : "") + '"><div class="ib-label">' + S.esc(b.label) + '</div>' +
        '<div class="ib-value">' + S.esc(b.value) + '<small> ' + S.esc(b.sub) + "</small>" + "</div></div>";
    }).join("");
  }

  function goProject(id) { window.location.href = "project.html?id=" + encodeURIComponent(id); }

  function renderTable(data) {
    var projects = data.projects || [];
    var fs = document.getElementById("projectsTable");
    if (!projects.length) {
      fs.innerHTML = '<tr><td colspan="9" class="muted">No active projects yet.</td></tr>';
      return;
    }
    fs.innerHTML = projects.map(function (p) {
      var s = statsFor(data, p);
      return '<tr class="row-link" data-id="' + S.esc(p.id) + '">' +
        "<td><strong>" + S.esc(p.name) + "</strong></td>" +
        "<td>" + S.esc(p.location || "—") + "</td>" +
        "<td>" + S.esc(p.project_type || "—") + "</td>" +
        '<td class="num">' + s.files + "</td>" +
        '<td class="num">' + fmtSize(storageMap[p.id]) + "</td>" +
        '<td class="num">' + s.comments + "</td>" +
        '<td class="num">' + s.members + "</td>" +
        "<td>" + S.fmtDate(p.created_at) + "</td>" +
        '<td class="num chev">›</td>' +
        "</tr>";
    }).join("");
    var rows = fs.querySelectorAll("tr.row-link");
    rows.forEach(function (tr) {
      tr.addEventListener("click", function () { goProject(tr.getAttribute("data-id")); });
    });
  }

  function loadStorage(data) {
    return S.loadStorage(true, S.buildValidPaths(data.drawings)).then(function (st) {
      storageMap = st.bytesByProject || {};
      renderKpis(data);
      renderTable(data);
    }).catch(function () {
      storageMap = {};
    });
  }

  S.boot("projects.html", function (data) {
    renderKpis(data);
    renderTable(data);
    loadStorage(data);
  });
})();