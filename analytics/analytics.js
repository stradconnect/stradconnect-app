(function () {
  var SUPABASE_URL = "https://addkzbtpzuujghpidplu.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_GS-TjYrkZ88-aL01RpaUAg_m5z-RlJI";
  var OWNER_EMAIL = "stradconnect@gmail.com";

  var supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  var lockScreen = document.getElementById("lock-screen");
  var kpiGrid = document.getElementById("kpiGrid");
  var projectsTbody = document.getElementById("projectsTable");
  var deletedTbody = document.getElementById("deletedTable");
  var usersTbody = document.getElementById("usersTable");
  var accessBadge = document.getElementById("accessBadge");
  var lastUpdatedEl = document.getElementById("lastUpdated");
  var logoutBtn = document.getElementById("logoutBtn");
  var refreshBtn = document.getElementById("refreshBtn");

  var bodyEl = document.body;

  function fmtDate(d) {
    if (!d) return "—";
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setLocked(show) {
    if (show) { lockScreen.classList.remove("hidden"); bodyEl.classList.add("hidden"); }
    else { lockScreen.classList.add("hidden"); bodyEl.classList.remove("hidden"); }
  }

  function renderKpis(kpis) {
    var defs = [
      { label: "Total Users", value: kpis.totalUsers, sub: kpis.newUsers30 + " new in last 30 days", gold: false },
      { label: "Monthly Active Users", value: kpis.activeUsers, sub: "active in last 30 days", gold: true },
      { label: "Active Projects", value: kpis.activeProjects, sub: "currently running", gold: false },
      { label: "Total Projects", value: kpis.totalProjects, sub: kpis.deletedProjects + " deleted", gold: false },
      { label: "Total Files", value: kpis.totalFiles, sub: "across all projects", gold: false },
      { label: "Total Comments", value: kpis.totalComments, sub: "across all projects", gold: false },
      { label: "Total Invites", value: kpis.totalInvites, sub: "sent to consultants", gold: false }
    ];
    kpiGrid.innerHTML = defs.map(function (d) {
      return '<div class="kpi' + (d.gold ? " gold" : "") + '">' +
        '<div class="kpi-label">' + esc(d.label) + '</div>' +
        '<div class="kpi-value">' + d.value + '</div>' +
        (d.sub ? '<div class="kpi-sub">' + esc(d.sub) + "</div>" : "") +
        "</div>";
    }).join("");
  }

  function renderProjects(rows) {
    if (!rows || !rows.length) {
      projectsTbody.innerHTML = '<tr><td colspan="7" class="muted">No projects yet.</td></tr>';
      return;
    }
    projectsTbody.innerHTML = rows.map(function (p) {
      return "<tr>" +
        "<td><strong>" + esc(p.name) + "</strong></td>" +
        "<td>" + esc(p.location || "—") + "</td>" +
        "<td>" + esc(p.project_type || "—") + "</td>" +
        "<td>" + (p.file_count || 0) + "</td>" +
        "<td>" + (p.comment_count || 0) + "</td>" +
        "<td>" + (p.member_count || 0) + "</td>" +
        "<td>" + fmtDate(p.created_at) + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderDeleted(rows) {
    if (!rows || !rows.length) {
      deletedTbody.innerHTML = '<tr><td colspan="5" class="muted">No deleted projects.</td></tr>';
      return;
    }
    deletedTbody.innerHTML = rows.map(function (d) {
      return "<tr>" +
        "<td><strong>" + esc(d.project_name) + "</strong></td>" +
        "<td>" + esc(d.admin_email || "—") + "</td>" +
        "<td>" + (d.member_count || 0) + "</td>" +
        "<td>" + (d.file_count || 0) + "</td>" +
        "<td>" + fmtDate(d.deleted_at) + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderUsers(rows) {
    if (!rows || !rows.length) {
      usersTbody.innerHTML = '<tr><td colspan="4" class="muted">No users yet.</td></tr>';
      return;
    }
    usersTbody.innerHTML = rows.map(function (u) {
      return "<tr>" +
        "<td><strong>" + esc(u.full_name || "—") + "</strong></td>" +
        "<td>" + esc(u.company_name || "—") + "</td>" +
        "<td>" + esc(u.email) + "</td>" +
        "<td>" + fmtDate(u.created_at) + "</td>" +
        "</tr>";
    }).join("");
  }

  function loadAll() {
    var cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);

    var db = supabase;

    Promise.all([
      db.from("profiles").select("id, email, full_name, company_name, created_at").order("created_at", { ascending: false }),
      db.from("projects").select("id, name, location, project_type, status, created_at, user_id").eq("status", "Active").order("created_at", { ascending: false }),
      db.from("deleted_projects").select("project_name, admin_email, member_count, file_count, deleted_at").order("deleted_at", { ascending: false }),
      db.from("project_drawings").select("project_id"),
      db.from("drawing_comments").select("id, project_id"),
      db.from("project_invitations").select("id"),
      db.from("notifications").select("user_id, created_at")
    ]).then(function (results) {
      var profiles = results[0].data || [];
      var projects = results[1].data || [];
      var deleted = results[2].data || [];
      var drawings = results[3].data || [];
      var comments = results[4].data || [];
      var invites = results[5].data || [];
      var notifications = results[6].data || [];

      var filesByProject = {};
      drawings.forEach(function (r) { filesByProject[r.project_id] = (filesByProject[r.project_id] || 0) + 1; });
      var commentsByProject = {};
      comments.forEach(function (r) { commentsByProject[r.project_id] = (commentsByProject[r.project_id] || 0) + 1; });

      var projectMembers = {};
      projects.forEach(function (p) { projectMembers[p.id] = 0; });

      var distinctActiveUsers = {};
      notifications.forEach(function (n) {
        var t = new Date(n.created_at);
        if (t >= cutoff30 && n.user_id) distinctActiveUsers[n.user_id] = true;
      });

      var newUsers = 0;
      profiles.forEach(function (u) {
        if (new Date(u.created_at) >= cutoff30) newUsers++;
      });

      var projectRows = projects.map(function (p) {
        var members = 1;
        var drawCount = filesByProject[p.id] || 0;
        var commCount = commentsByProject[p.id] || 0;
        return {
          name: p.name,
          location: p.location,
          project_type: p.project_type,
          created_at: p.created_at,
          file_count: drawCount,
          comment_count: commCount,
          member_count: members
        };
      });

      renderKpis({
        totalUsers: profiles.length,
        newUsers30: newUsers,
        activeUsers: Object.keys(distinctActiveUsers).length,
        activeProjects: projects.length,
        totalProjects: projects.length,
        deletedProjects: deleted.length,
        totalFiles: drawings.length,
        totalComments: comments.length,
        totalInvites: invites.length
      });

      renderProjects(projectRows);
      renderDeleted(deleted);
      renderUsers(profiles);

      lastUpdatedEl.textContent = "last updated " + new Date().toLocaleTimeString("en-IN");
    }).catch(function (err) {
      kpiGrid.innerHTML = '<div class="kpi"><div class="kpi-label">Error</div><div class="kpi-value">—</div><div class="kpi-sub">' + esc(err && err.message ? err.message : "Failed to load data") + "</div></div>";
      lastUpdatedEl.textContent = "load failed";
    });
  }

  function start() {
    if (!supabase) { setLocked(true); return; }

    supabase.auth.getUser().then(function (userRes) {
      if (userRes.error || !userRes.data || !userRes.data.user) {
        window.location.replace("../index.html");
        return;
      }
      var email = String(userRes.data.user.email || "").toLowerCase().trim();
      if (email !== OWNER_EMAIL) {
        setLocked(true);
        setTimeout(function () { window.location.replace("../index.html"); }, 2500);
        return;
      }
      accessBadge.textContent = "Owner · " + userRes.data.user.email;
      setLocked(false);
      loadAll();
    }).catch(function () {
      window.location.replace("../index.html");
    });
  }

  logoutBtn.addEventListener("click", function () {
    supabase.auth.signOut().then(function () {
      window.location.replace("../index.html");
    });
  });

  refreshBtn.addEventListener("click", loadAll);

  start();
})();
