(function () {
  var S = window.SCA;
  if (!S) return;

  function newest(items, accessor) {
    var latest = null;
    items.forEach(function (it) {
      var t = accessor(it);
      if (t && (!latest || new Date(t) > new Date(latest))) latest = t;
    });
    return latest;
  }

  function renderKpis(data) {
    var lastAny = Math.max(
      new Date(newest(data.profiles || [], function (u) { return u.created_at; }) || 0),
      new Date(newest(data.projects || [], function (p) { return p.created_at; }) || 0),
      new Date(newest(data.drawings || [], function (d) { return d.created_at; }) || 0),
      new Date(newest(data.comments || [], function (c) { return c.created_at; }) || 0),
      new Date(newest(data.deleted || [], function (d) { return d.deleted_at; }) || 0)
    );
    var boxes = [
      { label: "Data Snapshot", value: S.fmtDateTime(new Date(data.ts)), sub: "loaded at this time" },
      { label: "Newest Activity", value: lastAny > 0 ? S.timeAgo(new Date(lastAny)) : "—", sub: lastAny > 0 ? S.fmtDateTime(new Date(lastAny)) : "no data yet" }
    ];
    document.getElementById("syncKpis").innerHTML = boxes.map(function (b) {
      return '<div class="info-box"><div class="ib-label">' + S.esc(b.label) + '</div>' +
        '<div class="ib-value">' + S.esc(b.value) + "<small> " + S.esc(b.sub) + "</small></div></div>";
    }).join("");
  }

  function renderTable(data) {
    var sources = [
      { table: "profiles", label: "User Accounts", rows: (data.profiles || []).length, newest: newest(data.profiles || [], function (u) { return u.created_at; }) },
      { table: "projects", label: "Active Projects", rows: (data.projects || []).length, newest: newest(data.projects || [], function (p) { return p.created_at; }) },
      { table: "deleted_projects", label: "Deleted Archive", rows: (data.deleted || []).length, newest: newest(data.deleted || [], function (d) { return d.deleted_at; }) },
      { table: "project_drawings", label: "Files", rows: (data.drawings || []).length, newest: newest(data.drawings || [], function (d) { return d.created_at; }) },
      { table: "drawing_comments", label: "Comments", rows: (data.comments || []).length, newest: newest(data.comments || [], function (c) { return c.created_at; }) },
      { table: "project_invitations", label: "Invitations", rows: (data.invites || []).length, newest: newest(data.invites || [], function (i) { return i.created_at; }) },
      { table: "notifications", label: "Notifications", rows: (data.notifications || []).length, newest: newest(data.notifications || [], function (n) { return n.created_at; }) },
      { table: "project_disciplines", label: "Disciplines", rows: (data.disciplines || []).length, newest: newest(data.disciplines || [], function (d) { return d.created_at; }) }
    ];
    var tb = document.getElementById("syncTable");
    tb.innerHTML = sources.map(function (s) {
      var status = s.rows > 0 ? '<span class="source-chip">OK</span>' : '<span class="muted">empty</span>';
      return "<tr>" +
        "<td><strong>" + S.esc(s.table) + "</strong></td>" +
        "<td>" + S.esc(s.label) + "</td>" +
        '<td class="num">' + S.fmtNum(s.rows) + "</td>" +
        "<td>" + (s.newest ? S.fmtDateTime(s.newest) : '<span class="muted">—</span>') + "</td>" +
        "<td>" + status + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderActivity(data) {
    var feed = [];
    (data.drawings || []).forEach(function (d) {
      feed.push({ t: d.created_at, html: '<span class="pill upload">Upload</span><strong>' + S.esc(S.cleanDiscipline(d.uploaded_by)) + "</strong> added &ldquo;" + S.esc(d.drawing_name) + "&rdquo;" });
    });
    (data.comments || []).forEach(function (c) {
      var prof = S.profileById(data, c.user_id);
      var name = prof ? (prof.full_name || prof.email) : (c.user_id || "Unknown");
      feed.push({ t: c.created_at, html: '<span class="pill comment">Comment</span><strong>' + S.esc(name) + "</strong>: " + S.esc((c.body || "").slice(0, 80)) });
    });
    feed.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
    var items = feed.slice(0, 15);
    var feedEl = document.getElementById("activityFeed");
    if (!items.length) { feedEl.innerHTML = '<li class="empty-note">No activity yet.</li>'; return; }
    feedEl.innerHTML = items.map(function (f) {
      return "<li>" +
        '<div class="a-avatar"><div class="avatar">SC</div></div>' +
        '<div class="a-body">' + f.html + '<div class="a-meta">' + S.fmtDateTime(f.t) + "</div></div>" +
        '<div class="a-time">' + S.timeAgo(f.t) + "</div>" +
        "</li>";
    }).join("");
  }

  S.boot("sync.html", function (data) {
    renderKpis(data);
    renderTable(data);
    renderActivity(data);
  });
})();