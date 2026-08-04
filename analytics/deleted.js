(function () {
  var S = window.SCA;
  if (!S) return;

  function renderKpis(data) {
    var del = data.deleted || [];
    var totalFiles = 0, totalMembers = 0;
    del.forEach(function (d) {
      totalFiles += (d.file_count || 0);
      totalMembers += (d.member_count || 0);
    });
    var lastDel = del.reduce(function (a, b) {
      if (!a) return b;
      return new Date(b.deleted_at) > new Date(a.deleted_at) ? b : a;
    }, null);
    var boxes = [
      { label: "Deleted Projects", value: del.length, sub: "removed workspaces" },
      { label: "Files Removed", value: totalFiles, sub: "associated files" },
      { label: "Members Affected", value: totalMembers, sub: "across deleted projects" },
      { label: "Last Deletion", value: lastDel ? S.timeAgo(lastDel.deleted_at) : "—", sub: lastDel ? S.fmtDate(lastDel.deleted_at) : "" }
    ];
    document.getElementById("deletedKpis").innerHTML = boxes.map(function (b) {
      return '<div class="info-box"><div class="ib-label">' + S.esc(b.label) + '</div>' +
        '<div class="ib-value">' + S.esc(b.value) + "<small> " + S.esc(b.sub) + "</small></div></div>";
    }).join("");
  }

  function renderDeleted(data) {
    var tb = document.getElementById("deletedTable");
    var del = (data.deleted || []).slice().sort(function (a, b) { return new Date(b.deleted_at) - new Date(a.deleted_at); });
    if (!del.length) { tb.innerHTML = '<tr><td colspan="6" class="muted">No deleted projects.</td></tr>'; return; }
    tb.innerHTML = del.map(function (d) {
      return "<tr>" +
        "<td><strong>" + S.esc(d.project_name || "—") + "</strong><div style=\"font-size:11px;color:var(--muted);\">" + S.esc(d.project_location || "") + "</div></td>" +
        "<td>" + S.esc(d.project_type || "—") + "</td>" +
        "<td>" + S.esc(d.admin_email || "—") + "</td>" +
        '<td class="num">' + (d.member_count || 0) + "</td>" +
        '<td class="num">' + (d.file_count || 0) + "</td>" +
        "<td>" + S.fmtDateTime(d.deleted_at) + "</td>" +
        "</tr>";
    }).join("");
  }

  S.boot("deleted.html", function (data) {
    renderKpis(data);
    renderDeleted(data);
  });
})();