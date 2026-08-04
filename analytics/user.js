(function () {
  var S = window.SCA;
  if (!S) return;

  function getUserId() {
    var m = /[?&]id=([^&]+)/.exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function headerGear(data, u) {
    document.getElementById("userAvatar").textContent = S.initialsOf(u);
    document.getElementById("userTitle").textContent = u.full_name || u.email || "User";
    document.getElementById("userSub").textContent = [u.company_name, u.email, "joined " + S.fmtDate(u.created_at)].filter(Boolean).join("  \u00b7  ");
  }

  function ownedProjects(data, u) {
    return (data.projects || []).filter(function (p) { return String(p.user_id) === String(u.id); });
  }

  function joinedProjects(data, u) {
    var email = String(u.email || "").toLowerCase().trim();
    return (data.projects || []).filter(function (p) {
      return String(p.user_id) !== String(u.id) && (data.invites || []).some(function (iv) {
        return String(iv.project_id) === String(p.id) && iv.status === "Accepted" && String(iv.email || "").toLowerCase().trim() === email;
      });
    });
  }

  function renderKpis(data, u) {
    var owned = ownedProjects(data, u);
    var joined = joinedProjects(data, u);
    var comments = S.commentsForUser(data, u.id);
    var lastAct = S.lastActivityOfUser(data, null, u.id);
    var boxes = [
      { label: "Projects Owned", value: owned.length, sub: "created by user" },
      { label: "Projects Joined", value: joined.length, sub: "accepted invites" },
      { label: "Comments", value: comments.length, sub: "all-time" },
      { label: "Last Activity", value: S.timeAgo(lastAct), sub: S.fmtDateTime(lastAct) }
    ];
    document.getElementById("userKpis").innerHTML = boxes.map(function (b) {
      return '<div class="info-box"><div class="ib-label">' + S.esc(b.label) + '</div>' +
        '<div class="ib-value">' + S.esc(b.value) + "<small> " + S.esc(b.sub) + "</small></div></div>";
    }).join("");
  }

  function renderProjects(data, u) {
    var tb = document.getElementById("userProjectsTable");
    var owned = ownedProjects(data, u);
    var joined = joinedProjects(data, u);
    var rows = owned.map(function (p) {
      return { p: p, role: "Admin", status: "Admin", since: p.created_at };
    });
    var email = String(u.email || "").toLowerCase().trim();
    joined.forEach(function (p) {
      (data.invites || []).forEach(function (iv) {
        if (String(iv.project_id) === String(p.id) && iv.status === "Accepted" && String(iv.email || "").toLowerCase().trim() === email) {
          var discName = "Viewer";
          (data.disciplines || []).forEach(function (dd) { if (String(dd.id) === String(iv.discipline_id)) discName = dd.name; });
          rows.push({ p: p, role: discName, status: "Member", since: iv.created_at });
        }
      });
    });
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="7" class="muted">User is not part of any project yet.</td></tr>'; return; }
    tb.innerHTML = rows.map(function (r) {
      var comments = S.commentsForProject(data, r.p.id).filter(function (c) { return String(c.user_id) === String(u.id); }).length;
      return '<tr class="row-link" data-id="' + S.esc(r.p.id) + '">' +
        "<td><strong>" + S.esc(r.p.name) + "</strong></td>" +
        "<td>" + S.esc(r.p.location || "—") + "</td>" +
        "<td>" + S.esc(r.p.project_type || "—") + "</td>" +
        "<td>" + S.esc(r.role) + "</td>" +
        '<td><span class="badge ' + (r.status === "Admin" ? "active" : "member") + '">' + S.esc(r.status) + "</span></td>" +
        "<td>" + S.fmtDate(r.since) + "</td>" +
        '<td class="num">' + comments + "</td>" +
        "</tr>";
    }).join("");
    tb.querySelectorAll("tr.row-link").forEach(function (tr) {
      tr.addEventListener("click", function () { window.location.href = "project.html?id=" + encodeURIComponent(tr.getAttribute("data-id")); });
    });
  }

  function renderComments(data, u) {
    var tb = document.getElementById("userCommentsTable");
    var comments = S.commentsForUser(data, u.id).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    if (!comments.length) { tb.innerHTML = '<tr><td colspan="4" class="muted">No comments yet.</td></tr>'; return; }
    tb.innerHTML = comments.slice(0, 20).map(function (c) {
      var p = S.projectById(data, c.project_id);
      return "<tr>" +
        "<td><strong>" + S.esc(c.drawing_name || "—") + "</strong></td>" +
        "<td>" + S.esc(p ? p.name : "deleted project") + "</td>" +
        "<td>" + S.esc((c.body || "").length > 90 ? (c.body.slice(0, 90) + "\u2026") : (c.body || "—")) + "</td>" +
        "<td>" + S.fmtDateTime(c.created_at) + "</td>" +
        "</tr>";
    }).join("");
  }

  S.boot("user.html", function (data) {
    var id = getUserId();
    var u = S.profileById(data, id);
    if (!u) {
      document.getElementById("mainContent").innerHTML = '<div class="error-box">User not found. <a href="users.html" style="color:var(--green);font-weight:700;">Back to users</a></div>';
      return;
    }
    headerGear(data, u);
    renderKpis(data, u);
    renderProjects(data, u);
    renderComments(data, u);
  });
})();