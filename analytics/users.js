(function () {
  var S = window.SCA;
  if (!S) return;

  function userStats(data, u) {
    var owned = (data.projects || []).filter(function (p) { return String(p.user_id) === String(u.id); });
    var email = String(u.email || "").toLowerCase().trim();
    var joined = (data.projects || []).filter(function (p) {
      return String(p.user_id) !== String(u.id) && (data.invites || []).some(function (iv) {
        return String(iv.project_id) === String(p.id) && iv.status === "Accepted" && String(iv.email || "").toLowerCase().trim() === email;
      });
    });
    var comments = S.commentsForUser(data, u.id);
    var lastAct = S.lastActivityOfUser(data, null, u.id);
    if (comments.length) {
      var latestC = comments.reduce(function (a, b) { return new Date(a.created_at) > new Date(b.created_at) ? a : b; });
      if (!lastAct || new Date(latestC.created_at) > new Date(lastAct)) lastAct = latestC.created_at;
    }
    return { owned: owned, joined: joined, comments: comments, lastAct: lastAct };
  }

  function renderKpis(data) {
    var activeCount = 0;
    var cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
    (data.profiles || []).forEach(function (u) { if (new Date(u.created_at) >= cutoff30) activeCount++; });
    var boxes = [
      { label: "Total Accounts", value: (data.profiles || []).length, sub: "registered" },
      { label: "New (30 days)", value: activeCount, sub: "recent sign-ups" },
      { label: "With Activity", value: (data.profiles || []).filter(function (u) { return S.lastActivityOfUser(data, null, u.id); }).length, sub: "comments or notifications" }
    ];
    document.getElementById("userKpis").innerHTML = boxes.map(function (b) {
      return '<div class="info-box"><div class="ib-label">' + S.esc(b.label) + '</div>' +
        '<div class="ib-value">' + S.esc(b.value) + "<small> " + S.esc(b.sub) + "</small></div></div>";
    }).join("");
  }

  function goUser(id) { window.location.href = "user.html?id=" + encodeURIComponent(id); }

  function renderUsers(data) {
    var tb = document.getElementById("usersTable");
    var users = (data.profiles || []).slice();
    if (!users.length) { tb.innerHTML = '<tr><td colspan="8" class="muted">No users yet.</td></tr>'; return; }
    users.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    tb.innerHTML = users.map(function (u) {
      var s = userStats(data, u);
      var name = u.full_name || u.email;
      return '<tr class="row-link" data-id="' + S.esc(u.id) + '">' +
        '<td><div class="user-cell"><div class="avatar">' + S.esc(S.initialsOf(u)) + "</div><strong>" + S.esc(name) + "</strong></div></td>" +
        "<td>" + S.esc(u.company_name || "—") + "</td>" +
        "<td>" + S.esc(u.email) + "</td>" +
        '<td class="num">' + s.owned.length + "</td>" +
        '<td class="num">' + s.joined.length + "</td>" +
        '<td class="num">' + s.comments.length + "</td>" +
        "<td>" + S.fmtDate(u.created_at) + "</td>" +
        "<td>" + (s.lastAct ? S.fmtDateTime(s.lastAct) : '<span class="muted">Never</span>') + "</td>" +
        "</tr>";
    }).join("");
    tb.querySelectorAll("tr.row-link").forEach(function (tr) {
      tr.addEventListener("click", function () { goUser(tr.getAttribute("data-id")); });
    });
  }

  S.boot("users.html", function (data) {
    renderKpis(data);
    renderUsers(data);
  });
})();