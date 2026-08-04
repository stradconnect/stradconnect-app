(function () {
  var CONFIG = {
    SUPABASE_URL: "https://addkzbtpzuujghpidplu.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_GS-TjYrkZ88-aL01RpaUAg_m5z-RlJI",
    OWNER_EMAIL: "stradconnect@gmail.com"
  };

  var DB = window.supabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;

  var CACHE = { data: null, loading: null };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDate(d) {
    if (!d) return "—";
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtDateTime(d) {
    if (!d) return "—";
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function timeAgo(d) {
    if (!d) return "—";
    var t = new Date(d).getTime();
    if (isNaN(t)) return "—";
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + " hr" + (h > 1 ? "s" : "") + " ago";
    var days = Math.floor(h / 24);
    if (days < 30) return days + " day" + (days > 1 ? "s" : "") + " ago";
    var mo = Math.floor(days / 30);
    if (mo < 12) return mo + " mo ago";
    return Math.floor(mo / 12) + " yr ago";
  }

  function fmtNum(n) {
    if (n == null) return "0";
    var v = Number(n) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (v >= 1000) return (v / 1000).toFixed(1) + "K";
    return String(v);
  }

  function fmtBytes(n) {
    if (n == null || isNaN(n)) return "0 B";
    var v = Number(n) || 0;
    if (v < 1024) return v + " B";
    var kb = v / 1024;
    if (kb < 1024) return kb.toFixed(1) + " KB";
    var mb = kb / 1024;
    if (mb < 1024) return mb.toFixed(2) + " MB";
    var gb = mb / 1024;
    return gb.toFixed(2) + " GB";
  }

  function initialsOf(u) {
    if (!u) return "?";
    var name = u.full_name || "";
    if (name) {
      var parts = name.trim().split(/\s+/);
      return (((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "")).toUpperCase() || "?";
    }
    return String(u.email || "?")[0].toUpperCase();
  }

  function cleanDiscipline(raw) {
    if (!raw) return "Unspecified";
    return String(raw).replace(/^\d+_?\s*/, "").trim() || "Unspecified";
  }

  function showLock() {
    var lock = document.getElementById("lock-screen");
    if (lock) lock.classList.remove("hidden");
  }

  function owner() {
    if (!DB) { showLock(); return Promise.reject(new Error("no-db")); }
    return DB.auth.getUser().then(function (res) {
      if (res.error || !res.data || !res.data.user) {
        window.location.replace("auth.html");
        return Promise.reject(new Error("no-auth"));
      }
      var email = String(res.data.user.email || "").toLowerCase().trim();
      if (email !== CONFIG.OWNER_EMAIL) {
        showLock();
        setTimeout(function () { window.location.replace("../index.html"); }, 2500);
        return Promise.reject(new Error("denied"));
      }
      var badge = document.getElementById("accessBadge");
      if (badge) badge.textContent = "Owner \u00b7 " + res.data.user.email;
      return res.data.user;
    }).catch(function (err) {
      if (err && err.message === "no-db") showLock();
      throw err;
    });
  }

  function loadData(force) {
    if (CACHE.data && !force) return Promise.resolve(CACHE.data);
    if (CACHE.loading) return CACHE.loading;
    CACHE.loading = Promise.all([
      DB.from("profiles").select("id, email, full_name, company_name, created_at").order("created_at", { ascending: false }),
      DB.from("projects").select("id, name, location, project_type, status, created_at, user_id").order("created_at", { ascending: false }),
      DB.from("deleted_projects").select("project_name, admin_email, member_count, file_count, deleted_at, project_type, project_location").order("deleted_at", { ascending: false }),
      DB.from("project_drawings").select("project_id, uploaded_by, drawing_name, revision_number, created_at").order("created_at", { ascending: true }),
      DB.from("drawing_comments").select("id, project_id, user_id, drawing_name, discipline_name, body, created_at").order("created_at", { ascending: true }),
      DB.from("project_invitations").select("project_id, email, discipline_id, status, created_at").order("created_at", { ascending: true }),
      DB.from("notifications").select("user_id, project_id, body, created_at").order("created_at", { ascending: true }),
      DB.from("project_disciplines").select("id, project_id, name")
    ]).then(function (results) {
      CACHE.data = {
        ts: Date.now(),
        profiles: results[0].data || [],
        projects: results[1].data || [],
        deleted: results[2].data || [],
        drawings: results[3].data || [],
        comments: results[4].data || [],
        invites: results[5].data || [],
        notifications: results[6].data || [],
        disciplines: results[7].data || []
      };
      CACHE.loading = null;
      return CACHE.data;
    }).catch(function (err) {
      CACHE.loading = null;
      throw err;
    });
    return CACHE.loading;
  }

  function profileById(data, id) {
    if (!id) return null;
    for (var i = 0; i < (data.profiles || []).length; i++) {
      if (String(data.profiles[i].id) === String(id)) return data.profiles[i];
    }
    return null;
  }

  function profileByEmail(data, email) {
    var e = String(email || "").toLowerCase().trim();
    if (!e) return null;
    for (var i = 0; i < (data.profiles || []).length; i++) {
      if (String(data.profiles[i].email || "").toLowerCase().trim() === e) return data.profiles[i];
    }
    return null;
  }

  function projectById(data, id) {
    for (var i = 0; i < (data.projects || []).length; i++) {
      if (String(data.projects[i].id) === String(id)) return data.projects[i];
    }
    return null;
  }

  function drawingsForProject(data, projectId) {
    return (data.drawings || []).filter(function (d) { return String(d.project_id) === String(projectId); });
  }

  function commentsForProject(data, projectId) {
    return (data.comments || []).filter(function (c) { return String(c.project_id) === String(projectId); });
  }

  function notificationsForProject(data, projectId) {
    return (data.notifications || []).filter(function (n) { return String(n.project_id) === String(projectId); });
  }

  function commentsForUser(data, userId) {
    return (data.comments || []).filter(function (c) { return String(c.user_id) === String(userId); });
  }

  function membersOfProject(data, project) {
    var out = [];
    var ownerProf = profileById(data, project.user_id);
    out.push({
      kind: "Admin",
      status: "Admin",
      userId: project.user_id,
      email: ownerProf ? ownerProf.email : "",
      name: ownerProf ? (ownerProf.full_name || ownerProf.email) : "Project Admin",
      role: "Admin",
      joined: project.created_at
    });
    var discNameById = {};
    (data.disciplines || []).forEach(function (dd) {
      if (String(dd.project_id) === String(project.id)) discNameById[dd.id] = dd.name;
    });
    (data.invites || []).forEach(function (iv) {
      if (String(iv.project_id) !== String(project.id)) return;
      var prof = profileByEmail(data, iv.email);
      out.push({
        kind: iv.status === "Accepted" ? "Member" : (iv.status || "Invited"),
        status: iv.status || "Invited",
        userId: prof ? prof.id : null,
        email: iv.email,
        name: prof ? (prof.full_name || prof.email) : iv.email,
        role: discNameById[iv.discipline_id] || "Viewer",
        joined: iv.created_at
      });
    });
    return out;
  }

  function lastActivityOfUser(data, projectId, userId) {
    if (!userId) return null;
    var latest = null;
    (data.comments || []).forEach(function (c) {
      if (String(c.user_id) === String(userId) && (!projectId || String(c.project_id) === String(projectId))) {
        if (!latest || new Date(c.created_at) > new Date(latest)) latest = c.created_at;
      }
    });
    (data.notifications || []).forEach(function (n) {
      if (String(n.user_id) === String(userId) && (!projectId || String(n.project_id) === String(projectId))) {
        if (!latest || new Date(n.created_at) > new Date(latest)) latest = n.created_at;
      }
    });
    return latest;
  }

  function uploadCountsByDiscipline(data, projectId) {
    var map = {};
    drawingsForProject(data, projectId).forEach(function (d) {
      var disc = cleanDiscipline(d.uploaded_by);
      map[disc] = (map[disc] || 0) + 1;
    });
    return map;
  }

  function monthKey(d) {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return "?";
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0");
  }

  function monthLabel(key) {
    var parts = key.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
      .toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }

  function buildMonthlySeries(items, accessor) {
    var map = {};
    var keys = [];
    items.forEach(function (it) {
      var k = monthKey(accessor(it));
      if (!map[k]) { map[k] = 0; keys.push(k); }
      map[k]++;
    });
    keys.sort();
    return { labels: keys.map(monthLabel), values: keys.map(function (k) { return map[k]; }) };
  }

  function cumulative(values) {
    var out = [];
    var acc = 0;
    values.forEach(function (v) { acc += v; out.push(acc); });
    return out;
  }

  var chartInstances = {};

  var STORAGE_CACHE = { data: null, loading: null };

  function listAll(bucket, path, offset) {
    return bucket.list(path, { limit: 1000, offset: offset, sortBy: { column: "name", order: "asc" } }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
  }

  function walkStorage(bucket, path, bytesByProject, bytesByFolder, onFile) {
    return listAll(bucket, path, 0).then(function (items) {
      var files = [];
      var folders = [];
      items.forEach(function (it) {
        if (it.id === null || it.id === undefined || it.metadata === null) folders.push(it.name);
        else files.push(it);
      });
      files.forEach(function (f) {
        var size = (f.metadata && f.metadata.size) || 0;
        if (bytesByProject) {
          var top = String(path || "").split("/")[0];
          if (top) bytesByProject[top] = (bytesByProject[top] || 0) + size;
        }
        if (bytesByFolder) {
          bytesByFolder[path || "(root)"] = (bytesByFolder[path || "(root)"] || 0) + size;
        }
        if (onFile) onFile(f, size);
      });
      return Promise.all(folders.map(function (f) {
        return walkStorage(bucket, path ? path + "/" + f : f, bytesByProject, bytesByFolder, onFile);
      }));
    });
  }

  function loadStorage(force) {
    if (STORAGE_CACHE.data && !force) return Promise.resolve(STORAGE_CACHE.data);
    if (STORAGE_CACHE.loading) return STORAGE_CACHE.loading;
    if (!DB) return Promise.resolve({ totalBytes: 0, files: 0, bytesByProject: {}, bytesByFolder: {}, error: "no db" });
    STORAGE_CACHE.loading = (function () {
      var bucket = DB.storage.from("project-files");
      var bytesByProject = {};
      var bytesByFolder = {};
      var totalFiles = 0;
      var totalBytes = 0;
      return walkStorage(bucket, "", bytesByProject, bytesByFolder, function (f, size) {
        totalFiles++;
        totalBytes += size;
      }).then(function () {
        STORAGE_CACHE.data = { totalBytes: totalBytes, files: totalFiles, bytesByProject: bytesByProject, bytesByFolder: bytesByFolder, ts: Date.now() };
        STORAGE_CACHE.loading = null;
        return STORAGE_CACHE.data;
      }).catch(function (err) {
        STORAGE_CACHE.data = { totalBytes: 0, files: 0, bytesByProject: {}, bytesByFolder: {}, ts: Date.now(), error: (err && err.message) || "storage listing failed" };
        STORAGE_CACHE.loading = null;
        return STORAGE_CACHE.data;
      });
    })();
    return STORAGE_CACHE.loading;
  }

  function makeChart(canvasId, config) {
    if (!window.Chart) return null;
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    chartInstances[canvasId] = new Chart(canvas.getContext("2d"), config);
    return chartInstances[canvasId];
  }

  var GREEN = "#17684f";
  var GOLD = "#efb75a";
  var PALETTE = ["#17684f", "#efb75a", "#3a7d64", "#d99a3a", "#5f8f7c", "#c98d4b", "#2b5f4e", "#e0ae60", "#7fa89a", "#b06e2a"];

  function chartDefaults() {
    if (window.Chart) {
      Chart.defaults.color = "#5f6b66";
      Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    }
  }

  function setupNav(activeFile) {
    var nav = document.getElementById("navLinks");
    if (!nav) return;
    var links = [
      ["index.html", "Overview"],
      ["projects.html", "Projects"],
      ["files.html", "Files"],
      ["users.html", "Users"],
      ["deleted.html", "Deleted"],
      ["sync.html", "Sync"]
    ];
    nav.innerHTML = links.map(function (l) {
      var active = activeFile && l[0] === activeFile ? " class=\"active\"" : "";
      return "<a href=\"" + l[0] + "\"" + active + ">" + esc(l[1]) + "</a>";
    }).join("");
  }

  function setupTopbar(activeFile) {
    setupNav(activeFile);
    chartDefaults();
    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        if (DB) {
          DB.auth.signOut().then(function () { window.location.replace("auth.html"); });
        } else {
          window.location.replace("auth.html");
        }
      });
    }
  }

  function boot(activeFile, renderFn) {
    setupTopbar(activeFile);
    var refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "Refreshing...";
        loadData(true).then(function (data) {
          stamp(data);
          renderFn(data);
          refreshBtn.disabled = false;
          refreshBtn.textContent = "Refresh";
        }).catch(function () {
          refreshBtn.disabled = false;
          refreshBtn.textContent = "Refresh";
        });
      });
    }
    owner()
      .then(function () { return loadData(false); })
      .then(function (data) {
        stamp(data);
        renderFn(data);
      })
      .catch(function (err) {
        var target = document.getElementById("mainContent");
        if (target && err && (err.message === "denied" || err.message === "no-db" || err.message === "no-auth")) return;
        if (target) {
          target.innerHTML = '<div class="error-box">Failed to load analytics data: ' + esc(err && err.message ? err.message : "unknown error") + "</div>";
        }
      });
  }

  function stamp(data) {
    var el = document.getElementById("lastUpdated");
    if (el && data) el.textContent = "last synced " + new Date(data.ts).toLocaleTimeString("en-IN");
  }

  window.SCA = {
    DB: DB,
    CONFIG: CONFIG,
    esc: esc,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
    timeAgo: timeAgo,
    fmtNum: fmtNum,
    initialsOf: initialsOf,
    cleanDiscipline: cleanDiscipline,
    loadData: loadData,
    profileById: profileById,
    profileByEmail: profileByEmail,
    projectById: projectById,
    drawingsForProject: drawingsForProject,
    commentsForProject: commentsForProject,
    notificationsForProject: notificationsForProject,
    commentsForUser: commentsForUser,
    membersOfProject: membersOfProject,
    lastActivityOfUser: lastActivityOfUser,
    uploadCountsByDiscipline: uploadCountsByDiscipline,
    monthKey: monthKey,
    monthLabel: monthLabel,
    buildMonthlySeries: buildMonthlySeries,
    cumulative: cumulative,
    makeChart: makeChart,
    loadStorage: loadStorage,
    fmtBytes: fmtBytes,
    GREEN: GREEN,
    GOLD: GOLD,
    PALETTE: PALETTE,
    boot: boot
  };
})();
