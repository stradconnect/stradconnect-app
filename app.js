var projectTypes = [
  "Residential Apartment",
  "Individual Villa / Bungalow",
  "Commercial Building",
  "Mixed-Use Building",
  "Industrial Building / Factory",
  "Warehouse / Shed",
  "Institutional Building",
  "Renovation / Interior Fit-Out",
  "Infrastructure / Site Development",
  "Custom Project"
];

var disciplines = [
  "Owner",
  "Architect",
  "Structural Consultant",
  "MEP Consultant",
  "Contractor",
  "PMC / Project Manager",
  "Interior Designer",
  "Landscape Consultant",
  "Fire Consultant",
  "Lift Consultant",
  "Facade Consultant",
  "QS / Billing / BOQ",
  "Custom Discipline"
];

var customDisciplines = [];
var currentUserId = null;

var defaultSelected = new Set([
  "Owner",
  "Architect",
  "Structural Consultant",
  "MEP Consultant",
  "Contractor"
]);

// =========================================================================
// 🔒 LIVE SUPABASE CONFIGURATION
// =========================================================================
var SUPABASE_URL = "https://addkzbtpzuujghpidplu.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_GS-TjYrkZ88-aL01RpaUAg_m5z-RlJI";
var VAPID_PUBLIC_KEY = "BCkEo_AvuTy-HSJMKZhytR6ZxS3i25Yb9i8Xb7eFJNPipZeYi2djxWeowu5a4Izx3ryipp5IuD-8eQqyTjm7Cgs";
var APP_BASE_URL = (window.location.protocol === "file:") ? "http://10.129.166.195:3000" : window.location.origin;

function urlBase64ToUint8Array(base64String) {
  var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  var raw = atob(base64);
  var output = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

var supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// UI View Viewports
var viewHub = document.querySelector("#viewHub");
var viewCreation = document.querySelector("#viewCreation");
var viewDashboard = document.querySelector("#viewDashboard");

// Dashboard Tabs (If present in HTML)
var btnTabFolders = document.querySelector("#btnTabFolders");
var btnTabTeam = document.querySelector("#btnTabTeam");
var btnTabActivity = document.querySelector("#btnTabActivity");
var btnTabExport = document.querySelector("#btnTabExport");
var tabContentFolders = document.querySelector("#tabContentFolders");
var tabContentTeam = document.querySelector("#tabContentTeam");
var tabContentActivity = document.querySelector("#tabContentActivity");
var tabContentExport = document.querySelector("#tabContentExport");

function activateTab(activeBtn, activeContent, others) {
  activeContent.style.display = "block";
  activeBtn.style.color = "var(--blue)";
  activeBtn.style.borderBottomColor = "var(--blue)";
  activeBtn.style.fontWeight = "700";
  for (var i = 0; i < others.length; i++) {
    others[i].btn.style.color = "#a0aec0";
    others[i].btn.style.borderBottomColor = "transparent";
    others[i].btn.style.fontWeight = "600";
    others[i].content.style.display = "none";
  }
}

var tabDefs = [
  { btn: btnTabFolders, content: tabContentFolders },
  { btn: btnTabTeam, content: tabContentTeam },
  { btn: btnTabActivity, content: tabContentActivity },
  { btn: btnTabExport, content: tabContentExport }
];

for (var t = 0; t < tabDefs.length; t++) {
  (function(def) {
    if (def.btn && def.content) {
      def.btn.addEventListener("click", function() {
        var others = [];
        for (var j = 0; j < tabDefs.length; j++) {
          if (tabDefs[j].btn !== def.btn) {
            others.push({ btn: tabDefs[j].btn, content: tabDefs[j].content });
          }
        }
        activateTab(def.btn, def.content, others);
      });
    }
  })(tabDefs[t]);
}

// Export / Backup
function downloadCSV(content, filename) {
  var bom = "\uFEFF";
  var blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;bom" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  val = String(val).replace(/"/g, '""');
  return '"' + val + '"';
}

document.addEventListener("click", function(e) {
  if (e.target.matches("#exportBackupBtn")) {
    var statusEl = document.querySelector("#exportStatus");
    if (!currentActiveProjectId || !supabase) { statusEl.textContent = "No project loaded."; return; }
    statusEl.textContent = "Generating backup...";

    var projectId = currentActiveProjectId;

    supabase.from("projects").select("user_id, project_config, name, location, project_type, basement_count, podium_count, floor_count, cabin_count, created_at, updated_at").eq("id", projectId).single()
    .then(function(projRes) {
      var project = projRes.data;
      if (!project) { statusEl.textContent = "Project not found."; return; }

      return Promise.all([
        Promise.resolve(project),
        supabase.from("profiles").select("email").eq("id", project.user_id).maybeSingle(),
        supabase.from("project_disciplines").select("name").eq("project_id", projectId).order("sort_order"),
        supabase.from("project_invitations").select("email, discipline_id, status, created_at").eq("project_id", projectId).order("created_at"),
        supabase.from("project_drawings").select("drawing_name, revision, file_url, folder_id, created_at, updated_at").eq("project_id", projectId).order("created_at"),
        supabase.from("project_disciplines").select("id, name").eq("project_id", projectId),
        supabase.from("drawing_comments").select("drawing_name, discipline_name, body, created_at").eq("project_id", projectId).order("created_at"),
        supabase.from("project_folders").select("id, folder_name").eq("project_id", projectId)
      ]);
    })
    .then(function(res) {
      var project = res[0];
      var adminProfile = res[1].data;
      var disciplines = res[2].data || [];
      var invitations = res[3].data || [];
      var drawings = res[4].data || [];
      var discMap = {};
      (res[5].data || []).forEach(function(d) { discMap[d.id] = d.name; });
      var comments = res[6].data || [];
      var folderMap = {};
      (res[7].data || []).forEach(function(f) { folderMap[f.id] = f.folder_name; });

        var adminEmail = adminProfile ? adminProfile.email : "unknown";
        var joiningAs = (project.project_config && project.project_config.joining_as) || "Owner";
        var adminDiscipline = joiningAs;

        var acceptedEmails = {};
        invitations.forEach(function(inv) {
          if (inv.status === "Accepted") acceptedEmails[inv.email] = true;
        });
        var activeCount = Object.keys(acceptedEmails).length + 1;

        var lines = [];
        var sep = ",";

        lines.push("PROJECT BACKUP - " + (project.name || ""));
        lines.push("Generated," + csvEscape(new Date().toLocaleString()));
        lines.push("Token," + csvEscape("SC-" + projectId.substring(0, 5).toUpperCase()));
        lines.push("");

        lines.push("PROJECT INFO");
        lines.push(["Name", "Location", "Type", "Basements", "Podiums", "Floors", "Cabin", "Created", "Updated"].join(sep));
        lines.push([
          csvEscape(project.name),
          csvEscape(project.location),
          csvEscape(project.project_type),
          project.basement_count || 0,
          project.podium_count || 0,
          project.floor_count || 0,
          project.cabin_count ? "Yes" : "No",
          csvEscape(project.created_at ? new Date(project.created_at).toLocaleDateString() : ""),
          csvEscape(project.updated_at ? new Date(project.updated_at).toLocaleDateString() : "")
        ].join(sep));
        lines.push("");

        lines.push("DISCIPLINES (" + disciplines.length + ")");
        lines.push(["#", "Name"].join(sep));
        for (var di = 0; di < disciplines.length; di++) {
          lines.push([di + 1, csvEscape(disciplines[di].name)].join(sep));
        }
        lines.push("");

        lines.push("MEMBERS (" + activeCount + " active)");
        lines.push(["Email", "Discipline", "Status"].join(sep));
        lines.push([csvEscape(adminEmail), csvEscape(adminDiscipline), "Active (Admin)"].join(sep));
        invitations.forEach(function(inv) {
          var discName = discMap[inv.discipline_id] || "Unknown";
          var st = inv.status === "Accepted" ? "Active" : "Pending";
          lines.push([csvEscape(inv.email), csvEscape(discName), st].join(sep));
        });
        lines.push("");

        lines.push("DRAWINGS (" + drawings.length + ")");
        lines.push(["Drawing Name", "Revision", "Folder", "Uploaded", "Updated"].join(sep));
        for (var dw = 0; dw < drawings.length; dw++) {
          var d = drawings[dw];
          lines.push([
            csvEscape(d.drawing_name),
            csvEscape(d.revision || "R0"),
            csvEscape(folderMap[d.folder_id] || ""),
            csvEscape(d.created_at ? new Date(d.created_at).toLocaleString() : ""),
            csvEscape(d.updated_at ? new Date(d.updated_at).toLocaleString() : "")
          ].join(sep));
        }
        lines.push("");

        lines.push("COMMENTS (" + comments.length + ")");
        lines.push(["Drawing", "Discipline", "Comment", "Posted"].join(sep));
        for (var c = 0; c < comments.length; c++) {
          var co = comments[c];
          lines.push([
            csvEscape(co.drawing_name),
            csvEscape(co.discipline_name),
            csvEscape(co.body),
            csvEscape(co.created_at ? new Date(co.created_at).toLocaleString() : "")
          ].join(sep));
        }

        var cleanName = (project.name || "project").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        downloadCSV(lines.join("\n"), "stradconnect_" + cleanName + "_backup.csv");
        statusEl.textContent = "Backup downloaded.";
      })
    .catch(function(err) {
      statusEl.textContent = "Backup failed: " + (err.message || err);
    });
  }
});

// Navigation Sidebar Targets
var navYourProjects = document.querySelector("#navYourProjects");
var navCreateProject = document.querySelector("#navCreateProject");
var hubCreateProjectBtn = document.querySelector("#hubCreateProjectBtn");
var sidebarProjectTree = document.querySelector("#sidebarProjectTree");
var dashDeleteProjectBtn = document.querySelector("#dashDeleteProjectBtn");
var dashLeaveProjectBtn = document.querySelector("#dashLeaveProjectBtn");
var dashEditProjectBtn = document.querySelector("#dashEditProjectBtn");
var editProjectModalOverlay = document.querySelector("#editProjectModalOverlay");
var closeEditProjectBtn = document.querySelector("#closeEditProjectBtn");
var editProjectName = document.querySelector("#editProjectName");
var editProjectLocation = document.querySelector("#editProjectLocation");
var editProjectType = document.querySelector("#editProjectType");
var editBasements = document.querySelector("#editBasements");
var editFloors = document.querySelector("#editFloors");
var editPodiums = document.querySelector("#editPodiums");
var editFloorWarning = document.querySelector("#editFloorWarning");
var editDisciplinesList = document.querySelector("#editDisciplinesList");
var btnSaveEditProject = document.querySelector("#btnSaveEditProject");

// Creation Wizards View Items
var projectTypeSelect = document.querySelector("#projectType");
var disciplineList = document.querySelector("#disciplineList");
var inviteRows = document.querySelector("#inviteRows");
var workspacePreview = document.querySelector("#workspacePreview");
var createButton = document.querySelector("#createButton");

// Ledger Popover Fields
var uploadModalOverlay = document.querySelector("#uploadModalOverlay");
var closeModalBtn = document.querySelector("#closeModalBtn");
var btnModeNew = document.querySelector("#btnModeNew");
var btnModeRevision = document.querySelector("#btnModeRevision");
var wrapperNewDrawingTitle = document.querySelector("#wrapperNewDrawingTitle");
var wrapperRevisionSelector = document.querySelector("#wrapperRevisionSelector");
var modalTargetDrawingSelect = document.querySelector("#modalTargetDrawingSelect");
var modalSubmitBtn = document.querySelector("#modalSubmitBtn");
var drawingSearchInput = document.querySelector("#drawingSearchInput");
var drawingDisciplineFilter = document.querySelector("#drawingDisciplineFilter");
var drawingLevelFilter = document.querySelector("#drawingLevelFilter");
var revisionHistoryModalOverlay = document.querySelector("#revisionHistoryModalOverlay");
var closeRevisionHistoryBtn = document.querySelector("#closeRevisionHistoryBtn");
var revisionHistoryTitle = document.querySelector("#revisionHistoryTitle");
var revisionHistoryRows = document.querySelector("#revisionHistoryRows");
var commentsModalOverlay = document.querySelector("#commentsModalOverlay");
var closeCommentsModalBtn = document.querySelector("#closeCommentsModalBtn");
var commentsModalTitle = document.querySelector("#commentsModalTitle");
var commentsThread = document.querySelector("#commentsThread");
var commentsInput = document.querySelector("#commentsInput");
var commentsPostBtn = document.querySelector("#commentsPostBtn");
var currentCommentsDrawingId = null;
var sidebarProfileCompany = document.querySelector("#sidebarProfileCompany");
var sidebarProfileEmail = document.querySelector("#sidebarProfileEmail");
var btnOpenProfile = document.querySelector("#btnOpenProfile");
var btnLogout = document.querySelector("#btnLogout");
var profileModalOverlay = document.querySelector("#profileModalOverlay");
var closeProfileModalBtn = document.querySelector("#closeProfileModalBtn");
var profileModalCompany = document.querySelector("#profileModalCompany");
var profileModalName = document.querySelector("#profileModalName");
var profileModalEmail = document.querySelector("#profileModalEmail");

var currentActiveProjectId = null;
var currentProjectData = null;
var currentProjectDrawings = [];
var currentSessionProfile = {
  email: "",
  fullName: "",
  companyName: ""
};
var activeUploadContext = {
  folderId: null,
  levelName: null,
  disciplineRole: null
};
var isRevisionMode = false;

// UNIFIED VIEW SHIFTER WITH NAVIGATION CACHE SYNCING
function showView(target, specificProjectId) {
  if (viewHub) viewHub.style.setProperty("display", target === "hub" ? "block" : "none", "important");
  if (viewCreation) viewCreation.style.setProperty("display", target === "create" ? "block" : "none", "important");
  if (viewDashboard) viewDashboard.style.setProperty("display", target === "dashboard" ? "block" : "none", "important");

  if (target !== "dashboard") {
    teardownProjectNotifications();
  }

  if (navYourProjects) navYourProjects.classList.toggle("active", target === "hub");
  if (navCreateProject) navCreateProject.classList.toggle("active", target === "create");

  var treeLinks = document.querySelectorAll(".tree-project-link");
  for (var i = 0; i < treeLinks.length; i++) {
    var isCurrent = (target === "dashboard" && treeLinks[i].dataset.projectId === specificProjectId);
    treeLinks[i].classList.toggle("active-tree-node", isCurrent);
  }
}

function selectedDisciplines() {
  var checkboxes = document.querySelectorAll("[data-discipline]:checked");
  var selected = [];
  for (var i = 0; i < checkboxes.length; i++) {
    selected.push(checkboxes[i].dataset.discipline);
  }
  return selected;
}

function getProjectLevelsFromCounts(basements, podiums, floors, hasCabin) {
  var levels = [];
  levels.push("Foundation / Base");
  for (var b = basements; b >= 1; b--) { levels.push("Basement " + b); }
  for (var p = 1; p <= podiums; p++) { levels.push("Podium " + p); }
  levels.push("Ground Floor");
  for (var f = 1; f <= floors; f++) {
    var suffix = "th";
    if (f % 10 === 1 && f % 100 !== 11) suffix = "st";
    else if (f % 10 === 2 && f % 100 !== 12) suffix = "nd";
    else if (f % 10 === 3 && f % 100 !== 13) suffix = "rd";
    levels.push(f + suffix + " Floor");
  }
  if (hasCabin) { levels.push("Cabin"); }
  return levels;
}

function getProjectLevels() {
  var basements = Number(document.querySelector("#basements") ? document.querySelector("#basements").value : 0);
  var podiums = Number(document.querySelector("#podiums") ? document.querySelector("#podiums").value : 0);
  var floors = Number(document.querySelector("#floors") ? document.querySelector("#floors").value : 0);
  var hasCabin = document.querySelector("#hasCabin") ? document.querySelector("#hasCabin").checked : false;
  return getProjectLevelsFromCounts(basements, podiums, floors, hasCabin);
}

function renderProjectTypes() {
  if (!projectTypeSelect) return;
  var html = '<option value="" disabled selected>Select project type</option>';
  for (var i = 0; i < projectTypes.length; i++) {
    html += "<option>" + projectTypes[i] + "</option>";
  }
  projectTypeSelect.innerHTML = html;

  if (editProjectType) {
    var editHtml = "";
    for (var e = 0; e < projectTypes.length; e++) {
      editHtml += "<option>" + projectTypes[e] + "</option>";
    }
    editProjectType.innerHTML = editHtml;
  }
}

function renderDisciplines() {
  if (!disciplineList) {
    disciplineList = document.querySelector("#disciplineList");
  }
  if (!disciplineList) return;

  var html = "";
  var idx = 0;
  for (var i = 0; i < disciplines.length; i++) {
    var disc = disciplines[i];
    if (disc === "Custom Discipline") continue;
    var isChecked = defaultSelected.has(disc) ? "checked" : "";
    
    html += '<div style="display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">' +
              '<input type="checkbox" id="disc_' + idx + '" data-discipline="' + disc + '" ' + isChecked + ' style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--blue); margin: 0;" />' +
              '<label for="disc_' + idx + '" style="font-size: 14px; font-weight: 600; color: #0f172a; cursor: pointer; flex: 1; user-select: none; margin: 0; text-align: left;">' +
                disc +
              '</label>' +
            '</div>';
    idx++;
  }

  // Render custom disciplines (checked by default)
  for (var c = 0; c < customDisciplines.length; c++) {
    html += '<div style="display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 8px; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">' +
              '<input type="checkbox" id="customDisc_' + c + '" data-discipline="' + customDisciplines[c] + '" checked style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--blue); margin: 0;" />' +
              '<label for="customDisc_' + c + '" style="font-size: 14px; font-weight: 600; color: #0f172a; cursor: pointer; flex: 1; user-select: none; margin: 0; text-align: left;">' +
                customDisciplines[c] +
              '</label>' +
            '</div>';
  }

  // Add custom discipline button (max 5 during creation)
  if (customDisciplines.length < 5) {
    html += '<div id="addCustomDiscBtn" style="display:flex; align-items:center; justify-content:center; gap:8px; padding:14px 20px; background:#ffffff; border:1px dashed var(--blue); border-radius:6px; margin-bottom:8px; cursor:pointer; color:var(--blue); font-weight:600; font-size:14px; user-select:none;">+ Add Custom Discipline</div>';
  }

  disciplineList.innerHTML = html;
}

function renderInvites() {
  if (!inviteRows) return;
  var selected = selectedDisciplines();
  var html = "";
  for (var i = 0; i < selected.length; i++) {
    html += '<div class="invite-row">' +
              '<strong>' + selected[i] + '</strong>' +
              '<span class="hint">Invite by email after project creation</span>' +
            '</div>';
  }
  inviteRows.innerHTML = html;
}

function renderWorkspace() {
  if (!workspacePreview) return;
  var selected = selectedDisciplines();
  var levels = getProjectLevels();

  var html = "";
  for (var i = 0; i < selected.length; i++) {
    var folderNumber = String(i + 1).padStart(2, "0");
    html += '<div class="folder-row">' +
              '<strong>' + folderNumber + "_" + selected[i] + '</strong>' +
              '<span class="hint">' + levels.length + ' project levels cataloged</span>' +
            '</div>';
  }
  workspacePreview.innerHTML = html;
}

function renderYourDiscipline() {
  var sel = document.querySelector("#yourDiscipline");
  if (!sel) return;
  var currentVal = sel.value;
  var html = "";
  for (var i = 0; i < disciplines.length; i++) {
    if (disciplines[i] === "Custom Discipline") continue;
    html += "<option>" + disciplines[i] + "</option>";
  }
  for (var c = 0; c < customDisciplines.length; c++) {
    html += "<option>" + customDisciplines[c] + "</option>";
  }
  sel.innerHTML = html;
  if (currentVal) sel.value = currentVal;
}

function renderAll() {
  renderInvites();
  renderWorkspace();
  renderYourDiscipline();
}

function sanitizeLevelFolderKey(levelName) {
  return String(levelName || "").replace(/[\/\\]/g, "-").replace(/\s+/g, "_");
}

function getLevelFolderFromDrawing(drawing) {
  if (!drawing.file_path) return "";
  var parts = drawing.file_path.split("/");
  var levelName = parts.length > 2 ? parts.slice(1, -1).join("/") : "";
  return sanitizeLevelFolderKey(levelName);
}

function formatLevelLabel(levelFolder) {
  return levelFolder.replace(/_/g, " ").replace(/-/g, " / ");
}

function renderDrawingFilterOptions(drawings) {
  if (!drawingDisciplineFilter || !drawingLevelFilter) return;

  var selectedDiscipline = drawingDisciplineFilter.value;
  var selectedLevel = drawingLevelFilter.value;
  var disciplineMap = {};
  var levelMap = {};

  for (var i = 0; i < drawings.length; i++) {
    if (drawings[i].uploaded_by) disciplineMap[drawings[i].uploaded_by] = true;
    var levelFolder = getLevelFolderFromDrawing(drawings[i]);
    if (levelFolder) levelMap[levelFolder] = true;
  }

  var disciplineHtml = '<option value="">All disciplines</option>';
  Object.keys(disciplineMap).sort().forEach(function(role) {
    disciplineHtml += '<option value="' + role + '">' + role.replace(/^\d+_\s*/, "") + '</option>';
  });
  drawingDisciplineFilter.innerHTML = disciplineHtml;
  drawingDisciplineFilter.value = disciplineMap[selectedDiscipline] ? selectedDiscipline : "";

  var levelHtml = '<option value="">All levels</option>';
  Object.keys(levelMap).sort().forEach(function(levelFolder) {
    levelHtml += '<option value="' + levelFolder + '">' + formatLevelLabel(levelFolder) + '</option>';
  });
  drawingLevelFilter.innerHTML = levelHtml;
  drawingLevelFilter.value = levelMap[selectedLevel] ? selectedLevel : "";
}

function drawingMatchesActiveFilters(drawing) {
  var query = drawingSearchInput ? drawingSearchInput.value.trim().toLowerCase() : "";
  var discipline = drawingDisciplineFilter ? drawingDisciplineFilter.value : "";
  var level = drawingLevelFilter ? drawingLevelFilter.value : "";
  var levelFolder = getLevelFolderFromDrawing(drawing);

  if (discipline && drawing.uploaded_by !== discipline) return false;
  if (level && levelFolder !== level) return false;

  if (query) {
    var haystack = [drawing.drawing_name, drawing.uploaded_by, formatLevelLabel(levelFolder)].join(" ").toLowerCase();
    if (haystack.indexOf(query) === -1) return false;
  }

  return true;
}

function hasActiveDrawingFilters() {
  var query = drawingSearchInput ? drawingSearchInput.value.trim() : "";
  var discipline = drawingDisciplineFilter ? drawingDisciplineFilter.value : "";
  var level = drawingLevelFilter ? drawingLevelFilter.value : "";
  return Boolean(query || discipline || level);
}

function applyWorkspaceFilterVisibility(matchedFolderMap, matchedLevelMap) {
  var isFiltering = hasActiveDrawingFilters();
  var query = drawingSearchInput ? drawingSearchInput.value.trim().toLowerCase() : "";
  var selectedDiscipline = drawingDisciplineFilter ? drawingDisciplineFilter.value : "";
  var selectedLevel = drawingLevelFilter ? drawingLevelFilter.value : "";
  var cards = document.querySelectorAll(".workspace-card[data-folder-id]");

  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var folderId = card.getAttribute("data-folder-id");
    var disciplineName = card.getAttribute("data-discipline-name") || "";
    var cardMatchesDiscipline = selectedDiscipline && disciplineName === selectedDiscipline;
    var cardMatchesQuery = query && disciplineName.toLowerCase().indexOf(query) !== -1;
    var cardHasMatchedDrawing = Boolean(matchedFolderMap[folderId]);
    var shouldShowCard = !isFiltering || cardMatchesDiscipline || cardMatchesQuery || cardHasMatchedDrawing;

    card.style.display = shouldShowCard ? "flex" : "none";

    var collapseContainer = card.querySelector("[id^='collapse_container_']");
    var arrow = card.querySelector("[id^='dir_arrow_']");
    var levelNodes = card.querySelectorAll(".workspace-level-node");

    if (collapseContainer && shouldShowCard && isFiltering) {
      collapseContainer.style.display = "flex";
      if (arrow) arrow.style.transform = "rotate(180deg)";
    }

    for (var l = 0; l < levelNodes.length; l++) {
      var levelNode = levelNodes[l];
      var levelFolder = levelNode.getAttribute("data-level-folder") || "";
      var levelKey = folderId + "|" + levelFolder;
      var levelHasMatchedDrawing = Boolean(matchedLevelMap[levelKey]);
      var shouldShowLevel = !isFiltering || levelHasMatchedDrawing || (selectedLevel && selectedLevel === levelFolder && (cardMatchesDiscipline || cardMatchesQuery));
      levelNode.style.display = shouldShowLevel ? "flex" : "none";

      if (isFiltering) {
        var levelFeed = levelNode.querySelector(".drawings-feed-container");
        var levelArrow = levelNode.querySelector(".level-arrow");
        if (levelHasMatchedDrawing) {
          if (levelFeed) levelFeed.style.display = "flex";
          if (levelArrow) levelArrow.textContent = "▴";
        } else {
          if (levelFeed) levelFeed.style.display = "none";
          if (levelArrow) levelArrow.textContent = "▾";
        }
      }
    }
  }
}

function getRevisionGroupKey(drawing) {
  return drawing.parent_track_id || drawing.id;
}

function openRevisionHistory(drawingId) {
  if (!revisionHistoryModalOverlay || !revisionHistoryRows) return;

  var selectedDrawing = null;
  for (var i = 0; i < currentProjectDrawings.length; i++) {
    if (String(currentProjectDrawings[i].id) === String(drawingId)) {
      selectedDrawing = currentProjectDrawings[i];
      break;
    }
  }
  if (!selectedDrawing) return;

  var groupKey = getRevisionGroupKey(selectedDrawing);
  var rows = [];
  for (var r = 0; r < currentProjectDrawings.length; r++) {
    var row = currentProjectDrawings[r];
    if (String(row.id) === String(groupKey) || String(row.parent_track_id) === String(groupKey) || String(row.id) === String(selectedDrawing.parent_track_id)) {
      rows.push(row);
    }
  }

  rows.sort(function(a, b) { return b.revision_number - a.revision_number; });
  if (revisionHistoryTitle) revisionHistoryTitle.textContent = selectedDrawing.drawing_name + ".pdf";

  var html = "";
  for (var h = 0; h < rows.length; h++) {
    var drw = rows[h];
    var stamp = new Date(drw.created_at).toLocaleDateString("en-IN") + " " + new Date(drw.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
    var statusLabel = "";
    if (drw.is_visible) {
      statusLabel = " • Current visible record";
    } else if (drw.file_path) {
      statusLabel = " • Archived record";
    } else {
      statusLabel = " • No file (overwritten/removed)";
    }
    var viewBtn = "";
    if (drw.file_path) {
      var publicFileUrl = SUPABASE_URL + "/storage/v1/object/public/project-files/" + drw.file_path;
      viewBtn = '<a href="' + publicFileUrl + '" target="_blank" rel="noopener" class="btn-view-pdf" style="text-decoration:none; font-size:11px; background:#edf2f7; padding:5px 8px; border-radius:4px; color:#2d3748; font-weight:700; white-space:nowrap;">View</a>';
    }
    html += '<div style="display:flex; justify-content:space-between; align-items:center; gap:12px; border:1px solid var(--line); border-radius:6px; padding:10px 12px; background:#fbfcfb;">' +
              '<div>' +
                '<strong style="font-size:13px;">R' + drw.revision_number + statusLabel + '</strong>' +
                '<div class="hint" style="margin-top:3px;">' + drw.uploaded_by.replace(/^\d+_\s*/, "") + ' • ' + stamp + '</div>' +
              '</div>' +
              viewBtn +
            '</div>';
  }

  revisionHistoryRows.innerHTML = html || '<span class="hint">No revision history found.</span>';
  revisionHistoryModalOverlay.style.display = "flex";
}

// =========================================================================
// 💬 DRAWING COMMENTS
// =========================================================================
function openDrawingComments(drawingId) {
  currentCommentsDrawingId = drawingId;
  if (!commentsModalOverlay || !commentsThread) return;

  if (commentsModalTitle) {
    commentsModalTitle.textContent = "Comments";
  }
  commentsThread.innerHTML = '<span class="hint">Loading comments...</span>';
  commentsModalOverlay.style.display = "flex";

  supabase.from("drawing_comments").select("*, profiles:user_id(company_name)").eq("drawing_id", drawingId).order("created_at", { ascending: true })
    .then(function(res) {
      if (res.error) throw res.error;
      renderCommentsThread(res.data || []);
    })
    .catch(function(err) {
      console.error(err);
      commentsThread.innerHTML = '<span class="hint">Failed to load comments.</span>';
    });
}

function renderCommentsThread(comments) {
  if (!commentsThread) return;
  if (!comments.length) {
    commentsThread.innerHTML = '<span class="hint">No comments yet.</span>';
    return;
  }
  var isAdmin = currentProjectData && currentProjectData.user_id === currentUserId;
  var html = "";
  for (var c = 0; c < comments.length; c++) {
    var comment = comments[c];
    var company = (comment.profiles && comment.profiles.company_name) ? comment.profiles.company_name : "Unknown";
    var stamp = "";
    if (comment.created_at) {
      var d = new Date(comment.created_at);
      stamp = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    var canModify = isAdmin || comment.user_id === currentUserId;
    var actionsHtml = "";
    if (canModify) {
      actionsHtml = '<button type="button" class="comment-edit-btn" data-comment-id="' + comment.id + '" style="background:transparent; border:0; color:#718096; cursor:pointer; font-size:12px; padding:0 4px;" title="Edit">✏️</button>' +
                    '<button type="button" onclick="deleteComment(\'' + comment.id + '\')" style="background:transparent; border:0; color:#e53e3e; cursor:pointer; font-size:12px; padding:0 4px;" title="Delete">🗑️</button>';
    }
    html += '<div class="comment-item" data-comment-id="' + comment.id + '" style="border:1px solid var(--line); border-radius:6px; padding:10px 12px; background:#fbfcfb;">' +
              '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
                '<strong style="font-size:12px; color:var(--blue);">' + company + '</strong>' +
                '<div style="display:flex; align-items:center; gap:4px;">' +
                  '<span class="hint" style="font-size:11px;">' + stamp + '</span>' +
                  actionsHtml +
                '</div>' +
              '</div>' +
              '<div class="comment-body" style="font-size:13px; color:var(--ink);">' + escapeHtml(comment.body) + '</div>' +
            '</div>';
  }
  commentsThread.innerHTML = html;
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;
  supabase.from("drawing_comments").delete().eq("id", commentId)
    .then(function(res) {
      if (res.error) throw res.error;
      openDrawingComments(currentCommentsDrawingId);
    })
    .catch(function(err) {
      console.error(err);
      alert("Failed to delete comment: " + (err.message || err));
    });
}

function postDrawingComment() {
  if (!currentCommentsDrawingId || !commentsInput) return;
  var body = commentsInput.value.trim();
  if (!body) {
    alert("Please write a comment before posting.");
    return;
  }
  supabase.from("project_drawings").select("drawing_name, folder_id").eq("id", currentCommentsDrawingId).single()
    .then(function(drwRes) {
      if (drwRes.error) throw drwRes.error;
      var drawingName = drwRes.data.drawing_name;
      return supabase.from("project_folders").select("project_disciplines!inner(name)").eq("id", drwRes.data.folder_id).single()
        .then(function(folRes) {
          if (folRes.error) throw folRes.error;
          var discName = folRes.data.project_disciplines.name.replace(/^\d+_\s*/, "");
          return supabase.from("drawing_comments").insert([{
            drawing_id: currentCommentsDrawingId,
            project_id: currentActiveProjectId,
            user_id: currentUserId,
            body: body,
            drawing_name: drawingName,
            discipline_name: discName
          }]);
        });
    })
    .then(function(res) {
      if (res.error) throw res.error;
      commentsInput.value = "";
      openDrawingComments(currentCommentsDrawingId);
      notifyProjectMembers(currentActiveProjectId, {
        type: "comment",
        title: "New comment on " + drawingName,
        body: discName + " commented on " + drawingName + ": \u201C" + body + "\u201D"
      }, currentUserId);
    })
    .catch(function(err) {
      console.error(err);
      alert("Failed to post comment: " + (err.message || err));
    });
}

function updateProfileUi(profile) {
  currentSessionProfile = profile || currentSessionProfile;

  if (sidebarProfileCompany) {
    sidebarProfileCompany.textContent = currentSessionProfile.companyName || "Company name unavailable";
  }
  if (sidebarProfileEmail) {
    sidebarProfileEmail.textContent = currentSessionProfile.email || "Email unavailable";
  }
  if (profileModalCompany) {
    profileModalCompany.textContent = currentSessionProfile.companyName || "Company name unavailable";
  }
  if (profileModalName) {
    profileModalName.textContent = currentSessionProfile.fullName || "Name unavailable";
  }
  if (profileModalEmail) {
    profileModalEmail.textContent = currentSessionProfile.email || "Email unavailable";
  }
}

renderProjectTypes();
renderDisciplines();
renderAll();

document.body.addEventListener("input", function(event) {
  if (event.target.matches("input, select")) renderAll();
});

document.body.addEventListener("change", function(event) {
  if (event.target.matches("input, select")) renderAll();
});

// Custom project type: prompt when "Custom Project" is selected
function handleCustomProjectType(selectEl) {
  if (!selectEl) return;
  if (selectEl.value === "Custom Project") {
    var custom = prompt("Enter custom project type:");
    if (custom && custom.trim()) {
      var opt = document.createElement("option");
      opt.value = custom.trim();
      opt.text = custom.trim();
      opt.selected = true;
      selectEl.add(opt);
    } else {
      selectEl.value = "";
    }
  }
}
if (projectTypeSelect) {
  projectTypeSelect.addEventListener("change", function() {
    handleCustomProjectType(this);
  });
}
if (editProjectType) {
  editProjectType.addEventListener("change", function() {
    handleCustomProjectType(this);
  });
}

// Custom discipline: handle + button click on disciplineList
if (disciplineList) {
  disciplineList.addEventListener("click", function(e) {
    if (e.target.id === "addCustomDiscBtn" || e.target.parentElement.id === "addCustomDiscBtn") {
      var name = prompt("Enter custom discipline name:");
      if (name && name.trim()) {
        customDisciplines.push(name.trim());
        renderDisciplines();
        renderAll();
      }
    }
  });
}

document.body.addEventListener("input", function(event) {
  if (event.target.matches("#drawingSearchInput") && currentActiveProjectId) renderAllFolderDrawingFeeds(currentActiveProjectId);
});

document.body.addEventListener("change", function(event) {
  if (event.target.matches("#drawingDisciplineFilter, #drawingLevelFilter") && currentActiveProjectId) renderAllFolderDrawingFeeds(currentActiveProjectId);
});

if (closeRevisionHistoryBtn) {
  closeRevisionHistoryBtn.addEventListener("click", function() {
    if (revisionHistoryModalOverlay) revisionHistoryModalOverlay.style.display = "none";
  });
}

if (btnOpenProfile) {
  btnOpenProfile.addEventListener("click", function() {
    updateProfileUi(currentSessionProfile);
    if (profileModalOverlay) profileModalOverlay.style.display = "flex";
  });
}

if (closeProfileModalBtn) {
  closeProfileModalBtn.addEventListener("click", function() {
    if (profileModalOverlay) profileModalOverlay.style.display = "none";
  });
}

if (closeCommentsModalBtn) {
  closeCommentsModalBtn.addEventListener("click", function() {
    if (commentsModalOverlay) commentsModalOverlay.style.display = "none";
    currentCommentsDrawingId = null;
  });
}

if (commentsPostBtn) {
  commentsPostBtn.addEventListener("click", function() {
    postDrawingComment();
  });
}

if (commentsThread) {
  commentsThread.addEventListener("click", function(event) {
    var editBtn = event.target.closest(".comment-edit-btn");
    if (!editBtn) return;
    var commentId = editBtn.dataset.commentId;
    var item = commentsThread.querySelector('.comment-item[data-comment-id="' + commentId + '"]');
    if (!item) return;
    var bodyDiv = item.querySelector(".comment-body");
    if (!bodyDiv) return;
    var currentText = bodyDiv.textContent;
    bodyDiv.style.display = "none";
    var editForm = item.querySelector(".comment-edit-form");
    if (editForm) {
      editForm.style.display = "flex";
      editForm.querySelector("textarea").value = currentText;
      editForm.querySelector("textarea").focus();
      return;
    }
    editForm = document.createElement("div");
    editForm.className = "comment-edit-form";
    editForm.style.cssText = "display:flex; flex-direction:column; gap:6px; margin-top:4px;";
    editForm.innerHTML = '<textarea maxlength="100" rows="2" style="width:100%; min-height:40px; border:1px solid var(--line); border-radius:6px; padding:6px 8px; font-size:12px; font-family:inherit; box-sizing:border-box; resize:vertical;">' + currentText + '</textarea>' +
                          '<div style="display:flex; gap:6px;">' +
                            '<button type="button" class="comment-save-btn" data-comment-id="' + commentId + '" style="padding:4px 12px; background:var(--blue); color:#fff; border:0; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;">Save</button>' +
                            '<button type="button" class="comment-cancel-btn" style="padding:4px 12px; background:#e2e8f0; color:#4a5568; border:0; border-radius:4px; font-size:11px; cursor:pointer;">Cancel</button>' +
                          '</div>';
    item.appendChild(editForm);
    editForm.querySelector("textarea").focus();
  });

  commentsThread.addEventListener("click", function(event) {
    var saveBtn = event.target.closest(".comment-save-btn");
    if (!saveBtn) return;
    var commentId = saveBtn.dataset.commentId;
    var item = commentsThread.querySelector('.comment-item[data-comment-id="' + commentId + '"]');
    if (!item) return;
    var textarea = item.querySelector(".comment-edit-form textarea");
    if (!textarea) return;
    var newBody = textarea.value.trim();
    if (!newBody) { alert("Comment cannot be empty."); return; }
    supabase.from("drawing_comments").update({ body: newBody }).eq("id", commentId)
      .then(function(res) {
        if (res.error) throw res.error;
        openDrawingComments(currentCommentsDrawingId);
      })
      .catch(function(err) {
        console.error(err);
        alert("Failed to update comment: " + (err.message || err));
      });
  });

  commentsThread.addEventListener("click", function(event) {
    var cancelBtn = event.target.closest(".comment-cancel-btn");
    if (!cancelBtn) return;
    var item = cancelBtn.closest(".comment-item");
    if (!item) return;
    var bodyDiv = item.querySelector(".comment-body");
    var editForm = item.querySelector(".comment-edit-form");
    if (bodyDiv) bodyDiv.style.display = "";
    if (editForm) editForm.style.display = "none";
  });
}

if (commentsInput) {
  commentsInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      postDrawingComment();
    }
  });
}

var editHasCabinCheckbox = document.querySelector("#editHasCabin");

if (btnLogout) {
  btnLogout.addEventListener("click", function() {
    if (!supabase) return;
    btnLogout.disabled = true;
    btnLogout.textContent = "Signing Out...";
    supabase.auth.signOut()
      .then(function(res) {
        if (res.error) throw res.error;
        window.location.href = "auth.html?mode=login";
      })
      .catch(function(err) {
        alert("Logout failed: " + err.message);
        btnLogout.disabled = false;
        btnLogout.textContent = "Log Out";
      });
  });
}

// =========================================================================
// 🗂️ SIDEBAR TREE & PORTAL GRID LOADER (SECURED MULTI-TENANT FILTER)
// =========================================================================
function fetchAndRenderHubProjects() {
  if (!supabase) return;
  
  renderDisciplines();

  var currentLogUser = null;

  supabase.auth.getUser()
  .then(function(userRes) {
    if (userRes.error || !userRes.data.user) {
      window.location.href = "auth.html?mode=login";
      return null;
    }
    currentLogUser = userRes.data.user;
    currentUserId = String(userRes.data.user.id);
    setupPushNotifications();
    subscribeToNotifications();
    return currentLogUser;
  })
  .then(function(user) {
    if (!user) return null;

      return supabase
        .from("profiles")
        .select("full_name, company_name, email")
        .eq("id", user.id)
        .single()
        .then(function(profileRes) {
        var profile = profileRes.data || {};
        updateProfileUi({
          email: profile.email || user.email,
          fullName: profile.full_name || "",
          companyName: profile.company_name || ""
        });
        return user;
      });
  })
  .then(function(user) {
    if (!user) return;

    return Promise.all([
      supabase.from("projects").select("*").eq("status", "Active").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("project_invitations").select("project_id").eq("email", user.email).eq("status", "Accepted"),
      supabase.from("project_disciplines").select("project_id"),
      supabase.from("project_drawings").select("project_id, created_at").order("created_at", { ascending: false }),
      supabase.from("project_invitations").select("project_id, email").eq("status", "Accepted"),
      supabase.from("notifications").select("project_id, is_read").eq("user_id", user.id).eq("is_read", false)
    ]);
  })
  .then(function(results) {
    if (!results) return;
    
    var createdProjectsRes = results[0];
    var acceptedInvitesRes = results[1];
    var discData = results[2].data || [];
    var drwData = results[3].data || [];
    var allAcceptedInvites = results[4].data || [];
    var unreadCounts = {};
    var unreadRows = (results[5] && results[5].data) || [];
    for (var nr = 0; nr < unreadRows.length; nr++) {
      var np = unreadRows[nr].project_id;
      if (!unreadCounts[np]) unreadCounts[np] = 0;
      unreadCounts[np]++;
    }

    if (createdProjectsRes.error) throw createdProjectsRes.error;
    if (acceptedInvitesRes.error) throw acceptedInvitesRes.error;

    var sharedProjectIds = [];
    for (var k = 0; k < acceptedInvitesRes.data.length; k++) {
      sharedProjectIds.push(acceptedInvitesRes.data[k].project_id);
    }

    function countActiveNodes(projectId) {
      var count = 0;
      for (var ai = 0; ai < allAcceptedInvites.length; ai++) {
        if (allAcceptedInvites[ai].project_id === projectId) count++;
      }
      return count;
    }

    if (sharedProjectIds.length > 0) {
      return supabase.from("projects").select("*").eq("status", "Active").in("id", sharedProjectIds).order("created_at", { ascending: false })
        .then(function(sharedProjectsRes) {
          var seenIds = {};
          var combined = [];
          var allProjects = createdProjectsRes.data.concat(sharedProjectsRes.data || []);
          for (var cp = 0; cp < allProjects.length; cp++) {
            if (!seenIds[allProjects[cp].id]) {
              seenIds[allProjects[cp].id] = true;
              combined.push(allProjects[cp]);
            }
          }
          return { projects: combined, discData: discData, drwData: drwData, countActiveNodes: countActiveNodes, allAcceptedInvites: allAcceptedInvites, unreadCounts: unreadCounts };
        });
    } else {
      return { projects: createdProjectsRes.data, discData: discData, drwData: drwData, countActiveNodes: countActiveNodes, allAcceptedInvites: allAcceptedInvites, unreadCounts: unreadCounts };
    }
  })
  .then(function(payload) {
    if (!payload) return;
    
    var projectData = payload.projects;
    var discData = payload.discData;
    var drwData = payload.drwData;
    var countActiveNodes = payload.countActiveNodes;
    var allAcceptedInvites = payload.allAcceptedInvites;
    var unreadCounts = payload.unreadCounts || {};

    // Build a set of project_ids that have accepted invites (for quick lookup in card loop)
    var activeProjectIdsSet = {};
    for (var ai2 = 0; ai2 < allAcceptedInvites.length; ai2++) {
      activeProjectIdsSet[allAcceptedInvites[ai2].project_id] = true;
    }

    var gridContainer = document.querySelector("#projectCardsGrid");
    
    if (sidebarProjectTree) {
      sidebarProjectTree.innerHTML = "";
      if (projectData.length === 0) {
        sidebarProjectTree.innerHTML = '<span class="hint" style="font-size:11px; padding-left:10px;">No open tracks</span>';
      } else {
        for (var t = 0; t < projectData.length; t++) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tree-project-link";
          btn.setAttribute("data-project-id", projectData[t].id);
          btn.textContent = "🔹 " + projectData[t].name;
          sidebarProjectTree.appendChild(btn);
        }
      }
    }

    if (!gridContainer) return;
    if (projectData.length === 0) {
      gridContainer.innerHTML = '<div style="grid-column: span 3; padding: 40px; text-align: center; color: var(--muted); border: 2px dashed var(--line); border-radius: 8px;">No active projects recorded.</div>';
      showView("create");
      return;
    }

    var gridHtml = "";
    for (var i = 0; i < projectData.length; i++) {
      var p = projectData[i];
      var discCount = 0;
      for (var d = 0; d < discData.length; d++) {
        if (discData[d].project_id === p.id) discCount++;
      }
      var activeCount = countActiveNodes(p.id) + 1;

      var lastCommitTimeStr = "No data uploaded";
      var latestDrawingDate = null;
      for (var w = 0; w < drwData.length; w++) {
        if (drwData[w].project_id === p.id) {
          latestDrawingDate = new Date(drwData[w].created_at);
          break;
        }
      }
      var projectUpdatedDate = p.updated_at ? new Date(p.updated_at) : null;
      var latestDate = null;
      if (latestDrawingDate && projectUpdatedDate) {
        latestDate = latestDrawingDate > projectUpdatedDate ? latestDrawingDate : projectUpdatedDate;
      } else if (latestDrawingDate) {
        latestDate = latestDrawingDate;
      } else if (projectUpdatedDate) {
        latestDate = projectUpdatedDate;
      }
      if (latestDate) {
        lastCommitTimeStr = latestDate.toLocaleDateString("en-IN") + " " + latestDate.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
      }

      var token = "SC-" + p.id.substring(0, 5).toUpperCase();
      var nUnread = unreadCounts[p.id] || 0;
      var notifChipHtml = nUnread > 0
        ? '<span class="hub-notif-chip">' + nUnread + ' new notification' + (nUnread > 1 ? "s" : "") + '</span>'
        : '';
      gridHtml += '<div class="project-summary-card" data-project-id="' + p.id + '">' +
                  '<div class="card-meta">' +
                    notifChipHtml +
                    '<h3>' + p.name + '</h3>' +
                    '<p>📍 ' + p.location + ' • ' + p.project_type + '</p>' +
                    '<div class="card-metrics-box">' +
                      '<span>Disciplines: <strong>' + discCount + ' total</strong> · <strong>' + activeCount + ' active</strong></span>' +
                      '<span>Last Modified: <strong style="color:var(--blue);">' + lastCommitTimeStr + '</strong></span>' +
                      '<span style="margin-top:4px; padding-top:4px; border-top:1px solid var(--line); font-size:11px;">Your Role: <strong style="color:' + (String(p.user_id) === String(currentUserId) ? 'var(--green)' : 'var(--blue)') + ';">' + (String(p.user_id) === String(currentUserId) ? '👑 Project Admin' : '✅ Active Member') + '</strong></span>' +
                    '</div>' +
                  '</div>' +
                  '<div class="card-footer-row">' +
                    '<span class="card-token-lbl">' + token + '</span>' +
                    '<span class="card-status-badge">' + (p.status || "Active") + '</span>' +
                  '</div>' +
                '</div>';
    }
    gridContainer.innerHTML = gridHtml;

    if (currentActiveProjectId === null) {
      showView("hub");
    }
  })
  .catch(function(err) {
    console.error("Sync Aborted:", err);
  });
}

fetchAndRenderHubProjects();

// =========================================================================
// 🏗️ SOLID MOUNT ENGINE (HANDLES CARD DRAW OPERATIONS)
// =========================================================================
document.body.addEventListener("click", function(event) {
  var summaryCard = event.target.closest(".project-summary-card");
  if (summaryCard) {
    loadProjectWorkspaceDashboard(summaryCard.dataset.projectId);
    return;
  }

  var treeLink = event.target.closest(".tree-project-link");
  if (treeLink) {
    loadProjectWorkspaceDashboard(treeLink.dataset.projectId);
    return;
  }
});

var currentSessionResolvedRoleGlobal = ""; // Extracted global validation pointer to lock delete privileges down

function loadProjectWorkspaceDashboard(projectId) {
  if (!projectId || !supabase) return;
  
  var targetProject = null;
  var levelsList = [];
  var destination = document.querySelector("#adminWorkspaceContainer");
  var teamDestination = document.querySelector("#teamDirectoryGrid");
  
  if (destination) destination.innerHTML = '<p style="padding:20px; color:var(--muted);">Loading secure workspace nodes...</p>';
  if (teamDestination) teamDestination.innerHTML = '';

  var activeUserEmail = "";
  var activeUserId = "";
  var isProjectCreatorAdmin = false;
  var projectInvitationsList = [];
  
  // Dictionaries to map profile metadata
  var emailToCompanyMap = {};
  var idToProfileMap = {};

  supabase.auth.getUser()
    .then(function(uRes) {
      if (uRes.data && uRes.data.user) {
        activeUserEmail = uRes.data.user.email.toLowerCase().trim();
        activeUserId = String(uRes.data.user.id);
      }
      return Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("project_invitations").select("*").eq("project_id", projectId),
        supabase.from("profiles").select("id, email, company_name")
      ]);
    })
    .then(function(resArray) {
      targetProject = resArray[0].data;
      currentProjectData = targetProject;
      projectInvitationsList = resArray[1].data || [];
      var allProfiles = resArray[2].data || [];
      
      for (var p = 0; p < allProfiles.length; p++) {
        var prof = allProfiles[p];
        if (prof) {
          if (prof.id) idToProfileMap[String(prof.id)] = prof;
          if (prof.email) emailToCompanyMap[prof.email.toLowerCase().trim()] = prof.company_name;
        }
      }
      
      isProjectCreatorAdmin = (String(targetProject.user_id) === activeUserId);
      
      levelsList = getProjectLevelsFromCounts(
        targetProject.basement_count,
        targetProject.podium_count,
        targetProject.floor_count,
        targetProject.cabin_count > 0
      );

      var shortToken = "SC-" + targetProject.id.substring(0, 5).toUpperCase();
      document.querySelector("#dashProjectTitle").textContent = targetProject.name;
      document.querySelector("#dashProjectLocation").textContent = targetProject.location.toUpperCase() + " • " + targetProject.project_type.toUpperCase();
      document.querySelector("#dashProjectToken").textContent = shortToken;

      return supabase.from("project_invitations").select("discipline_id").eq("project_id", projectId).eq("email", activeUserEmail).eq("status", "Accepted").maybeSingle();
    })
    .then(function(inviteCheckRes) {
      if (inviteCheckRes && inviteCheckRes.data) {
        return supabase.from("project_disciplines").select("name").eq("id", inviteCheckRes.data.discipline_id).single()
          .then(function(dNameRes) {
            return dNameRes.data ? dNameRes.data.name : "Viewer";
          });
      } else {
        var defaultRole = "Owner";
        if (targetProject.project_config && targetProject.project_config.joining_as) {
          defaultRole = targetProject.project_config.joining_as.toString();
        }
        return defaultRole;
      }
    })
    .then(function(resolvedRole) {
      currentSessionResolvedRoleGlobal = resolvedRole; 
      
      if (dashDeleteProjectBtn && dashEditProjectBtn && dashLeaveProjectBtn) {
        if (isProjectCreatorAdmin) {
          dashDeleteProjectBtn.style.setProperty("display", "inline-block", "important");
          dashEditProjectBtn.style.setProperty("display", "inline-block", "important");
          dashLeaveProjectBtn.style.setProperty("display", "none", "important");
        } else {
          dashDeleteProjectBtn.style.setProperty("display", "none", "important");
          dashEditProjectBtn.style.setProperty("display", "none", "important");
          dashLeaveProjectBtn.style.setProperty("display", "inline-block", "important");
        }
      }

      setupProjectNotifications(projectId);

      return supabase.from("project_folders").select("*").eq("project_id", projectId).order("sort_order", { ascending: true })
        .then(function(folderRes) {
          return { savedFolders: folderRes.data, joiningAs: resolvedRole };
        });
    })
    .then(function(context) {
      var savedFolders = context.savedFolders;
      var joiningAs = context.joiningAs;

      if (!destination) return;
      destination.innerHTML = ""; 

      // Extract Admin Profile specific logic
      var adminProf = idToProfileMap[String(targetProject.user_id)];
      var adminCompName = (adminProf && adminProf.company_name) ? adminProf.company_name : "Company name unavailable";
      var adminEmail = (adminProf && adminProf.email) ? adminProf.email : "";

      var defaultAdminRole = "Owner";
      if (targetProject.project_config && targetProject.project_config.joining_as) {
        defaultAdminRole = targetProject.project_config.joining_as.toString();
      }

      // ===============================================================
      // 👥 RENDER TEAM DIRECTORY TAB
      // ===============================================================
      if (teamDestination) {
        var teamHtml = "";
        
        // 1. Render Admin first
        teamHtml += '<div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; padding:12px 16px; border-radius:6px;">' +
                      '<div>' +
                        '<div style="font-weight:700; color:#1a1a1a; font-size:14px;">' + defaultAdminRole.toUpperCase() + '</div>' + // Role first
                        '<div style="color:#4a5568; font-size:13px; margin-top:2px;">' + adminCompName + '</div>' + // Company Name
                        '<div style="color:#718096; font-size:11px; margin-top:2px;">' + adminEmail + '</div>' + // Email
                      '</div>' +
                      '<span class="chip" style="background:#e6fffa; color:#234e52; border: 1px solid #b2f5ea; padding:4px 8px; font-size:10px; font-weight:800; border-radius:4px;">ROOT ADMIN</span>' +
                    '</div>';

        // 2. Render Invited Members (skip admin's own invitation to avoid duplicates)
        for (var t = 0; t < projectInvitationsList.length; t++) {
           var invRow = projectInvitationsList[t];
           if (invRow.status === "Accepted") {
             if (invRow.email.toLowerCase().trim() === adminEmail.toLowerCase().trim()) continue;
             var invRoleName = "Consultant";
             for (var fLookup = 0; fLookup < savedFolders.length; fLookup++) {
               if (savedFolders[fLookup].discipline_id === invRow.discipline_id) {
                 invRoleName = savedFolders[fLookup].folder_name.replace(/^\d+_\s*/, "");
                 break;
               }
             }
             var invCompName = emailToCompanyMap[invRow.email.toLowerCase().trim()] || "Independent Consultant";
             
              var memberActions = '<span class="chip" style="background:#edf2f7; color:#4a5568; border: 1px solid #e2e8f0; padding:4px 8px; font-size:10px; font-weight:800; border-radius:4px;">ACTIVE MEMBER</span>';
              if (isProjectCreatorAdmin) {
                memberActions += ' <span data-transfer-admin="' + invRow.email + '" data-transfer-disc-id="' + invRow.discipline_id + '" style="cursor:pointer; color:var(--blue); font-size:11px; font-weight:700; text-decoration:underline; margin-left:8px;">Transfer Admin</span>';
              }
              teamHtml += '<div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #e2e8f0; padding:12px 16px; border-radius:6px; margin-top:8px;">' +
                           '<div>' +
                             '<div style="font-weight:700; color:#1a1a1a; font-size:14px;">' + invRoleName.toUpperCase() + '</div>' + // Role first
                             '<div style="color:#4a5568; font-size:13px; margin-top:2px;">' + invCompName + '</div>' + // Company Name
                             '<div style="color:#718096; font-size:11px; margin-top:2px;">' + invRow.email + '</div>' + // Email
                           '</div>' +
                           '<div>' + memberActions + '</div>' +
                         '</div>';
           }
        }
        teamDestination.innerHTML = teamHtml;
      }

      // ===============================================================
      // 📂 RENDER FOLDER CARDS
      // ===============================================================
      for (var f = 0; f < savedFolders.length; f++) {
        var folder = savedFolders[f];
        var rawDisciplineName = folder.folder_name.replace(/^\d+_\s*/, "");
        var isSelfJoined = (rawDisciplineName.toLowerCase().trim() === joiningAs.toLowerCase().trim());
        var isAdminFolder = (rawDisciplineName.toLowerCase().trim() === defaultAdminRole.toLowerCase().trim());

        // Check if an accepted or pending invite is logged for this specific column block
        var activeInviteRow = null;
        for (var i = 0; i < projectInvitationsList.length; i++) {
          if (projectInvitationsList[i].discipline_id === folder.discipline_id) {
            activeInviteRow = projectInvitationsList[i];
            break;
          }
        }

        var cardEl = document.createElement("div");
        cardEl.className = "workspace-card";
        cardEl.setAttribute("data-folder-id", folder.id);
        cardEl.setAttribute("data-discipline-name", rawDisciplineName);
        cardEl.style.cssText = "margin-bottom: 20px; padding: 16px; background: #fff; border-radius: 8px; border: 1px solid var(--line);";

        var headerEl = document.createElement("div");
        headerEl.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #f0f2f0;";

        var headerRightHtml = "";
        if (isProjectCreatorAdmin) {
          if (isSelfJoined) {
            headerRightHtml += '<span class="chip">👑 Workspace Creator (You)</span>';
          } else if (activeInviteRow && activeInviteRow.status === "Accepted") {
            var compName = emailToCompanyMap[activeInviteRow.email.toLowerCase().trim()] || "Company name unavailable";
            headerRightHtml += '<span style="display:inline-flex; align-items:center; gap:8px; background:#f0fff4; border:1px solid #c6f6d5; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:700; color:#22543d;">✅ Connected: ' + compName + '</span>' +
                               '<span style="font-size:10px; text-transform:uppercase; background:#38a169; color:#fff; padding:2px 6px; font-weight:800; border-radius:4px;">Active Member</span>';
          } else if (activeInviteRow && activeInviteRow.status === "Pending") {
            headerRightHtml += '<span style="display:inline-flex; align-items:center; gap:4px; padding:6px; font-size:12px; background:#edf2f7; border:1px solid var(--line); border-radius:4px; color:#4a5568;">' +
                                 '<span style="overflow:hidden; text-overflow:ellipsis; max-width:160px;">' + activeInviteRow.email + '</span>' +
                                 '<span class="dash-card-edit-invite" data-disc-id="' + folder.discipline_id + '" style="cursor:pointer; font-size:14px; user-select:none;" title="Change email">✏️</span>' +
                               '</span>' +
                               '<span style="padding:4px 8px; font-size:11px; background:#cbd5e0; color:#718096; border-radius:4px; font-weight:700;">Pending</span>' +
                               '<button type="button" class="dash-card-resend-btn" data-disc-email="' + activeInviteRow.email + '" data-disc-id="' + folder.discipline_id + '" data-disc-name="' + folder.folder_name + '" style="padding:6px 12px; font-size:12px; background:var(--blue); color:#fff; border:0; border-radius:4px; cursor:pointer;">Resend</button>';
          } else {
            headerRightHtml += '<span style="font-size:12px; color:#4a5568;">Discipline Administrator</span>' +
                               '<input type="email" id="dash_invite_' + folder.discipline_id + '" placeholder="consultant@firm.com" style="width:180px; padding:6px; font-size:12px; border:1px solid var(--line); border-radius:4px;" />' +
                               '<button type="button" class="dash-card-invite-btn" data-disc-id="' + folder.discipline_id + '" data-disc-name="' + folder.folder_name + '" style="padding:6px 12px; font-size:12px; background:var(--blue); color:#fff; border:0; border-radius:4px; cursor:pointer;">Invite</button>';
          }
        } else {
          if (isSelfJoined) {
            headerRightHtml += '<span class="chip">🔒 Your Active Assigned Node</span>';
          } else if (isAdminFolder) {
            headerRightHtml += '<span style="display:inline-flex; align-items:center; gap:8px; background:#f0fff4; border:1px solid #c6f6d5; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:700; color:#22543d;">✅ Connected: ' + adminCompName + '</span>' +
                               '<span style="font-size:10px; text-transform:uppercase; background:#38a169; color:#fff; padding:2px 6px; font-weight:800; border-radius:4px;">Project Admin</span>';
          } else if (activeInviteRow && activeInviteRow.status === "Accepted") {
            var compName = emailToCompanyMap[activeInviteRow.email.toLowerCase().trim()] || "Company name unavailable";
            headerRightHtml += '<span style="display:inline-flex; align-items:center; gap:8px; background:#f0fff4; border:1px solid #c6f6d5; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:700; color:#22543d;">✅ Connected: ' + compName + '</span>' +
                               '<span style="font-size:10px; text-transform:uppercase; background:#38a169; color:#fff; padding:2px 6px; font-weight:800; border-radius:4px;">Active Member</span>';
          } else {
            headerRightHtml += '<span class="hint" style="font-size:11px; color:#a0aec0;">External managed corporate track node</span>';
          }
        }

        headerEl.innerHTML = '<div class="ws-card-header-title" style="flex:1; min-width:160px;">📂 ' + folder.folder_name + '</div>' +
                             '<div class="ws-card-header-actions" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex-shrink:0;">' + headerRightHtml + '</div>';
        cardEl.appendChild(headerEl);

        var bodyEl = document.createElement("div");
        bodyEl.className = "workspace-card-body";

        var subDirWrapper = document.createElement("div");
        subDirWrapper.style.cssText = "background: #fcfdfe; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; overflow: hidden;";

        var dirRowBtn = document.createElement("div");
        dirRowBtn.id = "dir_btn_" + folder.id;
        dirRowBtn.className = "folder-toggle-bar";
        dirRowBtn.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; cursor: pointer; user-select: none; border-bottom: 1px solid transparent;";
        dirRowBtn.innerHTML = `
          <div class="folder-toggle-name" style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📁</span>
            <span style="font-weight: 600; font-size: 14px; color: #2d3748;">${folder.folder_name.toLowerCase()}_files</span>
          </div>
          <div class="folder-toggle-meta" style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
            <span id="last_mod_header_${folder.id}" style="font-size: 11px; color: #718096; font-weight: 500;">Last Updated: Loading...</span>
            <span id="dir_arrow_${folder.id}" style="font-size: 12px; color: #a0aec0; transition: transform 0.2s;">▼</span>
          </div>
        `;
        subDirWrapper.appendChild(dirRowBtn);

        var floorLevelsContainer = document.createElement("div");
        floorLevelsContainer.id = "collapse_container_" + folder.id;
        floorLevelsContainer.style.cssText = "display: none; flex-direction: column; background: #ffffff; border-top: 1px solid #e2e8f0; padding: 8px 12px; gap: 10px;";

        for (var l = 0; l < levelsList.length; l++) {
          var lvlNode = document.createElement("div");
          var levelFolderKey = sanitizeLevelFolderKey(levelsList[l]);
          lvlNode.className = "workspace-level-node";
          lvlNode.setAttribute("data-level-folder", levelFolderKey);
          lvlNode.style.cssText = "background: #fafbfa; border: 1px solid #edf2f7; border-radius: 6px; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px;";

          var headerRow = document.createElement("div");
          headerRow.style.cssText = "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;";
          var addFileBtnHtml = isSelfJoined
            ? '<button type="button" class="level-add-file-btn" style="background: var(--blue); color: #fff; border: 0; border-radius: 5px; padding: 5px 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; cursor: pointer; box-shadow: 0 1px 2px rgba(15,23,42,0.15);">+ ADD NEW FILE</button>'
            : '';
          headerRow.innerHTML = '<div style="font-weight: 700; font-size: 12px; color: #4a5568; flex: 1; min-width: 130px;">📁 ' + levelsList[l] + '</div>' +
                                '<button type="button" class="level-files-toggle" style="display: inline-flex; align-items: center; gap: 6px; background: #ffffff; border: 1px solid #cbd5e0; border-radius: 5px; padding: 5px 10px; font-size: 11px; font-weight: 700; color: #4a5568; cursor: pointer;">' +
                                  '<span style="font-size: 12px;">🗂</span>' +
                                  '<span class="level-file-count">0 files</span>' +
                                  '<span class="level-arrow" style="font-size: 9px; color: #a0aec0;">▾</span>' +
                                '</button>' +
                                addFileBtnHtml;
          lvlNode.appendChild(headerRow);

          var feedContainer = document.createElement("div");
          feedContainer.id = "feed_" + folder.id + "_" + levelFolderKey;
          feedContainer.className = "drawings-feed-container";
          feedContainer.setAttribute("data-folder-discipline-name", rawDisciplineName); // Embedded context logic mapping tag anchor
          feedContainer.style.cssText = "display: none; flex-direction: column; gap: 6px; padding-left: 10px; border-left: 2px dashed #cbd5e0;";
          lvlNode.appendChild(feedContainer);

          (function(fId, lName, dRole, selfCheck) {
            var addFileBtn = headerRow.querySelector(".level-add-file-btn");
            if (addFileBtn) {
              addFileBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                openUploadLedgerModal(fId, lName, dRole, selfCheck);
              });
            }
            headerRow.querySelector(".level-files-toggle").addEventListener("click", function(e) {
              e.stopPropagation();
              var feed = document.getElementById("feed_" + fId + "_" + sanitizeLevelFolderKey(lName));
              var arrow = this.querySelector(".level-arrow");
              if (feed && (feed.style.display === "none" || feed.style.display === "")) {
                feed.style.display = "flex";
                if (arrow) arrow.textContent = "▴";
              } else if (feed) {
                feed.style.display = "none";
                if (arrow) arrow.textContent = "▾";
              }
            });
          })(folder.id, levelsList[l], folder.folder_name, isSelfJoined);

          floorLevelsContainer.appendChild(lvlNode);
        }
        subDirWrapper.appendChild(floorLevelsContainer);
        bodyEl.appendChild(subDirWrapper);

        (function(fId) {
          var targetBtn = subDirWrapper.querySelector("#dir_btn_" + fId);
          var targetContent = subDirWrapper.querySelector("#collapse_container_" + fId);
          var targetArrow = subDirWrapper.querySelector("#dir_arrow_" + fId);
          
          targetBtn.addEventListener("click", function(e) {
            if (e.target.closest(".drawing-ledger-row") || e.target.closest("a") || e.target.closest("button")) return;
            var isHidden = targetContent.style.display === "none";
            targetContent.style.display = isHidden ? "flex" : "none";
            targetBtn.style.borderBottomColor = isHidden ? "#e2e8f0" : "transparent";
            targetArrow.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
          });
        })(folder.id);

        cardEl.appendChild(bodyEl);
        destination.appendChild(cardEl);
      }
      
      currentActiveProjectId = projectId;
      showView("dashboard", projectId);
      renderAllFolderDrawingFeeds(projectId);
    })
    .catch(function(err) {
      console.error("Workspace Engine Failure:", err);
    });
}

// =========================================================================
// 📥 FETCH AND RENDER DRAWINGS SUB-FEED DIRECTORIES + LIVE TIMELINE AUDIT
// =========================================================================
function renderAllFolderDrawingFeeds(projectId) {
  if (!supabase) return;
  
  supabase
    .from("project_drawings")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false }) 
    .then(function(res) {
      if (res.error) throw res.error;
      var drawings = res.data;
      currentProjectDrawings = drawings;
      renderDrawingFilterOptions(drawings);

      var timelineContainer = document.querySelector("#dashActivityFeedPanel");
      if (timelineContainer) {
        var timelineHtml = "";
        for (var a = 0; a < drawings.length; a++) {
          var row = drawings[a];
          var dateObj = new Date(row.created_at);
          var stampText = dateObj.toLocaleDateString("en-IN") + " " + dateObj.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
          var shortRole = row.uploaded_by.replace(/^\d+_\s*/, "");
          
          var actionString = row.revision_number === 0 
            ? ' deployed baseline asset track ' 
            : ' committed revision track suffix <strong>R' + row.revision_number + '</strong> for ';

          var verTag = "";
          if (!row.is_visible) {
            verTag = row.file_path ? ' <small style="color:var(--muted);">(Archived Version)</small>' : ' <small style="color:#c93b2b;">(Removed)</small>';
          }
          timelineHtml += '<div style="font-size:12px; padding:6px 10px; background:#fbfcfb; border:1px solid #eef1ef; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">' +
                            '<span>🚀 <strong>' + shortRole + '</strong>' + actionString + '<strong>' + row.drawing_name + '.pdf</strong>' + verTag + '</span>' +
                            '<span style="font-family:monospace; color:var(--muted); font-size:11px;">' + stampText + '</span>' +
                          '</div>';
        }
        timelineContainer.innerHTML = timelineHtml || '<span class="hint" style="text-align:center; padding:10px; display:block;">No transactions committed to this coordination tracker yet.</span>';
        // Render comment activity in separate panel
        var commentsFeedPanel = document.querySelector("#dashCommentsFeedPanel");
        if (commentsFeedPanel) {
          supabase.from("drawing_comments").select("body, drawing_name, discipline_name, created_at, profiles:user_id(company_name)").eq("project_id", projectId).order("created_at", { ascending: false })
            .then(function(commRes) {
              if (commRes.error) return;
              var commHtml = "";
              if (commRes.data && commRes.data.length) {
                for (var ca = 0; ca < commRes.data.length; ca++) {
                  var cr = commRes.data[ca];
                  var cd = new Date(cr.created_at);
                  var cs = cd.toLocaleDateString("en-IN") + " " + cd.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
                  var comp = (cr.profiles && cr.profiles.company_name) ? cr.profiles.company_name : "Unknown";
                  var disc = cr.discipline_name || "Unknown";
                  commHtml += '<div style="font-size:12px; padding:6px 10px; background:#f0f4ff; border:1px solid #d4e0f5; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">' +
                                '<span>💬 <strong>' + comp + '</strong> commented on <strong>' + cr.drawing_name + '.pdf</strong> of <strong>' + disc + '</strong></span>' +
                                '<span style="font-family:monospace; color:var(--muted); font-size:11px;">' + cs + '</span>' +
                              '</div>';
                }
              }
              commentsFeedPanel.innerHTML = commHtml || '<span class="hint" style="text-align:center; padding:10px; display:block;">No comment activity yet.</span>';
            })
            .catch(function() {
              commentsFeedPanel.innerHTML = '<span class="hint" style="text-align:center; padding:10px; display:block;">No comment activity yet.</span>';
            });
        }
      }

      var targets = document.querySelectorAll(".drawings-feed-container");
      for (var t = 0; t < targets.length; t++) { targets[t].innerHTML = ""; }

      var headers = document.querySelectorAll("[id^='last_mod_header_']");
      for (var h = 0; h < headers.length; h++) { headers[h].textContent = "Last Updated: No data uploaded"; }

      applyWorkspaceFilterVisibility({}, {});

      var matchedFolderMap = {};
      var matchedLevelMap = {};

      for (var d = 0; d < drawings.length; d++) {
        var drw = drawings[d];
        if (!drw.is_visible) continue; 
        if (!drawingMatchesActiveFilters(drw)) continue;

        var publicFileUrl = SUPABASE_URL + "/storage/v1/object/public/project-files/" + drw.file_path;
        var levelFolderName = getLevelFolderFromDrawing(drw);
        
        var feedId = "feed_" + drw.folder_id + "_" + levelFolderName;
        var feedContainer = document.getElementById(feedId);
        matchedFolderMap[String(drw.folder_id)] = true;
        matchedLevelMap[String(drw.folder_id) + "|" + levelFolderName] = true;
        
        var dateObj = new Date(drw.created_at);
        var stampText = dateObj.toLocaleDateString("en-IN") + " " + dateObj.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' });
        var folderHeaderNode = document.getElementById("last_mod_header_" + drw.folder_id);
        if (folderHeaderNode && (folderHeaderNode.textContent.includes("Loading...") || folderHeaderNode.textContent.includes("No data"))) {
          folderHeaderNode.textContent = "Last Updated: " + stampText;
        }

        if (feedContainer) {
          var revLabel = drw.revision_number === 0 ? "R0" : "R" + drw.revision_number;
          var rawFolderDiscTag = feedContainer.getAttribute("data-folder-discipline-name") || "";
          
          // ABSOLUTE LIABILITY CONTROLLER: Evaluate if active account holds authorization keys to alter this folder target string row
          var isCustodianAuthorizedToDelete = (rawFolderDiscTag.toLowerCase().trim() === currentSessionResolvedRoleGlobal.toLowerCase().trim());
          
          var trashTriggerHtmlButton = '';
          if (isCustodianAuthorizedToDelete) {
            // Render the trigger ONLY if they possess custody credentials matching this specific column tracking node
            trashTriggerHtmlButton = '<button type="button" onclick="executeDrawingSoftDelete(\'' + drw.id + '\', \'' + rawFolderDiscTag + '\')" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #e53e3e; cursor: pointer; font-size: 13px; padding: 3px 7px; line-height: 1;" title="Delete file">🗑️</button>';
          }

          var rowHtml = '<div class="drawing-ledger-row" onclick="event.stopPropagation();" style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; margin-top: 4px; width: 100%; box-shadow: 0 1px 2px rgba(0,0,0,0.01);">' +
                          '<div style="display: flex; align-items: center; gap: 8px; overflow: hidden; min-width: 0; flex: 1;">' +
                            '<span style="background: var(--blue); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; flex-shrink: 0;">' + revLabel + '</span>' +
                            '<a href="' + publicFileUrl + '" target="_blank" rel="noopener" title="Open PDF" style="display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; color: #2d3748; text-decoration: none; cursor: pointer; vertical-align: bottom;">📄 ' + drw.drawing_name + '.pdf</a>' +
                          '</div>' +
                          '<div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">' +
                            '<span style="font-size: 11px; color: #a0aec0; margin-right: 4px;">' + stampText + '</span>' +
                            '<button type="button" onclick="openRevisionHistory(\'' + drw.id + '\')" title="Revision History" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #2d3748; cursor: pointer; font-size: 13px; padding: 3px 7px; line-height: 1;">↺</button>' +
                            '<button type="button" onclick="openDrawingComments(\'' + drw.id + '\')" title="Comments" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #2d3748; cursor: pointer; font-size: 13px; padding: 3px 7px; line-height: 1;">💬</button>' +
                            trashTriggerHtmlButton +
                          '</div>' +
                        '</div>';
          feedContainer.innerHTML += rowHtml;
        }
      }

      var feedContainers = document.querySelectorAll(".drawings-feed-container");
      for (var fc = 0; fc < feedContainers.length; fc++) {
        var feedEl = feedContainers[fc];
        var rowCount = feedEl.querySelectorAll(".drawing-ledger-row").length;
        var countEl = feedEl.parentElement ? feedEl.parentElement.querySelector(".level-file-count") : null;
        if (countEl) countEl.textContent = rowCount + (rowCount === 1 ? " file" : " files");
      }

      applyWorkspaceFilterVisibility(matchedFolderMap, matchedLevelMap);
    })
    .catch(function(err) {
      console.error(err);
    });
}

// =========================================================================
// 🗑️ SYSTEM LOGICAL REVISION OVERRIDE CONTROLLER
// =========================================================================
window.executeDrawingSoftDelete = function(drawingId, folderDisciplineName) {
  if (!supabase || !currentActiveProjectId) return;

  // Final confirmation verification pass check loop
  if (folderDisciplineName.toLowerCase().trim() !== currentSessionResolvedRoleGlobal.toLowerCase().trim()) {
    alert("Security Boundary Block: You cannot delete a drawing layout file committed by an external discipline.");
    return;
  }

  var verify = confirm("Are you sure you want to delete this file?\n\nThe deleted file cannot be recovered from StradConnect. Only the history record will be retained.");
  if (!verify) return;

  supabase
    .from("project_drawings")
    .select("file_path")
    .eq("id", drawingId)
    .then(function(res) {
      if (res.error) throw res.error;
      var filePath = res.data && res.data[0] ? res.data[0].file_path : "";
      var delChain = Promise.resolve();
      if (filePath) {
        delChain = supabase.storage.from("project-files").remove([filePath]);
      }
      return delChain.then(function() {
        return supabase.from("project_drawings").update({ is_visible: false, file_path: "" }).eq("id", drawingId);
      });
    })
    .then(function() {
      alert("🗑️ File deleted. The history record has been retained.");
      renderAllFolderDrawingFeeds(currentActiveProjectId);
    })
    .catch(function(err) {
      console.error("Deletion Failed:", err);
      alert("Could not delete the file. Please try again.");
    });
};

// =========================================================================
// ❌ ADMINISTRATIVE LOGICAL PROJECT SOFT-DELETE EXECUTOR
// =========================================================================
function purgeProjectAndArchive(projectId) {
  var projectRow = null;
  var filePaths = [];
  var adminEmail = "";
  var memberEmails = [];

  return supabase.from("projects").select("*").eq("id", projectId).single()
    .then(function(res) {
      if (res.error) throw res.error;
      projectRow = res.data;
      return Promise.all([
        supabase.from("project_drawings").select("file_path").eq("project_id", projectId),
        supabase.from("project_invitations").select("email").eq("project_id", projectId).eq("status", "Accepted"),
        supabase.from("profiles").select("email").eq("id", projectRow.user_id).maybeSingle()
      ]);
    })
    .then(function(arr) {
      var drawings = (arr[0] && arr[0].data) || [];
      var members = (arr[1] && arr[1].data) || [];
      var adminProf = (arr[2] && arr[2].data) || {};
      for (var d = 0; d < drawings.length; d++) {
        if (drawings[d].file_path) filePaths.push(drawings[d].file_path);
      }
      adminEmail = adminProf.email || "";
      memberEmails.push(adminEmail);
      for (var m = 0; m < members.length; m++) {
        if (members[m].email && memberEmails.indexOf(members[m].email) === -1) memberEmails.push(members[m].email);
      }
      if (filePaths.length > 0) {
        return supabase.storage.from("project-files").remove(filePaths).then(function(storageRes) {
          if (storageRes.error) console.error("Storage cleanup partial:", storageRes.error);
          return null;
        });
      }
      return null;
    })
    .then(function() {
      return supabase.from("deleted_projects").insert([{
        project_id: projectRow.id,
        project_name: projectRow.name,
        project_location: projectRow.location,
        project_type: projectRow.project_type,
        basements: projectRow.basement_count || 0,
        podiums: projectRow.podium_count || 0,
        floors: projectRow.floor_count || 0,
        cabin_count: projectRow.cabin_count || 0,
        admin_user_id: projectRow.user_id,
        admin_email: adminEmail,
        member_emails: memberEmails,
        member_count: memberEmails.length,
        file_count: filePaths.length,
        project_created_at: projectRow.created_at,
        deleted_at: new Date().toISOString()
      }]);
    })
    .then(function(archiveRes) {
      if (archiveRes.error) throw archiveRes.error;
      return supabase.from("projects").delete().eq("id", projectId);
    })
    .then(function(delRes) {
      if (delRes.error) throw delRes.error;
      return null;
    });
}

if (dashDeleteProjectBtn) {
  dashDeleteProjectBtn.addEventListener("click", function() {
    if (!currentActiveProjectId || !supabase) return;

    var verification = confirm("⚠️ PERMANENT DELETE WARNING\n\nThis permanently deletes this project, ALL its drawing files, folders, members, comments and notifications from the database and storage.\n\nOnly a metadata record is kept (project name, specs, member emails, file count, created/deleted dates) for usage tracking.\n\nThis CANNOT be undone. Delete anyway?");
    if (!verification) return;

    dashDeleteProjectBtn.disabled = true;
    dashDeleteProjectBtn.textContent = "Deleting Permanently...";

    purgeProjectAndArchive(currentActiveProjectId)
      .then(function() {
        alert("🗑️ Project permanently deleted. A metadata record was archived for usage tracking.");
        teardownProjectNotifications();
        currentActiveProjectId = null;
        fetchAndRenderHubProjects();
        showView("hub");
        dashDeleteProjectBtn.disabled = false;
        dashDeleteProjectBtn.textContent = "Delete Project";
      })
      .catch(function(err) {
        console.error(err);
        alert("Delete failed: " + (err.message || err));
        dashDeleteProjectBtn.disabled = false;
        dashDeleteProjectBtn.textContent = "Delete Project";
      });
  });
}

if (dashLeaveProjectBtn) {
  dashLeaveProjectBtn.addEventListener("click", function() {
    if (!confirm("Are you sure you want to leave this project?")) return;
    dashLeaveProjectBtn.disabled = true;
    dashLeaveProjectBtn.textContent = "Leaving...";
    supabase.auth.getUser().then(function(userRes) {
      var userEmail = (userRes.data && userRes.data.user) ? userRes.data.user.email : "";
      if (!userEmail) {
        alert("Could not identify your account.");
        dashLeaveProjectBtn.disabled = false;
        dashLeaveProjectBtn.textContent = "Leave Project";
        return;
      }
      supabase.from("project_invitations").delete()
        .eq("project_id", currentActiveProjectId)
        .eq("email", userEmail.toLowerCase().trim())
        .eq("status", "Accepted")
        .then(function(res) {
          if (res.error) throw res.error;
          alert("You have left the project.");
          notifyProjectAdmin(currentActiveProjectId, {
            type: "member_left",
            title: "Member left the project",
            body: userEmail + " left the project workspace."
          });
          showView("hub");
          fetchAndRenderHubProjects();
        })
        .catch(function(err) {
          console.error(err);
          alert("Failed to leave project: " + (err.message || err));
          dashLeaveProjectBtn.disabled = false;
          dashLeaveProjectBtn.textContent = "Leave Project";
        });
    }).catch(function() {
      alert("Could not verify your session.");
      dashLeaveProjectBtn.disabled = false;
      dashLeaveProjectBtn.textContent = "Leave Project";
    });
  });
}

// =========================================================================
// ✏️ EDIT PROJECT MODAL LOGIC
// =========================================================================
var currentEditDisciplines = {};

var editCustomDisciplines = [];

function renderEditDisciplines() {
  if (!editDisciplinesList) return;
  var html = "";
  for (var d = 0; d < disciplines.length; d++) {
    var disc = disciplines[d];
    if (disc === "Custom Discipline") continue;
    var checked = currentEditDisciplines[disc] ? "checked" : "";
    html += '<label style="display:flex; flex-direction:row; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--line); border-radius:4px; background:#fbfcfb; cursor:pointer; font-size:13px;">' +
              '<input type="checkbox" data-edit-disc="' + disc + '" ' + checked + ' style="width:16px; height:16px;" />' +
              disc +
            '</label>';
  }
  // Render edit custom disciplines added in this session
  for (var ec = 0; ec < editCustomDisciplines.length; ec++) {
    html += '<label style="display:flex; flex-direction:row; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--line); border-radius:4px; background:#fbfcfb; cursor:pointer; font-size:13px;">' +
              '<input type="checkbox" data-edit-disc="' + editCustomDisciplines[ec] + '" checked style="width:16px; height:16px;" />' +
              editCustomDisciplines[ec] +
            '</label>';
  }
  // Add button (max 1 custom discipline per edit session)
  if (editCustomDisciplines.length < 1) {
    html += '<label id="addEditCustomDiscBtn" style="display:flex; align-items:center; justify-content:center; gap:6px; padding:8px 10px; border:1px dashed var(--blue); border-radius:4px; background:#fbfcfb; cursor:pointer; font-size:13px; color:var(--blue); font-weight:600; user-select:none;">+ Add Custom Discipline</label>';
  }
  editDisciplinesList.innerHTML = html;
}

// Click handler for edit custom discipline button (event delegation)
document.body.addEventListener("click", function(e) {
  if (e.target.id === "addEditCustomDiscBtn") {
    var name = prompt("Enter custom discipline name:");
    if (name && name.trim()) {
      editCustomDisciplines.push(name.trim());
      renderEditDisciplines();
    }
  }
});

// Transfer Admin click handler
document.body.addEventListener("click", function(e) {
  var transferBtn = e.target.closest("[data-transfer-admin]");
  if (!transferBtn || !supabase) return;
  var targetEmail = transferBtn.getAttribute("data-transfer-admin");
  var targetDiscId = transferBtn.getAttribute("data-transfer-disc-id");
  if (!targetEmail || !targetDiscId || !currentActiveProjectId) return;
  if (!confirm("Transfer admin role to " + targetEmail + "? You will become a regular member.")) return;

  var oldAdminDiscName = "";
  if (currentProjectData && currentProjectData.project_config && currentProjectData.project_config.joining_as) {
    oldAdminDiscName = currentProjectData.project_config.joining_as.toString();
  }
  if (!oldAdminDiscName) { alert("Cannot determine your current discipline."); return; }

  // Lookup discipline IDs and new admin's user ID
  supabase.from("profiles").select("id").eq("email", targetEmail.toLowerCase().trim()).maybeSingle()
    .then(function(profRes) {
      if (profRes.error) throw profRes.error;
      if (!profRes.data) throw new Error("User not found for email: " + targetEmail);
      var newAdminId = profRes.data.id;

      return supabase.from("project_disciplines").select("name").eq("id", targetDiscId).single()
        .then(function(discRes) {
          if (discRes.error) throw discRes.error;
          if (!discRes.data) throw new Error("Discipline not found");
          var newAdminDiscName = discRes.data.name;

          // Get the old admin's discipline_id
          return supabase.from("project_disciplines").select("id").eq("project_id", currentActiveProjectId).eq("name", oldAdminDiscName).maybeSingle()
            .then(function(oldDiscRes) {
              if (oldDiscRes.error) throw oldDiscRes.error;
              if (!oldDiscRes.data) throw new Error("Old admin discipline not found");

              var oldAdminDiscId = oldDiscRes.data.id;

              // Get current user's email for the invitation
              return supabase.auth.getUser().then(function(uRes) {
                if (uRes.error || !uRes.data.user) throw new Error("Session expired");
                var oldAdminEmail = uRes.data.user.email;

                // Create an accepted invitation for the old admin (so they stay as regular member)
                return supabase.from("project_invitations").insert({
                  project_id: currentActiveProjectId,
                  discipline_id: oldAdminDiscId,
                  email: oldAdminEmail,
                  status: "Accepted"
                }).then(function() {
                  // Update project ownership to new admin
                  return supabase.from("projects").update({
                    user_id: newAdminId,
                    project_config: { joining_as: newAdminDiscName }
                  }).eq("id", currentActiveProjectId);
                });
              });
            });
        });
    })
    .then(function(updateRes) {
      if (updateRes.error) throw updateRes.error;
      alert("Admin role transferred successfully.");
      loadProjectWorkspaceDashboard(currentActiveProjectId);
    })
    .catch(function(err) {
      alert("Transfer failed: " + err.message);
    });
});

if (dashEditProjectBtn) {
  dashEditProjectBtn.addEventListener("click", function() {
    if (!currentProjectData || !supabase) return;

    editCustomDisciplines = [];
    editProjectName.value = currentProjectData.name || "";
    editProjectLocation.value = currentProjectData.location || "";
    editProjectType.value = currentProjectData.project_type || "";
    editBasements.value = currentProjectData.basement_count || 0;
    editFloors.value = currentProjectData.floor_count || 0;
    editPodiums.value = currentProjectData.podium_count || 0;
    if (editHasCabinCheckbox) {
      editHasCabinCheckbox.checked = (currentProjectData.cabin_count || 0) > 0;
    }
    editFloorWarning.style.display = "none";

    // Load current disciplines
    supabase.from("project_disciplines").select("*").eq("project_id", currentActiveProjectId)
      .then(function(res) {
        if (res.error) throw res.error;
        currentEditDisciplines = {};
        for (var i = 0; i < (res.data || []).length; i++) {
          currentEditDisciplines[res.data[i].name] = res.data[i];
        }
        renderEditDisciplines();
        if (editProjectModalOverlay) editProjectModalOverlay.style.display = "flex";
      })
      .catch(function(err) {
        alert("Failed to load disciplines: " + err.message);
      });
  });
}

if (closeEditProjectBtn) {
  closeEditProjectBtn.addEventListener("click", function() {
    if (editProjectModalOverlay) editProjectModalOverlay.style.display = "none";
  });
}

// Show warning when reducing floors
function checkEditFloorReduction() {
  if (!currentProjectData) return;
  var newFloors = Number(editFloors.value) || 0;
  var newBasements = Number(editBasements.value) || 0;
  var newPodiums = Number(editPodiums.value) || 0;
  var newCabins = (editHasCabinCheckbox && editHasCabinCheckbox.checked) ? 1 : 0;
  var oldTotal = currentProjectData.basement_count + currentProjectData.podium_count + currentProjectData.floor_count + (currentProjectData.cabin_count || 0);
  var newTotal = newBasements + newPodiums + newFloors + newCabins;
  editFloorWarning.style.display = (newTotal < oldTotal) ? "block" : "none";
}

if (editFloors) editFloors.addEventListener("input", checkEditFloorReduction);
if (editBasements) editBasements.addEventListener("input", checkEditFloorReduction);
if (editPodiums) editPodiums.addEventListener("input", checkEditFloorReduction);
if (editHasCabinCheckbox) editHasCabinCheckbox.addEventListener("change", checkEditFloorReduction);

function getSelectedEditDisciplines() {
  var selected = [];
  var boxes = document.querySelectorAll("[data-edit-disc]:checked");
  for (var b = 0; b < boxes.length; b++) {
    selected.push(boxes[b].dataset.editDisc);
  }
  return selected;
}

if (btnSaveEditProject) {
  btnSaveEditProject.addEventListener("click", function() {
    if (!supabase || !currentActiveProjectId) return;

    var name = editProjectName.value.trim();
    var location = editProjectLocation.value.trim();
    var projectType = editProjectType.value;
    var basements = Number(editBasements.value) || 0;
    var floors = Number(editFloors.value) || 0;
    var podiums = Number(editPodiums.value) || 0;
    var editHasCabinEl = document.querySelector("#editHasCabin");
    var cabins = (editHasCabinEl && editHasCabinEl.checked) ? 1 : 0;

    if (!name || !location || !projectType) {
      alert("Project name, location, and type are required.");
      return;
    }

    var selectedDiscs = getSelectedEditDisciplines();
    var currentDiscNames = Object.keys(currentEditDisciplines);

    // Find disciplines to remove (block admin from removing own discipline)
    var adminDisc = null;
    var isAdmin = currentUserId && currentProjectData && String(currentProjectData.user_id) === currentUserId;
    if (isAdmin && currentProjectData.project_config && currentProjectData.project_config.joining_as) {
      adminDisc = currentProjectData.project_config.joining_as.toString();
    }
    var toRemove = [];
    var blockedAdminDisc = false;
    for (var r = 0; r < currentDiscNames.length; r++) {
      if (selectedDiscs.indexOf(currentDiscNames[r]) === -1) {
        if (adminDisc && currentDiscNames[r] === adminDisc) {
          blockedAdminDisc = true;
        } else {
          toRemove.push(currentDiscNames[r]);
        }
      }
    }

    if (blockedAdminDisc) {
      alert("You must transfer admin role to another member before removing your own discipline. Use the 'Transfer Admin' button in the Team tab.");
    }

    if (toRemove.length > 0) {
      var warn = confirm("Remove discipline " + toRemove.join(", ") + "? This will delete all drawings and folders in this discipline and remove invited members from the project.");
      if (!warn) return;
    }

    if (blockedAdminDisc && toRemove.length === 0) return;

    btnSaveEditProject.disabled = true;
    btnSaveEditProject.textContent = "Saving...";

    // Update project metadata
    supabase
      .from("projects")
      .update({
        name: name,
        location: location,
        project_type: projectType,
        basement_count: basements,
        floor_count: floors,
        podium_count: podiums,
        cabin_count: cabins,
        updated_at: new Date().toISOString()
      })
      .eq("id", currentActiveProjectId)
      .then(function(res) {
        if (res.error) throw res.error;

        // Add new disciplines
        var toAdd = [];
        for (var a = 0; a < selectedDiscs.length; a++) {
          if (!currentEditDisciplines[selectedDiscs[a]]) {
            toAdd.push({ project_id: currentActiveProjectId, name: selectedDiscs[a], sort_order: currentDiscNames.length + toAdd.length + 1 });
          }
        }

        var addPromise = Promise.resolve();
        if (toAdd.length > 0) {
          addPromise = supabase.from("project_disciplines").insert(toAdd).select();
        }
        return addPromise;
      })
      .then(function(addResult) {
        if (addResult && addResult.error) throw addResult.error;

        // Create folders for newly added disciplines
        var addedRecords = addResult ? (addResult.data || []) : [];
        var folderAddPromise = Promise.resolve();

        if (addedRecords.length > 0) {
          var folderPayload = [];
          for (var f = 0; f < addedRecords.length; f++) {
            var dr = addedRecords[f];
            var padded = String(dr.sort_order).padStart(2, "0");
            folderPayload.push({
              project_id: currentActiveProjectId,
              discipline_id: dr.id,
              folder_name: padded + "_" + dr.name,
              sort_order: dr.sort_order
            });
          }
          folderAddPromise = supabase.from("project_folders").insert(folderPayload);
        }
        return folderAddPromise;
      })
      .then(function(folderRes) {
        if (folderRes && folderRes.error) throw folderRes.error;

        // Remove unselected disciplines (exclude admin's discipline)
        var toRemoveNames = [];
        var adminDisc2 = null;
        var isAdmin2 = currentUserId && currentProjectData && String(currentProjectData.user_id) === currentUserId;
        if (isAdmin2 && currentProjectData.project_config && currentProjectData.project_config.joining_as) {
          adminDisc2 = currentProjectData.project_config.joining_as.toString();
        }
        var currentNames = Object.keys(currentEditDisciplines);
        var selected = getSelectedEditDisciplines();
        for (var r2 = 0; r2 < currentNames.length; r2++) {
          if (selected.indexOf(currentNames[r2]) === -1) {
            if (!(adminDisc2 && currentNames[r2] === adminDisc2)) {
              toRemoveNames.push(currentNames[r2]);
            }
          }
        }

        var removePromise = Promise.resolve();
        if (toRemoveNames.length > 0) {
          var removeIds = [];
          for (var r3 = 0; r3 < toRemoveNames.length; r3++) {
            if (currentEditDisciplines[toRemoveNames[r3]]) {
              removeIds.push(currentEditDisciplines[toRemoveNames[r3]].id);
            }
          }
          if (removeIds.length > 0) {
            removePromise = supabase.from("project_folders")
              .select("id")
              .in("discipline_id", removeIds)
              .then(function(folderRes) {
                if (folderRes.error) throw folderRes.error;

                var folderIds = [];
                if (folderRes.data && folderRes.data.length > 0) {
                  for (var fi = 0; fi < folderRes.data.length; fi++) {
                    folderIds.push(folderRes.data[fi].id);
                  }
                }

                // Cascade delete: drawings → invitations → folders → disciplines
                var delChain = Promise.resolve();

                if (folderIds.length > 0) {
                  delChain = delChain.then(function() {
                    return supabase.from("project_drawings").delete().in("folder_id", folderIds);
                  }).then(function(r) {
                    if (r && r.error) throw r.error;
                  });
                }

                delChain = delChain.then(function() {
                  return supabase.from("project_invitations").delete()
                    .eq("project_id", currentActiveProjectId)
                    .in("discipline_id", removeIds);
                }).then(function(r) {
                  if (r && r.error) throw r.error;
                });

                if (folderIds.length > 0) {
                  delChain = delChain.then(function() {
                    return supabase.from("project_folders").delete().in("id", folderIds);
                  }).then(function(r) {
                    if (r && r.error) throw r.error;
                  });
                }

                delChain = delChain.then(function() {
                  return supabase.from("project_disciplines").delete().in("id", removeIds);
                }).then(function(r) {
                  if (r && r.error) throw r.error;
                });

                return delChain;
              })
              .then(function() {
                // Renumber remaining disciplines sequentially after removal
                return supabase.from("project_disciplines").select("*").eq("project_id", currentActiveProjectId).order("sort_order", { ascending: true });
              })
              .then(function(remRes) {
                if (remRes.error) throw remRes.error;
                if (!remRes.data || remRes.data.length === 0) return;
                var renumberPromises = [];
                for (var ri = 0; ri < remRes.data.length; ri++) {
                  (function(disc, newOrder) {
                    var padded = String(newOrder).padStart(2, "0");
                    renumberPromises.push(
                      supabase.from("project_disciplines").update({ sort_order: newOrder }).eq("id", disc.id)
                        .then(function(discUpdRes) {
                          if (discUpdRes && discUpdRes.error) throw discUpdRes.error;
                          return supabase.from("project_folders").update({ sort_order: newOrder, folder_name: padded + "_" + disc.name }).eq("discipline_id", disc.id);
                        })
                        .then(function(folderUpdRes) {
                          if (folderUpdRes && folderUpdRes.error) throw folderUpdRes.error;
                        })
                    );
                  })(remRes.data[ri], ri + 1);
                }
                return Promise.all(renumberPromises);
              });
          }
        }
        return removePromise;
      })
      .then(function() {
        alert("Project updated successfully.");
        if (editProjectModalOverlay) editProjectModalOverlay.style.display = "none";
        loadProjectWorkspaceDashboard(currentActiveProjectId);
        fetchAndRenderHubProjects();
      })
      .catch(function(err) {
        alert("Failed to update project: " + err.message);
      })
      .then(function() {
        btnSaveEditProject.disabled = false;
        btnSaveEditProject.textContent = "Save Changes";
      });
  });
}

// =========================================================================
// 🗖 LEDGER POP-UP MODAL LOGIC
// =========================================================================
window.openUploadLedgerModal = function(folderId, levelName, disciplineRole, isSelfJoined) {
  if (!isSelfJoined) {
    alert("Security Boundary Block: You have read-only access to external discipline tracks.");
    return;
  }

  activeUploadContext.folderId = folderId;
  activeUploadContext.levelName = levelName;
  activeUploadContext.disciplineRole = disciplineRole;

  document.querySelector("#modalFolderContext").textContent = disciplineRole.toUpperCase() + " • " + levelName.toUpperCase();
  document.querySelector("#modalUploadForm").reset();
  setModalMode(false); 
  
  if (!supabase) return;

  var targetLevelKey = sanitizeLevelFolderKey(levelName);

  supabase
    .from("project_drawings")
    .select("*")
    .eq("folder_id", folderId)
    .eq("is_visible", true)
    .then(function(res) {
      if (res.error) throw res.error;
      var options = (res.data || []).filter(function(d) {
        return getLevelFolderFromDrawing(d) === targetLevelKey;
      });
      
      if (options.length === 0) {
        modalTargetDrawingSelect.innerHTML = '<option value="" disabled selected>No baseline sheets exist</option>';
        btnModeRevision.disabled = true;
        btnModeRevision.style.opacity = "0.4";
      } else {
        btnModeRevision.disabled = false;
        btnModeRevision.style.opacity = "1";
        var optHtml = "";
        for (var o = 0; o < options.length; o++) {
          optHtml += '<option value="' + options[o].id + '" data-name="' + options[o].drawing_name + '">' + options[o].drawing_name + ' (R' + options[o].revision_number + ')</option>';
        }
        modalTargetDrawingSelect.innerHTML = optHtml;
      }
      if (uploadModalOverlay) uploadModalOverlay.style.display = "flex";
    })
    .catch(function(err) {
       console.error(err);
    });
};

function setModalMode(toRevision) {
  isRevisionMode = toRevision;
  if (toRevision) {
    btnModeRevision.classList.add("active-mode");
    btnModeNew.classList.remove("active-mode");
    wrapperNewDrawingTitle.style.display = "none";
    wrapperRevisionSelector.style.display = "block";
  } else {
    btnModeNew.classList.add("active-mode");
    btnModeRevision.classList.remove("active-mode");
    wrapperNewDrawingTitle.style.display = "block";
    wrapperRevisionSelector.style.display = "none";
  }
}

if (btnModeNew) btnModeNew.addEventListener("click", function() { setModalMode(false); });
if (btnModeRevision) btnModeRevision.addEventListener("click", function() { setModalMode(true); });
if (closeModalBtn) closeModalBtn.addEventListener("click", function() { if (uploadModalOverlay) uploadModalOverlay.style.display = "none"; });

var strategyRadios = document.querySelectorAll('input[name="historyStrategy"]');
var overwriteWarningNote = document.querySelector("#overwriteWarningNote");
function updateOverwriteWarning() {
  if (!overwriteWarningNote) return;
  var selected = document.querySelector('input[name="historyStrategy"]:checked');
  overwriteWarningNote.style.display = (selected && selected.value === "overwrite") ? "block" : "none";
}
for (var sr = 0; sr < strategyRadios.length; sr++) {
  strategyRadios[sr].addEventListener("change", updateOverwriteWarning);
}
updateOverwriteWarning();

var uploadCommentInput = document.querySelector("#uploadCommentInput");
if (uploadCommentInput) {
  uploadCommentInput.addEventListener("input", function() {
    var counter = document.querySelector("#uploadCommentCounter");
    if (counter) counter.textContent = this.value.length + " / 100";
  });
}

if (commentsInput) {
  commentsInput.addEventListener("input", function() {
    var counter = document.querySelector("#commentsInputCounter");
    if (counter) counter.textContent = this.value.length + " / 100";
  });
}

// =========================================================================
// 📤 TRANSACTION ENGINE COMMIT LOOP
// =========================================================================
if (modalSubmitBtn) {
  modalSubmitBtn.addEventListener("click", function() {
    var fileInput = document.querySelector("#modalFileInput");
    var file = fileInput ? fileInput.files[0] : null;

    if (!file) {
      alert("Validation Gate: Please attach a valid PDF document payload.");
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Constraint Blockade: PDF format strictly required.");
      return;
    }

    modalSubmitBtn.disabled = true;
    modalSubmitBtn.textContent = "Committing Transaction...";

    var finalDrawingName = "";
    var targetParentId = null;
    var computedRevisionNumber = 0;
    var strategy = document.querySelector('input[name="historyStrategy"]:checked').value;

    var promiseChain = Promise.resolve();

    if (!isRevisionMode) {
      finalDrawingName = document.querySelector("#modalDrawingName").value.trim().toUpperCase().replace(/[\/\\]/g, "-").replace(/\s+/g, "-");
      if (!finalDrawingName) {
        alert("Validation Gate: Asset Track Title cannot remain blank.");
        modalSubmitBtn.disabled = false;
        modalSubmitBtn.textContent = "Execute Transaction Commit";
        return;
      }
      computedRevisionNumber = 0; 
    } else {
      var selectedOpt = modalTargetDrawingSelect.options[modalTargetDrawingSelect.selectedIndex];
      if (!selectedOpt || !selectedOpt.value) {
        alert("Operational Error: Missing reference track index.");
        modalSubmitBtn.disabled = false;
        modalSubmitBtn.textContent = "Execute Transaction Commit";
        return;
      }
      targetParentId = selectedOpt.value;
      finalDrawingName = selectedOpt.dataset.name;

      promiseChain = supabase
        .from("project_drawings")
        .select("revision_number")
        .or("id.eq." + targetParentId + ",parent_track_id.eq." + targetParentId)
        .then(function(countRes) {
          if (countRes.error) throw countRes.error;
          var records = countRes.data;
          var maxRev = 0;
          for (var r = 0; r < records.length; r++) {
            if (records[r].revision_number > maxRev) { maxRev = records[r].revision_number; }
          }
          computedRevisionNumber = maxRev + 1; 
        });
    }

    promiseChain
      .then(function() {
        var sanitizedLevelFolder = sanitizeLevelFolderKey(activeUploadContext.levelName);
        var fileSuffixLabel = "_R" + computedRevisionNumber;
        var storagePath = currentActiveProjectId + "/" + sanitizedLevelFolder + "/" + Date.now() + "_" + finalDrawingName + fileSuffixLabel + ".pdf";

        return supabase.storage.from("project-files").upload(storagePath, file).then(function(uploadRes) {
          if (uploadRes.error) throw uploadRes.error;
          return storagePath;
        });
      })
      .then(function(storagePath) {
        if (isRevisionMode && strategy === "overwrite") {
          return supabase
            .from("project_drawings")
            .select("id, file_path")
            .or("id.eq." + targetParentId + ",parent_track_id.eq." + targetParentId)
            .then(function(oldRes) {
              if (oldRes.error) throw oldRes.error;
              var oldDrawings = oldRes.data || [];
              var paths = [];
              var ids = [];
              for (var s = 0; s < oldDrawings.length; s++) {
                if (oldDrawings[s].file_path) paths.push(oldDrawings[s].file_path);
                ids.push(oldDrawings[s].id);
              }
              var delChain = Promise.resolve();
              if (paths.length > 0) {
                delChain = supabase.storage.from("project-files").remove(paths);
              }
              return delChain.then(function() {
                if (ids.length > 0) {
                  return supabase.from("project_drawings").update({ is_visible: false, file_path: "" }).in("id", ids);
                }
              });
            })
            .then(function() { return storagePath; });
        }
        return storagePath;
      })
      .then(function(storagePath) {
        var insertPayload = {
          project_id: currentActiveProjectId,
          folder_id: activeUploadContext.folderId,
          parent_track_id: isRevisionMode ? targetParentId : null,
          drawing_name: finalDrawingName,
          revision_number: computedRevisionNumber,
          file_path: storagePath,
          is_visible: true,
          uploaded_by: activeUploadContext.disciplineRole
        };
        return supabase.from("project_drawings").insert([insertPayload]).select();
      })
      .then(function(finalInsertRes) {
        if (finalInsertRes.error) throw finalInsertRes.error;
        var insertedDrawing = finalInsertRes.data ? finalInsertRes.data[0] : null;
        var uploadCommentEl = document.querySelector("#uploadCommentInput");
        var commentBody = uploadCommentEl ? uploadCommentEl.value.trim() : "";
        if (insertedDrawing && commentBody) {
          supabase.from("drawing_comments").insert([{
            drawing_id: insertedDrawing.id,
            project_id: currentActiveProjectId,
            user_id: currentUserId,
            body: commentBody,
            drawing_name: finalDrawingName,
            discipline_name: activeUploadContext.disciplineRole.replace(/^\d+_\s*/, "")
          }]).then(function() {});
        }
        alert("🎉 Commit Verification Secured! PDF Drawing registered to ledger.");
        if (uploadModalOverlay) uploadModalOverlay.style.display = "none";
        renderAllFolderDrawingFeeds(currentActiveProjectId); 
        fetchAndRenderHubProjects(); 
        notifyProjectMembers(currentActiveProjectId, {
          type: computedRevisionNumber > 0 ? "drawing_revision" : "drawing_uploaded",
          title: (computedRevisionNumber > 0 ? "Drawing revised to R" + computedRevisionNumber : "New drawing uploaded") + " — " + finalDrawingName,
          body: (activeUploadContext.disciplineRole.replace(/^\d+_\s*/, "")) + " committed " + finalDrawingName + " in " + activeUploadContext.levelName + "."
        }, currentUserId);
      })
      .catch(function(err) {
        console.error(err);
        alert("Transaction Aborted: " + (err.message || err));
      })
      .then(function() {
        modalSubmitBtn.disabled = false;
        modalSubmitBtn.textContent = "Execute Transaction Commit";
      });
  });
}

// =========================================================================
// 🚀 DEPLOY SYSTEM BUILD OPERATIONS (SECURED WITH ACTIVE USER ID STAMP)
// =========================================================================
if (createButton) {
  createButton.addEventListener("click", function() {
    if (!supabase) return;

    var projectName = document.querySelector("#projectName").value.trim();
    var location = document.querySelector("#location").value.trim();
    var projectType = document.querySelector("#projectType").value;
    var joiningAs = document.querySelector("#yourDiscipline").value;
    var basements = Number(document.querySelector("#basements").value || 0);
    var floors = Number(document.querySelector("#floors").value || 0);
    var podiums = Number(document.querySelector("#podiums").value || 0);
    var hasCabinEl = document.querySelector("#hasCabin");
    var cabins = (hasCabinEl && hasCabinEl.checked) ? 1 : 0;
    var selectedList = selectedDisciplines();

    if (!projectName || !location || !projectType) {
      alert("Validation Error: All fields mandatory.");
      return;
    }

    var selfDisciplineFound = false;
    for (var d = 0; d < selectedList.length; d++) {
      if (selectedList[d].toLowerCase() === joiningAs.toLowerCase()) {
        selfDisciplineFound = true;
        break;
      }
    }

    if (!selfDisciplineFound) {
      alert("Validation Error: You must check the '" + joiningAs + "' box.");
      return;
    }

    if (selectedList.length < 3) {
      alert("Validation Error: Select a minimum of 3 disciplines.");
      return;
    }

    createButton.disabled = true;
    createButton.textContent = "Deploying Infrastructure Stack...";

    supabase.auth.getUser()
      .then(function(userRes) {
        if (userRes.error || !userRes.data.user) {
          throw new Error("Session expired. Please log in again.");
        }
        var user = userRes.data.user;

        return supabase.from("projects").insert([{
          name: projectName,
          location: location,
          project_type: projectType,
          basement_count: basements,
          podium_count: podiums,
          floor_count: floors,
          cabin_count: cabins,
          has_ground_floor: true,
          status: "Active",
          user_id: user.id, 
          project_config: { joining_as: joiningAs }
        }]).select();
      })
      .then(function(result) {
        if (result.error) throw result.error;
        currentActiveProjectId = result.data[0].id;
        
        var disciplinePayload = [];
        for (var i = 0; i < selectedList.length; i++) {
          disciplinePayload.push({ project_id: currentActiveProjectId, name: selectedList[i], sort_order: i + 1 });
        }
        return supabase.from("project_disciplines").insert(disciplinePayload).select();
      })
      .then(function(discResult) {
        if (discResult.error) throw discResult.error;
        var createdDisciplines = discResult.data;
        var folderPayload = [];
        
        for (var j = 0; j < createdDisciplines.length; j++) {
          var discRow = createdDisciplines[j];
          var paddedOrder = String(discRow.sort_order).padStart(2, "0");
          folderPayload.push({
            project_id: currentActiveProjectId,
            discipline_id: discRow.id,
            folder_name: paddedOrder + "_" + discRow.name,
            sort_order: discRow.sort_order
          });
        }
        return supabase.from("project_folders").insert(folderPayload).select();
      })
      .then(function(folderResult) {
        if (folderResult.error) throw folderResult.error;
        
        setTimeout(function() {
          var formEl = document.querySelector("#projectForm");
          if (formEl) formEl.reset();
          renderAll();
          fetchAndRenderHubProjects();
          loadProjectWorkspaceDashboard(currentActiveProjectId); 
          createButton.disabled = false;
          createButton.textContent = "Create New Project";
        }, 400);
      })
      .catch(function(err) {
        console.error(err);
        alert("Deployment Failed: " + err.message);
        createButton.disabled = false;
        createButton.textContent = "Create New Project";
      });
  });
}

// =========================================================================
// ✉️ DISPATCH INVITATION LINK PIPELINE WITH AUTO-RESET STATE
// =========================================================================
document.body.addEventListener("click", function(event) {
  var editInviteIcon = event.target.closest(".dash-card-edit-invite");
  if (editInviteIcon) {
    var disciplineId = editInviteIcon.dataset.discId;
    supabase.from("project_invitations").delete()
      .eq("project_id", currentActiveProjectId)
      .eq("discipline_id", disciplineId)
      .eq("status", "Pending")
      .then(function() {
        loadProjectWorkspaceDashboard(currentActiveProjectId);
      });
    return;
  }

  var inviteBtn = event.target.closest(".dash-card-invite-btn");
  var resendBtn = event.target.closest(".dash-card-resend-btn");
  if (!inviteBtn && !resendBtn) return;

  var button = inviteBtn || resendBtn;
  var isResend = !!resendBtn;
  var disciplineId = button.dataset.discId;
  var disciplineName = button.dataset.discName;
  var emailValue = isResend ? button.dataset.discEmail : (document.querySelector("#dash_invite_" + disciplineId) ? document.querySelector("#dash_invite_" + disciplineId).value.trim().toLowerCase() : "");

  if (!emailValue) {
    alert("Please input a valid email address.");
    return;
  }

  button.disabled = true;
  button.textContent = "...";

  function sendInviteEmail() {
    var generatedJoinLink = APP_BASE_URL + "/dashboard.html?accept_invite=" + currentActiveProjectId;
    var projectName = currentProjectData ? currentProjectData.name : "the project";
    var cleanDiscName = String(disciplineName).replace(/^\d+_\s*/, "");
    var edgeFunctionUrl = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/send-invite";

    fetch(edgeFunctionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_ANON_KEY },
      body: JSON.stringify({ to: emailValue, projectName: projectName, disciplineName: cleanDiscName, inviteLink: generatedJoinLink })
    })
    .then(function(fetchRes) { return fetchRes.json(); })
    .then(function(result) {
      if (result.error) throw new Error(result.error);
      alert("✉️ Invitation sent to " + emailValue);
    })
    .catch(function() {
      alert("✉️ Invitation recorded! Email service unavailable. Share this link manually:\n" + generatedJoinLink);
    });

    button.textContent = "Sent";
    button.style.background = "#66736f";

    var emailInput = document.querySelector("#dash_invite_" + disciplineId);
    if (emailInput && !isResend) {
      emailInput.disabled = true;
      emailInput.style.background = "#e8eef5";
    }

    setTimeout(function() {
      if (button && button.textContent === "Sent") {
        button.disabled = false;
        button.textContent = isResend ? "Resend" : "Invite";
        button.style.background = "var(--blue)";
        if (emailInput && !isResend) {
          emailInput.disabled = false;
          emailInput.style.background = "#ffffff";
          emailInput.value = "";
        }
      }
    }, 120000);
  }

  if (isResend) {
    sendInviteEmail();
  } else {
    supabase
      .from("project_invitations")
      .insert([{
        project_id: currentActiveProjectId,
        discipline_id: disciplineId,
        email: emailValue,
        status: "Pending"
      }])
      .then(function(res) {
        if (res.error) throw res.error;
        sendInviteEmail();
      })
      .catch(function(err) {
        console.error(err);
        button.disabled = false;
        button.textContent = "Invite";
      });
  }
});

// =========================================================================
// 🔔 IN-APP NOTIFICATIONS
// =========================================================================
var notifBtn = document.querySelector("#btnNotifications");
var notifPanel = document.querySelector("#notifPanel");
var notifList = document.querySelector("#notifList");
var notifBadge = document.querySelector("#notifBadge");
var notifMarkAllRead = document.querySelector("#notifMarkAllRead");
var notifMuteToggle = document.querySelector("#notifMuteToggle");
var notifClose = document.querySelector("#notifClose");
var notificationsCache = [];
var notifChannel = null;
var notifPanelOpen = false;
var currentNotifProjectId = null;
var currentNotifMuted = false;

function countUnreadNotifications() {
  var c = 0;
  for (var i = 0; i < notificationsCache.length; i++) {
    if (!notificationsCache[i].is_read) c++;
  }
  return c;
}

function renderNotifBadge() {
  var c = currentNotifMuted ? 0 : countUnreadNotifications();
  if (notifBadge) {
    notifBadge.textContent = c;
    notifBadge.style.display = (c > 0 && notifBtn && notifBtn.style.display !== "none") ? "inline-flex" : "none";
  }
}

function renderNotifMuteState() {
  if (notifBtn) {
    notifBtn.classList.toggle("muted", currentNotifMuted);
    notifBtn.innerHTML = currentNotifMuted
      ? "🔕 <span id=\"notifBadge\" class=\"notif-badge\" style=\"display:none;\">0</span>"
      : "🔔 <span id=\"notifBadge\" class=\"notif-badge\" style=\"display:none;\">0</span>";
    notifBadge = document.querySelector("#notifBadge");
    renderNotifBadge();
  }
  if (notifMuteToggle) {
    notifMuteToggle.textContent = currentNotifMuted ? "🔔 Unmute project" : "🔕 Mute project";
  }
}

function renderNotificationList() {
  if (!notifList) return;
  if (!notificationsCache.length) {
    notifList.innerHTML = '<div class="notif-empty">No notifications for this project yet.</div>';
    return;
  }
  var html = "";
  for (var i = 0; i < notificationsCache.length; i++) {
    var n = notificationsCache[i];
    var d = new Date(n.created_at);
    var timeStr = isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    html += '<div class="notif-item' + (n.is_read ? "" : " unread") + '" data-id="' + n.id + '">'
      + '<div class="notif-item-title">' + (n.is_read ? "" : '<span class="notif-dot"></span>') + escapeHtml(n.title) + '</div>'
      + '<div class="notif-item-body">' + escapeHtml(n.body) + '</div>'
      + '<div class="notif-item-time">' + escapeHtml(timeStr) + '</div>'
      + '</div>';
  }
  notifList.innerHTML = html;
}

function loadNotifications() {
  if (!supabase || !currentUserId || !currentNotifProjectId) return;
  supabase.from("notifications")
    .select("*")
    .eq("user_id", currentUserId)
    .eq("project_id", currentNotifProjectId)
    .order("created_at", { ascending: false })
    .limit(50)
    .then(function(res) {
      if (res.error) throw res.error;
      notificationsCache = res.data || [];
      renderNotifBadge();
      if (notifPanelOpen) renderNotificationList();
    })
    .catch(function(err) { console.error("Failed to load notifications:", err); });
}

function loadNotifMuteState() {
  if (!supabase || !currentUserId || !currentNotifProjectId) return;
  supabase.from("project_notification_settings")
    .select("muted")
    .eq("user_id", currentUserId)
    .eq("project_id", currentNotifProjectId)
    .maybeSingle()
    .then(function(res) {
      currentNotifMuted = !!(res.data && res.data.muted);
      renderNotifMuteState();
    })
    .catch(function(err) { console.error("Failed to load mute state:", err); });
}

function setupProjectNotifications(projectId) {
  currentNotifProjectId = projectId;
  if (notifBtn) notifBtn.style.display = "inline-flex";
  if (notifPanelOpen) toggleNotifPanel();
  loadNotifMuteState();
  loadNotifications();
}

function teardownProjectNotifications() {
  currentNotifProjectId = null;
  currentNotifMuted = false;
  notificationsCache = [];
  if (notifBtn) notifBtn.style.display = "none";
  if (notifPanelOpen) toggleNotifPanel();
  renderNotifBadge();
}

function toggleNotifMute() {
  if (!supabase || !currentUserId || !currentNotifProjectId) return;
  var newMuted = !currentNotifMuted;
  supabase.from("project_notification_settings")
    .upsert({
      user_id: currentUserId,
      project_id: currentNotifProjectId,
      muted: newMuted
    }, { onConflict: "user_id,project_id" })
    .then(function(res) {
      if (res.error) throw res.error;
      currentNotifMuted = newMuted;
      renderNotifMuteState();
      renderNotifBadge();
      if (notifPanelOpen) renderNotificationList();
    })
    .catch(function(err) {
      console.error("Failed to update mute state:", err);
      alert("Could not update mute setting: " + (err.message || err));
    });
}

function subscribeToNotifications() {
  if (!supabase || !currentUserId || notifChannel) return;
  notifChannel = supabase.channel("stradconnect-notifications")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: "user_id=eq." + currentUserId
    }, function(payload) {
      var row = payload.new;
      if (currentNotifProjectId && row.project_id === currentNotifProjectId) {
        if (currentNotifMuted) return;
        var dup = false;
        for (var i = 0; i < notificationsCache.length; i++) {
          if (notificationsCache[i].id === row.id) { dup = true; break; }
        }
        if (!dup) notificationsCache.unshift(row);
        renderNotifBadge();
        if (notifPanelOpen) renderNotificationList();
      }
      fireBrowserNotification(row);
      showNotificationToast(row);
      updateHubBadgeOnNotify(row);
    })
    .subscribe();
}

function updateHubBadgeOnNotify(row) {
  if (!row.project_id) return;
  var card = document.querySelector('.project-summary-card[data-project-id="' + row.project_id + '"]');
  if (!card) return;
  var chip = card.querySelector(".hub-notif-chip");
  var count = chip ? (parseInt(chip.textContent, 10) || 0) + 1 : 1;
  if (chip) {
    chip.textContent = count > 1 ? count + " new notifications" : "1 new notification";
  } else {
    card.insertAdjacentHTML("afterbegin", '<span class="hub-notif-chip">1 new notification</span>');
  }
}

function showNotificationToast(row) {
  var container = document.querySelector("#notifToastContainer");
  if (!container) return;
  var toast = document.createElement("div");
  toast.className = "notif-toast";
  toast.innerHTML = '<div class="notif-toast-title">' + escapeHtml(row.title || "STRAD CONNECT") + '</div>'
    + '<div class="notif-toast-body">' + escapeHtml(row.body || "") + '</div>';
  toast.addEventListener("click", function() {
    try {
      if (row.project_id) {
        showView("dashboard", row.project_id);
        loadProjectWorkspaceDashboard(row.project_id);
      }
    } catch (e) {}
    toast.remove();
  });
  container.appendChild(toast);
  setTimeout(function() {
    if (toast.parentNode) toast.remove();
  }, 7000);
}

function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then(function(perm) {
      console.log("Notification permission:", perm);
    }).catch(function(err) {
      console.error("Notification permission request failed:", err);
    });
  }
}

function setupPushNotifications() {
  if (!currentUserId) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
  navigator.serviceWorker.register("sw.js")
    .then(function (reg) {
      return Notification.requestPermission().then(function (perm) {
        if (perm !== "granted") return null;
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      });
    })
    .then(function (sub) {
      if (!sub || !supabase) return;
      var data = sub.toJSON();
      if (!data || !data.endpoint || !data.keys) return;
      return supabase.from("push_subscriptions")
        .upsert({
          user_id: currentUserId,
          endpoint: data.endpoint,
          auth: data.keys.auth,
          p256dh: data.keys.p256dh
        }, { onConflict: "endpoint" });
    })
    .then(function (res) {
      if (res && res.error) console.error("Push subscription save failed:", res.error);
    })
    .catch(function (err) {
      console.error("Push setup failed:", err);
    });
}

function triggerRemotePush(recipientIds, notif) {
  if (!supabase || !recipientIds || !recipientIds.length) return;
  supabase.auth.getSession().then(function (s) {
    var token = s && s.data.session ? s.data.session.access_token : "";
    if (!token) return;
    var url = notif.project_id
      ? (APP_BASE_URL + "/dashboard.html?project=" + encodeURIComponent(notif.project_id))
      : (APP_BASE_URL + "/dashboard.html");
    fetch(SUPABASE_URL + "/functions/v1/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        user_ids: recipientIds,
        title: notif.title || "STRAD CONNECT",
        body: notif.body || "",
        url: url
      })
    }).catch(function (err) {
      console.error("send-push call failed:", err);
    });
  }).catch(function () {});
}

function fireBrowserNotification(row) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    var notif = new Notification(row.title || "STRAD CONNECT", {
      body: row.body || "",
      tag: "stradconnect-" + row.id
    });
    notif.onclick = function() {
      window.focus();
      notif.close();
      try {
        if (row.project_id) {
          showView("dashboard", row.project_id);
          loadProjectWorkspaceDashboard(row.project_id);
        }
      } catch (e) {}
    };
  } catch (e) {
    console.error("Browser notification failed:", e);
  }
}

function toggleNotifPanel() {
  notifPanelOpen = !notifPanelOpen;
  if (notifPanel) notifPanel.style.display = notifPanelOpen ? "flex" : "none";
  if (notifPanelOpen) renderNotificationList();
}

function markNotificationRead(id, el) {
  for (var i = 0; i < notificationsCache.length; i++) {
    if (notificationsCache[i].id === id) { notificationsCache[i].is_read = true; break; }
  }
  renderNotifBadge();
  if (el) el.classList.remove("unread");
  supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", currentUserId)
    .then(function(res) { if (res.error) console.error(res.error); });
}

function markAllNotificationsRead() {
  var ids = [];
  for (var i = 0; i < notificationsCache.length; i++) {
    if (!notificationsCache[i].is_read) ids.push(notificationsCache[i].id);
  }
  if (!ids.length) return;
  supabase.from("notifications").update({ is_read: true }).in("id", ids).eq("user_id", currentUserId)
    .then(function(res) {
      if (res.error) return console.error(res.error);
      for (var j = 0; j < notificationsCache.length; j++) notificationsCache[j].is_read = true;
      renderNotifBadge();
      renderNotificationList();
    });
}

if (notifBtn) {
  notifBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    toggleNotifPanel();
  });
}

if (notifMuteToggle) {
  notifMuteToggle.addEventListener("click", function(e) {
    e.stopPropagation();
    toggleNotifMute();
  });
}

if (notifMarkAllRead) {
  notifMarkAllRead.addEventListener("click", function(e) {
    e.stopPropagation();
    markAllNotificationsRead();
  });
}

if (notifClose) {
  notifClose.addEventListener("click", function(e) {
    e.stopPropagation();
    notifPanelOpen = false;
    if (notifPanel) notifPanel.style.display = "none";
  });
}

if (notifList) {
  notifList.addEventListener("click", function(e) {
    var item = e.target.closest ? e.target.closest(".notif-item") : null;
    if (item) markNotificationRead(item.getAttribute("data-id"), item);
  });
}

document.addEventListener("click", function(e) {
  if (notifPanelOpen && notifPanel && !notifPanel.contains(e.target) && notifBtn && !notifBtn.contains(e.target)) {
    notifPanelOpen = false;
    notifPanel.style.display = "none";
  }
});

function getProjectRecipientUserIds(projectId, excludeUserId) {
  return Promise.all([
    supabase.from("projects").select("user_id").eq("id", projectId).single(),
    supabase.from("project_invitations").select("email").eq("project_id", projectId).eq("status", "Accepted"),
    supabase.from("profiles").select("id, email")
  ]).then(function(arr) {
    var adminId = arr[0].data ? String(arr[0].data.user_id) : "";
    var inviteEmails = {};
    for (var i = 0; i < (arr[1].data || []).length; i++) {
      inviteEmails[String(arr[1].data[i].email).toLowerCase().trim()] = true;
    }
    var emailToId = {};
    for (var p = 0; p < (arr[2].data || []).length; p++) {
      emailToId[String(arr[2].data[p].email).toLowerCase().trim()] = String(arr[2].data[p].id);
    }
    var ids = [];
    var seen = {};
    var ex = excludeUserId ? String(excludeUserId) : "";
    var add = function(id) {
      if (!id || seen[id] || (ex && id === ex)) return;
      seen[id] = true;
      ids.push(id);
    };
    add(adminId);
    for (var e in inviteEmails) {
      if (emailToId[e]) add(emailToId[e]);
    }
    return ids;
  });
}

function filterMutedRecipients(projectId, ids) {
  if (!ids || !ids.length) return Promise.resolve([]);
  return supabase.from("project_notification_settings")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("muted", true)
    .then(function(res) {
      var muted = {};
      for (var i = 0; i < (res.data || []).length; i++) muted[String(res.data[i].user_id)] = true;
      var out = [];
      for (var j = 0; j < ids.length; j++) {
        if (!muted[ids[j]]) out.push(ids[j]);
      }
      return out;
    })
    .catch(function() { return ids; });
}

function createNotifications(recipientIds, notif) {
  if (!supabase || !recipientIds || !recipientIds.length) return Promise.resolve();
  var rows = [];
  for (var i = 0; i < recipientIds.length; i++) {
    rows.push({
      user_id: recipientIds[i],
      project_id: notif.project_id || null,
      type: notif.type || "general",
      title: notif.title || "",
      body: notif.body || ""
    });
  }
  return supabase.from("notifications").insert(rows).then(function(res) {
    if (res.error) console.error("Failed to create notifications:", res.error);
    triggerRemotePush(recipientIds, notif);
  });
}

function notifyProjectMembers(projectId, notif, excludeUserId) {
  if (!supabase) return Promise.resolve();
  notif.project_id = projectId;
  return getProjectRecipientUserIds(projectId, excludeUserId).then(function(ids) {
    return filterMutedRecipients(projectId, ids);
  }).then(function(ids) {
    return createNotifications(ids, notif);
  }).catch(function(err) { console.error("Notification skipped:", err); });
}

function notifyProjectAdmin(projectId, notif) {
  if (!supabase) return Promise.resolve();
  notif.project_id = projectId;
  return supabase.from("projects").select("user_id").eq("id", projectId).single().then(function(res) {
    if (res.error || !res.data) return;
    return filterMutedRecipients(projectId, [String(res.data.user_id)]).then(function(ids) {
      return createNotifications(ids, notif);
    });
  }).catch(function(err) { console.error("Notification skipped:", err); });
}

// =========================================================================
// 🔗 AUTOMATED INBOUND ACCEPTER INTERCEPTOR
// =========================================================================
function handleInboundUrlInvitations() {
  if (!supabase) return;
  
  var urlParams = new URLSearchParams(window.location.search);
  var inviteProjectId = urlParams.get("accept_invite");
  
  if (!inviteProjectId) return;

  window.history.replaceState({}, document.title, window.location.pathname);

  supabase.auth.getUser()
    .then(function(userRes) {
      if (userRes.error || !userRes.data.user) {
        window.location.href = "auth.html?mode=login";
        return null;
      }
      return userRes.data.user;
    })
    .then(function(user) {
      if (!user) return;
      var cleanSessionEmail = user.email.toLowerCase().trim();

      return supabase
        .from("project_invitations")
        .update({ status: "Accepted" })
        .eq("project_id", inviteProjectId)
        .eq("email", cleanSessionEmail)
        .eq("status", "Pending")
        .select()
        .then(function(updateRes) {
          if (updateRes.error) throw updateRes.error;
          
          if (updateRes.data && updateRes.data.length > 0) {
            alert("🎉 Access Granted! You have successfully linked onto this project workspace grid.");
            notifyProjectAdmin(inviteProjectId, {
              type: "member_joined",
              title: "New member joined the project",
              body: cleanSessionEmail + " accepted the invitation and joined the workspace."
            });
          } else {
            return supabase.from("project_invitations").select("id").eq("project_id", inviteProjectId).eq("email", cleanSessionEmail).eq("status", "Accepted")
              .then(function(checkRes) {
                if (checkRes.data && checkRes.data.length > 0) {
                  alert("ℹ️ Network Connection Active: You are already a synchronized peer in this grid space.");
                } else {
                  alert("🛑 Access Denied: This active account email does not match the invited credentials for this project workspace.");
                }
              });
          }
          fetchAndRenderHubProjects();
        });
    })
    .catch(function(err) {
      console.error("Link Processing Failure:", err);
    });
}

setTimeout(handleInboundUrlInvitations, 500);

// =========================================================================
// 🧭 ROUTING SIDEBAR BINDERS
// =========================================================================
if (navYourProjects) {
  navYourProjects.addEventListener("click", function() {
    fetchAndRenderHubProjects();
    showView("hub");
  });
}

if (navCreateProject) {
  navCreateProject.addEventListener("click", function() {
    showView("create");
  });
}

if (hubCreateProjectBtn) {
  hubCreateProjectBtn.addEventListener("click", function() {
    showView("create");
  });
}
