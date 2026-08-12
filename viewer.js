(function () {
  var SUPABASE_URL = "https://addkzbtpzuujghpidplu.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_GS-TjYrkZ88-aL01RpaUAg_m5z-RlJI";
  var supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  var params = new URLSearchParams(window.location.search);
  var drawingId = params.get("d") || params.get("drawing_id") || "";

  var msgBox = document.getElementById("msgBox");
  var pdfFrame = document.getElementById("pdfFrame");
  var viewerWrap = document.getElementById("viewerWrap");
  var pdfRender = document.getElementById("pdfRender");
  var docMeta = document.getElementById("docMeta");
  var dlBtn = document.getElementById("dlBtn");
  var pageNoEl = document.getElementById("pageNo");
  var zoomLabelEl = document.getElementById("zoomLabel");
  var searchInput = document.getElementById("searchInput");
  var searchStatus = document.getElementById("searchStatus");

  function showMsg(icon, title, body) {
    msgBox.style.display = "flex";
    msgBox.innerHTML = '<div class="ic">' + icon + '</div>' +
      '<h2>' + title + '</h2>' +
      '<p>' + body + '</p>';
  }

  function die(icon, title, body) {
    docMeta.textContent = "";
    showMsg(icon, title, body);
  }

  if (!supabase || !drawingId) {
    die("\u26a0\uFE0F", "Invalid link", "This drawing viewer link is missing a drawing reference.");
    return;
  }

  supabase.auth.getUser().then(function (userRes) {
    if (userRes.error || !userRes.data.user) {
      window.location.href = "auth.html?mode=login";
      return;
    }
    return supabase
      .from("project_drawings")
      .select("file_path, drawing_name, project_id, revision_number")
      .eq("id", drawingId)
      .maybeSingle();
  }).then(function (rowRes) {
    if (!rowRes) return;
    if (rowRes.error) throw rowRes.error;
    var row = rowRes.data;
    if (!row || !row.file_path) {
      die("\u26D4", "Access denied", "You are not a member of this project, or this drawing record is no longer accessible.");
      return;
    }
    docMeta.textContent = row.drawing_name + " Â· R" + (row.revision_number == null ? "" : row.revision_number) + " Â· " + (row.file_path ? row.file_path.split("/").pop() : "");
    return supabase.storage.from("project-files").download(row.file_path).then(function (dlRes) {
      if (!dlRes) return null;
      if (dlRes.error) throw dlRes.error;
      return dlRes.data;
    });
  }).then(function (blob) {
    if (!blob) return;
    var url = URL.createObjectURL(blob);
    dlBtn.href = url;
    dlBtn.style.display = "inline-block";
    try { dlBtn.setAttribute("download", ""); } catch (e) {}

    if (window.pdfjsLib) {
      initViewer(blob);
    } else {
      pdfFrame.src = url;
      pdfFrame.style.display = "block";
    }
  }).catch(function (err) {
    console.error("Secure viewer failed:", err);
    var denied = err && /access|permission|not exist/i.test(String(err.message || err));
    die(denied ? "\u26D4" : "\uD83D\uDD12", denied ? "Access denied" : "Cannot open drawing",
        denied
          ? "Your account is not a member of this project, so the file cannot be opened. If this is a mistake, ask the project admin to re-invite you."
          : "The file could not be loaded. It may have been removed from the project. Details: " + String((err && err.message) || err) + " (HTTP " + String((err && err.status) || (err && err.statusCode) || "?") + ")");
  });

  // =========================================================================
  // Full-featured PDF viewer state
  // =========================================================================
  var pdfDoc = null;
  var pageData = [];            // 1-indexed: {page, w1, h1}
  var dpr = window.devicePixelRatio || 1;
  var currentPage = 1;
  var fitMode = "width";        // width | page | none
  var drag = { active: false, x: 0, y: 0, sl: 0, st: 0 };
  var searchMatches = [];
  var searchIdx = -1;

  function initViewer(blob) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    blob.arrayBuffer()
      .then(function (buf) { return pdfjsLib.getDocument({ data: buf }).promise; })
      .then(function (pdf) {
        pdfDoc = pdf;
        pageData = [null];
        var chain = Promise.resolve();
        for (var i = 1; i <= pdf.numPages; i++) {
          (function (n) {
            chain = chain.then(function () {
              return pdf.getPage(n).then(function (pg) {
                var vp = pg.getViewport({ scale: 1 });
                pageData[n] = { page: pg, w1: vp.width, h1: vp.height };
              });
            });
          })(i);
        }
        return chain;
      })
      .then(function () {
        viewerWrap.style.display = "block";
        pageNoEl.textContent = "1 / " + pdfDoc.numPages;
        currentPage = 1;
        fitMode = "width";
        applyFit(true);
        renderAll();
        bindControls();
      })
      .catch(function (err) {
        die("\uD83D\uDD12", "Cannot open drawing",
            "The PDF could not be loaded. Details: " + String((err && err.message) || err));
      });
  }

  function pageCanvasWidth() {
    return pdfRender.clientWidth || window.innerWidth || 800;
  }

  function pageCanvasHeight() {
    return pdfRender.clientHeight || window.innerHeight || 600;
  }

  function computeFitScale() {
    var base = pageData[1];
    if (!base) return 1;
    if (fitMode === "width") {
      return Math.max(0.1, pageCanvasWidth() / base.w1);
    }
    if (fitMode === "page") {
      var s1 = pageCanvasWidth() / base.w1;
      var s2 = pageCanvasHeight() / base.h1;
      return Math.max(0.1, Math.min(s1, s2));
    }
    return null;
  }

  function applyFit(resetScroll) {
    var s = computeFitScale();
    if (s != null) {
      zoomLabelEl.textContent = Math.round(s * 100) + "%";
    }
    if (resetScroll) { pdfRender.scrollTop = 0; pdfRender.scrollLeft = 0; }
  }

  function renderAll() {
    pdfRender.innerHTML = "";
    searchMatches = [];
    searchIdx = -1;
    searchStatus.textContent = "";
    for (var i = 1; i <= pdfDoc.numPages; i++) {
      renderPage(i);
    }
  }

  function renderPage(n) {
    var pd = pageData[n];
    var scale;
    if (fitMode === "none") {
      scale = parseFloat(zoomLabelEl.textContent) / 100;
    } else {
      scale = computeFitScale();
    }
    if (!scale || scale <= 0) scale = 1;

    var viewport = pd.page.getViewport({ scale: scale });

    var pageEl = document.createElement("div");
    pageEl.className = "page";
    pageEl.style.width = viewport.width + "px";
    pageEl.style.height = viewport.height + "px";

    var canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    pageEl.appendChild(canvas);

    var textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    textLayer.style.width = viewport.width + "px";
    textLayer.style.height = viewport.height + "px";
    pageEl.appendChild(textLayer);

    pdfRender.appendChild(pageEl);

    var ctx = canvas.getContext("2d");
    pd.page.render({
      canvasContext: ctx,
      viewport: viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
    }).promise.catch(function () {});

    pd.page.getTextContent().then(function (tc) {
      pdfjsLib.renderTextLayer({
        textContent: tc,
        container: textLayer,
        viewport: viewport,
        textDivs: [],
        textContentItemsStr: []
      }).catch(function () {});
    });
  }

  function setZoom(percent) {
    fitMode = "none";
    zoomLabelEl.textContent = percent + "%";
    renderAll();
  }

  // =========================================================================
  // Controls
  // =========================================================================
  function bindControls() {
    document.getElementById("pgPrev").onclick = function () {
      if (currentPage > 1) { currentPage--; scrollToPage(currentPage); }
    };
    document.getElementById("pgNext").onclick = function () {
      if (currentPage < pdfDoc.numPages) { currentPage++; scrollToPage(currentPage); }
    };
    document.getElementById("zoomIn").onclick = function () {
      var z = parseFloat(zoomLabelEl.textContent) * 1.2;
      setZoom(Math.round(Math.min(800, z)));
    };
    document.getElementById("zoomOut").onclick = function () {
      var z = parseFloat(zoomLabelEl.textContent) / 1.2;
      setZoom(Math.round(Math.max(10, z)));
    };
    document.getElementById("fitWidth").onclick = function () {
      fitMode = "width"; applyFit(true); renderAll();
    };
    document.getElementById("fitPage").onclick = function () {
      fitMode = "page"; applyFit(true); renderAll();
    };
    document.getElementById("actualSize").onclick = function () {
      setZoom(100);
    };

    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") doSearch();
    });
    document.getElementById("searchNext").onclick = function () { advanceSearch(1); };
    document.getElementById("searchPrev").onclick = function () { advanceSearch(-1); };

    var resizing;
    window.addEventListener("resize", function () {
      clearTimeout(resizing);
      resizing = setTimeout(function () {
        if (fitMode !== "none") { applyFit(true); renderAll(); }
      }, 200);
    });

    pdfRender.addEventListener("mousedown", function (e) {
      if (e.button === 0) {
        drag.active = true;
        drag.x = e.clientX; drag.y = e.clientY;
        drag.sl = pdfRender.scrollLeft; drag.st = pdfRender.scrollTop;
        pdfRender.classList.add("dragging");
        e.preventDefault();
      }
    });
    window.addEventListener("mousemove", function (e) {
      if (!drag.active) return;
      pdfRender.scrollLeft = drag.sl - (e.clientX - drag.x);
      pdfRender.scrollTop = drag.st - (e.clientY - drag.y);
    });
    window.addEventListener("mouseup", function () {
      drag.active = false;
      pdfRender.classList.remove("dragging");
    });

    pdfRender.addEventListener("scroll", function () {
      var mid = pdfRender.scrollTop + pdfRender.clientHeight / 2;
      var pages = pdfRender.querySelectorAll(".page");
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].offsetTop <= mid && pages[i].offsetTop + pages[i].offsetHeight >= mid) {
          currentPage = i + 1;
          pageNoEl.textContent = currentPage + " / " + pdfDoc.numPages;
          break;
        }
      }
    });
  }

  function scrollToPage(n) {
    var pages = pdfRender.querySelectorAll(".page");
    if (pages[n - 1]) {
      var target = pages[n - 1].offsetTop - 10;
      pdfRender.scrollTo({ top: target, behavior: "smooth" });
      currentPage = n;
      pageNoEl.textContent = currentPage + " / " + pdfDoc.numPages;
    }
  }

  // =========================================================================
  // Search
  // =========================================================================
  function clearHighlights() {
    var spans = pdfRender.querySelectorAll(".textLayer .hl");
    for (var i = 0; i < spans.length; i++) {
      spans[i].classList.remove("hl");
    }
  }

  function doSearch() {
    var q = searchInput.value.trim().toLowerCase();
    clearHighlights();
    searchMatches = [];
    searchIdx = -1;
    if (!q) { searchStatus.textContent = ""; return; }

    var pageEls = pdfRender.querySelectorAll(".page");
    for (var i = 0; i < pageEls.length; i++) {
      var spans = pageEls[i].querySelectorAll(".textLayer span");
      for (var j = 0; j < spans.length; j++) {
        if (spans[j].textContent.toLowerCase().indexOf(q) > -1) {
          spans[j].classList.add("hl");
          searchMatches.push({ pageEl: pageEls[i], pageIndex: i, span: spans[j] });
        }
      }
    }

    if (searchMatches.length === 0) {
      searchStatus.textContent = "No matches";
      return;
    }
    searchStatus.textContent = searchMatches.length + " match" + (searchMatches.length > 1 ? "es" : "");
    searchIdx = 0;
    gotoMatch(searchMatches[0]);
  }

  function advanceSearch(dir) {
    if (searchMatches.length === 0) return;
    searchIdx = (searchIdx + dir + searchMatches.length) % searchMatches.length;
    gotoMatch(searchMatches[searchIdx]);
  }

  function gotoMatch(m) {
    var pageNum = m.pageIndex + 1;
    currentPage = pageNum;
    pageNoEl.textContent = currentPage + " / " + pdfDoc.numPages;
    m.span.scrollIntoView({ block: "center", behavior: "smooth" });
    var prevActive = pdfRender.querySelector(".hl.active");
    if (prevActive) prevActive.classList.remove("active");
    m.span.classList.add("active");
  }
})();
