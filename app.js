(function () {
  "use strict";

  const APK_RELATIVE = "https://github.com/darshan8890/lyra/releases/download/v1.6.47/LYRA-v1.6.47.apk";
  const SHA256_HASH = "E4E89D541058EDFD20AE5773EA0F7A87966E3380808C956F0B9186EAFB5D33C8";
  const RADIO_BASE = "https://lyra-radio.mesquite-scale.workers.dev";
  const RADIO_INFO_URL = `${RADIO_BASE}/v1/info`;
  const RADIO_CATALOG_URL = `${RADIO_BASE}/v1/catalog`;

  const FALLBACK_TRACKS = [
    {
      id: "demo-1",
      title: "Midnight Rose",
      artist: "LYRA Radio · Night Drive",
      genre: "Night Drive",
      badge: "DEMO PREVIEW",
      art: "assets/bg_genre_nightdrive.png",
      durationSec: 228,
      audioUrl: null,
      videoUrl: null,
      glow: "radial-gradient(circle, rgba(201,149,108,0.32), rgba(122,91,138,0.18), transparent 72%)",
    },
    {
      id: "demo-2",
      title: "Velvet Rain",
      artist: "Local Library · Lo-Fi Chill",
      genre: "Lo-Fi",
      badge: "DEMO PREVIEW",
      art: "assets/bg_genre_lofi.png",
      durationSec: 176,
      audioUrl: null,
      videoUrl: null,
      glow: "radial-gradient(circle, rgba(122,91,138,0.34), rgba(201,149,108,0.16), transparent 72%)",
    },
    {
      id: "demo-3",
      title: "Monsoon Letter",
      artist: "LYRA Radio · Rainy Evening",
      genre: "Rainy",
      badge: "DEMO PREVIEW",
      art: "assets/bg_genre_rainy.png",
      durationSec: 252,
      audioUrl: null,
      videoUrl: null,
      glow: "radial-gradient(circle, rgba(110,152,186,0.28), rgba(201,149,108,0.18), transparent 72%)",
    },
  ];

  const GENRE_ART_MAP = [
    ["lofi", "assets/bg_genre_lofi.png"],
    ["chill", "assets/bg_genre_lofi.png"],
    ["night", "assets/bg_genre_nightdrive.png"],
    ["drive", "assets/bg_genre_nightdrive.png"],
    ["rain", "assets/bg_genre_rainy.png"],
    ["sad", "assets/bg_genre_rainy.png"],
    ["acoustic", "assets/bg_genre_acoustic.png"],
    ["bollywood", "assets/bg_genre_bollywood.png"],
    ["hindi", "assets/bg_genre_bollywood.png"],
    ["90s", "assets/bg_genre_romantic90s.png"],
    ["romantic", "assets/bg_genre_romantic90s.png"],
    ["focus", "assets/bg_genre_focus.png"],
    ["workout", "assets/bg_genre_workout.png"],
    ["run", "assets/bg_genre_workout.png"],
  ];

  const EQ_FREQS = [60, 230, 910, 3600, 14000];
  const EQ_PRESETS = {
    warm: [4, 2, -1, 3, 5],
    bass: [8, 5, 0, 1, 2],
    vocal: [-2, 1, 4, 6, 4],
    flat: [0, 0, 0, 0, 0],
  };

  function fallbackArtFor(track) {
    const hay = `${track.genre || ""} ${track.album || ""} ${track.title || ""}`.toLowerCase();
    for (const [kw, img] of GENRE_ART_MAP) {
      if (hay.includes(kw)) return img;
    }
    return "assets/bg_genre_nightdrive.png";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 3800);
  }

  // Mobile Drawer
  const menuToggle = document.getElementById("menuToggle");
  const mobileDrawer = document.getElementById("mobileDrawer");
  if (menuToggle && mobileDrawer) {
    menuToggle.addEventListener("click", () => {
      const open = mobileDrawer.hidden;
      mobileDrawer.hidden = !open;
      menuToggle.setAttribute("aria-expanded", String(open));
    });
    mobileDrawer.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileDrawer.hidden = true;
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Phone Preview Tabs
  const phoneTabs = document.querySelectorAll(".phone-tab");
  const phonePanels = document.querySelectorAll(".phone-panel");
  function activateTab(name) {
    phoneTabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    phonePanels.forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    if (name === "lyrics" && typeof lyricsBox !== "undefined" && lyricsBox) {
      const activeNode = lyricsBox.querySelector(".lyric-line.is-active");
      if (activeNode) scrollLyricsToActive(activeNode, true);
    }
  }
  phoneTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  // Player DOM refs
  const artImg = document.getElementById("previewArtImg");
  const artCard = document.getElementById("previewArtCard");
  const canvasVideo = document.getElementById("previewCanvasVideo");
  const canvasToggleBtn = document.getElementById("canvasToggleBtn");
  const badgeEl = document.getElementById("previewBadge");
  const titleEl = document.getElementById("previewTitle");
  const artistEl = document.getElementById("previewArtist");
  const timeCurEl = document.getElementById("previewTimeCurrent");
  const timeTotEl = document.getElementById("previewTimeTotal");
  const progressEl = document.getElementById("previewProgress");
  const progressTrackEl = document.getElementById("previewProgressTrack");
  const waveformEl = document.getElementById("previewWaveform");
  const waveBars = waveformEl ? Array.from(waveformEl.querySelectorAll("span")) : [];
  const phoneGlowEl = document.getElementById("phoneGlow");
  const playToggleBtn = document.getElementById("playToggleBtn");
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  const likeBtn = document.getElementById("previewLikeBtn");
  const previewHint = document.getElementById("previewHint");
  const phoneQueueEl = document.getElementById("phoneQueue");
  const queueListEl = document.getElementById("queueList");
  const queueCountLabel = document.getElementById("queueCountLabel");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // State
  let tracks = [...FALLBACK_TRACKS];
  let trackIndex = 0;
  let isPlaying = false;
  let demoElapsed = 0;
  let canvasEnabled = true;
  let currentEqGains = [...EQ_PRESETS.warm];
  let loudnessMatchOn = true;

  // Real HTML5 Audio + Web Audio 5-Band EQ + FFT Analyser
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.preload = "metadata";

  let audioCtx = null;
  let eqFilters = [];
  let masterGain = null;
  let analyser = null;
  let fftBins = null;

  function ensureWebAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtx = new Ctx();
      const source = audioCtx.createMediaElementSource(audio);
      let node = source;
      eqFilters = EQ_FREQS.map((freq, idx) => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = idx === 0 ? "lowshelf" : idx === EQ_FREQS.length - 1 ? "highshelf" : "peaking";
        filter.frequency.value = freq;
        filter.Q.value = 1.1;
        filter.gain.value = currentEqGains[idx] || 0;
        node.connect(filter);
        node = filter;
        return filter;
      });
      masterGain = audioCtx.createGain();
      masterGain.gain.value = loudnessMatchOn ? 0.88 : 1.0;
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      fftBins = new Uint8Array(analyser.frequencyBinCount);

      node.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch {
      audioCtx = null;
    }
  }

  function applyEqToAudio() {
    eqFilters.forEach((f, idx) => {
      if (f && audioCtx) {
        f.gain.setTargetAtTime(currentEqGains[idx] || 0, audioCtx.currentTime, 0.04);
      }
    });
    if (masterGain && audioCtx) {
      masterGain.gain.setTargetAtTime(loudnessMatchOn ? 0.88 : 1.0, audioCtx.currentTime, 0.05);
    }
  }

  function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function triggerArtSwap() {
    if (!artCard || reducedMotion) return;
    artCard.classList.remove("is-swapping");
    void artCard.offsetWidth;
    artCard.classList.add("is-swapping");
  }

  function setPlayVisual(playing) {
    isPlaying = playing;
    if (waveformEl) waveformEl.classList.toggle("is-paused", !playing);
    if (playToggleBtn) playToggleBtn.classList.toggle("is-playing", playing);
    if (playIcon) {
      playIcon.style.display = playing ? "none" : "block";
      playIcon.toggleAttribute("hidden", playing);
    }
    if (pauseIcon) {
      pauseIcon.style.display = playing ? "block" : "none";
      pauseIcon.toggleAttribute("hidden", !playing);
    }
    if (canvasVideo && !canvasVideo.hidden) {
      if (playing) canvasVideo.play().catch(() => {});
      else canvasVideo.pause();
    }
  }

  function updateProgressUI() {
    const t = tracks[trackIndex];
    if (!t) return;
    const hasRealAudio = Boolean(t.audioUrl);
    const cur = hasRealAudio ? audio.currentTime || 0 : demoElapsed;
    const total = hasRealAudio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : t.durationSec || 180;
    const pct = Math.min(100, Math.max(0, (cur / total) * 100));
    if (progressEl) progressEl.style.width = `${pct.toFixed(1)}%`;
    if (progressTrackEl) progressTrackEl.setAttribute("aria-valuenow", String(Math.round(pct)));
    if (timeCurEl) timeCurEl.textContent = fmtTime(cur);
    if (timeTotEl) timeTotEl.textContent = fmtTime(total);
    syncActiveLyric(cur);
  }

  function syncCanvasVideo(track) {
    if (!canvasVideo || !canvasToggleBtn) return;
    if (track && track.videoUrl) {
      canvasToggleBtn.hidden = false;
      canvasToggleBtn.classList.toggle("is-on", canvasEnabled);
      if (canvasEnabled) {
        if (canvasVideo.src !== track.videoUrl) {
          canvasVideo.src = track.videoUrl;
        }
        canvasVideo.hidden = false;
        if (isPlaying) canvasVideo.play().catch(() => {});
      } else {
        canvasVideo.pause();
        canvasVideo.hidden = true;
      }
    } else {
      canvasToggleBtn.hidden = true;
      canvasVideo.pause();
      canvasVideo.removeAttribute("src");
      canvasVideo.hidden = true;
    }
  }

  function renderQueue() {
    if (!queueListEl) return;
    if (queueCountLabel) queueCountLabel.textContent = `LYRA Radio · ${tracks.length} tracks`;
    queueListEl.innerHTML = tracks
      .map((t, idx) => {
        const active = idx === trackIndex ? " is-active" : "";
        return `<li><button type="button" class="queue-item${active}" data-qidx="${idx}"><img src="${escapeHtml(t.art)}" alt="" loading="lazy" /><div><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.artist)}</small></div></button></li>`;
      })
      .join("");
    queueListEl.querySelectorAll("[data-qidx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.qidx);
        if (Number.isInteger(idx)) {
          loadTrack(idx, true);
          if (phoneQueueEl) phoneQueueEl.hidden = true;
        }
      });
    });
  }

  function loadTrack(idx, autoPlay) {
    if (!tracks.length) return;
    trackIndex = ((idx % tracks.length) + tracks.length) % tracks.length;
    const t = tracks[trackIndex];
    demoElapsed = 0;

    if (artImg) {
      artImg.src = t.art;
      artImg.alt = `${t.title} artwork`;
    }
    triggerArtSwap();
    if (badgeEl) badgeEl.textContent = t.badge || "LYRA RADIO · LIVE";
    if (titleEl) titleEl.textContent = t.title;
    if (artistEl) artistEl.textContent = t.artist;
    if (phoneGlowEl && t.glow) phoneGlowEl.style.background = t.glow;

    if (t.audioUrl) {
      if (audio.src !== t.audioUrl) {
        audio.src = t.audioUrl;
      }
      if (previewHint) {
        previewHint.textContent = autoPlay
          ? "Streaming live via Web Audio EQ"
          : "Tap Play to stream live from LYRA Radio";
      }
    } else if (previewHint) {
      previewHint.textContent = "Demo mode · Load a local file or go online for Radio";
    }

    syncCanvasVideo(t);
    renderQueue();
    if (typeof syncCatalogPlayingState === "function") syncCatalogPlayingState();
    updateProgressUI();
    setLyricShift(0);
    if (lyricsBox) fetchLyricsForTrack(t);

    if (autoPlay) {
      playCurrent();
    } else {
      setPlayVisual(false);
    }
  }

  function playCurrent() {
    const t = tracks[trackIndex];
    if (!t) return;
    if (t.audioUrl) {
      ensureWebAudio();
      audio
        .play()
        .then(() => {
          setPlayVisual(true);
          if (previewHint) previewHint.textContent = "Streaming live · Try Lyrics, Copilot & Lab EQ";
        })
        .catch(() => {
          setPlayVisual(false);
          showToast("Tap Play once to start audio in your browser.");
        });
    } else {
      setPlayVisual(true);
    }
  }

  function pauseCurrent() {
    audio.pause();
    setPlayVisual(false);
  }

  audio.addEventListener("timeupdate", updateProgressUI);
  audio.addEventListener("loadedmetadata", () => {
    const t = tracks[trackIndex];
    if (t && Number.isFinite(audio.duration) && audio.duration > 0) {
      const realDur = Math.round(audio.duration);
      const changed = !t.realDurationSec || Math.abs(t.realDurationSec - realDur) > 3;
      t.realDurationSec = realDur;
      t.durationSec = realDur;
      updateProgressUI();
      if (changed) {
        fetchLyricsForTrack(t);
      }
    } else {
      updateProgressUI();
    }
  });
  audio.addEventListener("ended", () => loadTrack(trackIndex + 1, true));
  audio.addEventListener("error", () => {
    setPlayVisual(false);
    if (previewHint) previewHint.textContent = "Stream unavailable — try another track";
  });

  if (playToggleBtn) {
    playToggleBtn.addEventListener("click", () => {
      if (isPlaying) pauseCurrent();
      else playCurrent();
    });
  }

  document.getElementById("prevTrackBtn")?.addEventListener("click", () => {
    loadTrack(trackIndex - 1, true);
  });
  document.getElementById("nextTrackBtn")?.addEventListener("click", () => {
    loadTrack(trackIndex + 1, true);
  });
  if (likeBtn) {
    likeBtn.addEventListener("click", () => likeBtn.classList.toggle("is-liked"));
  }
  canvasToggleBtn?.addEventListener("click", () => {
    canvasEnabled = !canvasEnabled;
    syncCanvasVideo(tracks[trackIndex]);
  });

  // Queue toggle
  document.getElementById("queueToggleBtn")?.addEventListener("click", () => {
    if (phoneQueueEl) phoneQueueEl.hidden = !phoneQueueEl.hidden;
  });
  document.getElementById("closeQueueBtn")?.addEventListener("click", () => {
    if (phoneQueueEl) phoneQueueEl.hidden = true;
  });

  // Local audio file playback inside the phone screen!
  document.getElementById("localAudioInput")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    const localTrack = {
      id: `local-${Date.now()}`,
      title: cleanName,
      artist: "Your Device · Local File",
      genre: "Local Library",
      badge: "ON-DEVICE · LOCAL",
      art: "assets/bg_genre_acoustic.png",
      durationSec: 0,
      audioUrl: blobUrl,
      videoUrl: null,
      glow: "radial-gradient(circle, rgba(226,180,138,0.34), rgba(122,91,138,0.16), transparent 72%)",
    };
    tracks.unshift(localTrack);
    loadTrack(0, true);
    showToast(`Playing local file: ${cleanName}`);
  });

  if (progressTrackEl) {
    progressTrackEl.addEventListener("click", (e) => {
      const rect = progressTrackEl.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const t = tracks[trackIndex];
      if (!t) return;
      if (t.audioUrl && Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = audio.duration * ratio;
      } else {
        demoElapsed = Math.round((t.durationSec || 180) * ratio);
      }
      updateProgressUI();
    });
  }

  // Demo timer tick when playing fallback tracks without audioUrl
  setInterval(() => {
    const t = tracks[trackIndex];
    if (!isPlaying || !t || t.audioUrl) return;
    demoElapsed += 1;
    if (demoElapsed >= (t.durationSec || 180)) {
      loadTrack(trackIndex + 1, true);
    } else {
      updateProgressUI();
    }
  }, 1000);

  // --- Live Synced Lyrics + Translation (LYRA LrcParser + Metadata Scoring) ---
  const lyricsBox = document.getElementById("lyricsBox");
  const lyricsFootText = document.getElementById("lyricsFootText");
  const translateBtn = document.getElementById("translateToggle");
  let activeLyrics = [];
  let translatedMode = false;
  let lastActiveLineIdx = -1;
  let lyricsFetchSeq = 0;
  let lyricShiftSec = 0;
  const lyricSyncResetBtn = document.getElementById("lyricSyncReset");

  function setLyricShift(nextShift) {
    lyricShiftSec = Math.round(nextShift * 10) / 10;
    if (lyricSyncResetBtn) {
      const sign = lyricShiftSec > 0 ? "+" : "";
      lyricSyncResetBtn.textContent = `${sign}${lyricShiftSec.toFixed(1)}s`;
    }
    syncActiveLyric(tracks[trackIndex]?.audioUrl ? audio.currentTime || 0 : demoElapsed);
  }

  document.getElementById("lyricSyncMinus")?.addEventListener("click", () => setLyricShift(lyricShiftSec - 0.5));
  document.getElementById("lyricSyncPlus")?.addEventListener("click", () => setLyricShift(lyricShiftSec + 0.5));
  lyricSyncResetBtn?.addEventListener("click", () => setLyricShift(0));

  function cleanSongTitle(raw) {
    let s = String(raw || "")
      .replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus|wma|mp4|mkv)$/i, "")
      .replace(/[(\[]\s*(?:pagalnew|pagalworld|djpunjab|mr[- ]?jatt|songs?\.?pk|djbaap|raag|youtube|spotify|official(?:\s+(?:audio|video|music\s*video|lyric\s*video))?|lyric(?:s)?(?:\s+video)?|full\s*song|hd|hq|4k|8k|\d{2,3}\s*kbps|downloaded?|free\s*download|audio|video|music\s*video)\s*[)\]]/gi, " ")
      .replace(/\s*[(\[]?\s*from\s+[""']?.+?[""']?\s*[)\]]?\s*$/i, "")
      .replace(/\b\d{2,3}\s*kbps\b/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return s || String(raw || "").trim();
  }

  function stripParens(raw) {
    return String(raw || "")
      .replace(/\s*[(\[][^)\]]*[)\]]\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function cleanPrimaryArtist(raw) {
    let s = String(raw || "")
      .replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i, "")
      .replace(/\s*(?:,|&|\/|\u2013|\u2014|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bwith\b).*$/i, "")
      .trim();
    if (/^(unknown|unknown artist|<unknown>|various|various artists|va|lyra radio)$/i.test(s)) return "";
    return s;
  }

  function normCompare(str) {
    return cleanSongTitle(str)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreLyricCandidate(item, wantedTitle, wantedTitleFull, wantedArtistFull, wantedAlbum, wantedDurSec) {
    if (!item || item.instrumental) return -999;
    const raw = item.syncedLyrics || item.plainLyrics;
    if (!raw || !String(raw).trim()) return -999;

    let score = 0;
    const ct = normCompare(item.trackName || item.name || "");
    const ctRaw = String(item.trackName || item.name || "").toLowerCase();
    const wt = normCompare(wantedTitle);
    const wtFull = normCompare(wantedTitleFull || wantedTitle);

    if (ct && wt) {
      if (ct === wtFull) score += 65;
      else if (ct === wt) score += 55;
      else if (ct.includes(wt) || wt.includes(ct)) score += 38;
      else {
        const tokens = wt.split(" ").filter((t) => t.length > 2);
        const hits = tokens.filter((t) => ct.includes(t)).length;
        score += hits * 10;
        if (tokens.length && hits === 0) score -= 35;
      }
    }

    const wantMale = /\bmale\b/i.test(wantedTitleFull || "");
    const wantFemale = /\bfemale\b/i.test(wantedTitleFull || "");
    if (wantMale && /\bfemale\b/i.test(ctRaw)) score -= 35;
    if (wantFemale && /\bmale\b/i.test(ctRaw)) score -= 35;

    if (wantedArtistFull) {
      const ca = normCompare(item.artistName || "");
      const artistParts = String(wantedArtistFull)
        .split(/,|&|\/|\u2013|\u2014|\bfeat\.?\b|\bft\.?\b/i)
        .map((p) => normCompare(p))
        .filter((p) => p.length > 2);
      const wa = normCompare(wantedArtistFull);
      if (ca && wa) {
        if (ca === wa) score += 30;
        else if (artistParts.some((p) => ca.includes(p) || p.includes(ca))) score += 22;
        else {
          const tokens = wa.split(" ").filter((t) => t.length > 2);
          const hits = tokens.filter((t) => ca.includes(t)).length;
          score += hits * 8;
        }
      }
    }

    if (wantedAlbum) {
      const cal = normCompare(item.albumName || "");
      const wal = normCompare(wantedAlbum);
      if (cal && wal && (cal === wal || cal.includes(wal) || wal.includes(cal))) {
        score += 22;
      }
    }

    const cdur = Number(item.duration);
    if (wantedDurSec > 0 && Number.isFinite(cdur) && cdur > 0) {
      const delta = Math.abs(cdur - wantedDurSec);
      if (delta <= 2) score += 28;
      else if (delta <= 5) score += 16;
      else if (delta <= 12) score += 6;
      else if (delta > 25) score -= 10;
    }

    if (item.syncedLyrics) score += 14;
    if (/[\u0900-\u0D7F]/.test(raw)) score += 16;
    return score;
  }

  function parseLrc(lrcText) {
    const raw = String(lrcText || "");
    let offsetSec = 0;
    const offMatch = raw.match(/\[offset:\s*([+-]?\d+)\s*]/i);
    if (offMatch) offsetSec = Number(offMatch[1]) / 1000;

    const stampRe = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?]/g;
    const wordTagRe = /<\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?>/g;
    const metaRe = /^\[(ti|ar|al|by|offset|re|ve|length):[^\]]*]$/i;
    const lines = [];

    raw.split(/\r?\n/).forEach((origLine) => {
      const line = origLine.trim();
      if (!line) return;
      if (metaRe.test(line)) return;
      const stamps = [];
      let m;
      stampRe.lastIndex = 0;
      while ((m = stampRe.exec(line)) !== null) {
        const min = Number(m[1]);
        const sec = Number(m[2]);
        const frac = m[3] ? Number(m[3].padEnd(3, "0")) / 1000 : 0;
        stamps.push(Math.max(0, min * 60 + sec + frac + offsetSec));
      }
      if (!stamps.length) return;
      const text = line.replace(stampRe, "").replace(wordTagRe, "").replace(/\s{2,}/g, " ").trim();
      if (!text) return;
      stamps.forEach((time) => lines.push({ time, orig: text, en: null }));
    });

    lines.sort((a, b) => a.time - b.time);
    return lines;
  }

  function renderLyricsList() {
    if (!lyricsBox) return;
    if (!activeLyrics.length) {
      lyricsBox.innerHTML = `<p class="lyric-line is-active">No synced lyrics found for this track yet.</p>`;
      return;
    }
    lyricsBox.innerHTML = activeLyrics
      .map((line, i) => {
        const text = translatedMode && line.en ? line.en : line.orig;
        const active = i === lastActiveLineIdx ? " is-active" : "";
        return `<p class="lyric-line${active}" data-lidx="${i}">${escapeHtml(text)}</p>`;
      })
      .join("");
    lyricsBox.querySelectorAll("[data-lidx]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.lidx);
        const line = activeLyrics[idx];
        if (line && typeof line.time === "number" && tracks[trackIndex]?.audioUrl) {
          audio.currentTime = Math.max(0, line.time - lyricShiftSec);
          if (!isPlaying) playCurrent();
        }
        lastActiveLineIdx = idx;
        lyricsBox.querySelectorAll(".lyric-line").forEach((n, i) => n.classList.toggle("is-active", i === idx));
      });
    });
  }

  function scrollLyricsToActive(node, instant) {
    if (!node || !lyricsBox || lyricsBox.closest("[hidden]")) return;
    const targetTop = node.offsetTop - lyricsBox.clientHeight / 2 + node.clientHeight / 2;
    lyricsBox.scrollTo({
      top: Math.max(0, targetTop),
      behavior: instant ? "auto" : "smooth",
    });
  }

  function syncActiveLyric(currentSec) {
    if (!activeLyrics.length || !lyricsBox) return;
    if (typeof activeLyrics[0].time !== "number") return;
    const effective = currentSec + lyricShiftSec + 0.15;
    let idx = -1;
    for (let i = 0; i < activeLyrics.length; i++) {
      if (effective >= activeLyrics[i].time) idx = i;
      else break;
    }
    if (idx !== lastActiveLineIdx) {
      lastActiveLineIdx = idx;
      const nodes = lyricsBox.querySelectorAll(".lyric-line");
      nodes.forEach((n, i) => n.classList.toggle("is-active", i === idx));
      if (idx >= 0) scrollLyricsToActive(nodes[idx], false);
    }
  }

  async function fetchLyricsForTrack(track) {
    const seq = ++lyricsFetchSeq;
    lastActiveLineIdx = -1;
    activeLyrics = [];

    if (!track || !track.audioUrl) {
      activeLyrics = [
        { time: 0, orig: "Raat ke saaye mein dhadkan bolti hai", en: "In the shadows of the night, the heartbeat speaks" },
        { time: 5, orig: "Khamoshi mein bhi ek dhun chhupi hai", en: "Even inside silence, a melody stays hidden" },
        { time: 10, orig: "Sitaron ke neeche yeh safar chalta rahe", en: "Beneath the stars, let this journey keep moving" },
        { time: 15, orig: "Har sur mein tera hi naam mile", en: "In every note, only your name appears" },
      ];
      renderLyricsList();
      return;
    }

    if (lyricsBox) {
      lyricsBox.innerHTML = `<p class="lyric-line is-active">Loading lyrics…</p>`;
    }

    const titleFull = cleanSongTitle(track.title);
    const titleBare = stripParens(titleFull) || titleFull;
    const artist = cleanPrimaryArtist(track.artist);
    const artistFull = String(track.artist || "").replace(/\u2013|\u2014/g, "-").trim();
    const album = track.album && !/^lyra radio$/i.test(track.album) ? cleanSongTitle(track.album) : "";
    const realDur = track.realDurationSec && track.realDurationSec > 0 ? track.realDurationSec : 0;

    try {
      let bestHit = null;
      let bestScore = -999;

      // 1. Exact get using real decoded audio duration + album + artist variants
      for (const tCand of [...new Set([titleFull, titleBare].filter(Boolean))]) {
        for (const aCand of [...new Set([artistFull, artist].filter(Boolean))]) {
          const p = new URLSearchParams({ track_name: tCand, artist_name: aCand });
          if (album) p.set("album_name", album);
          if (realDur > 0) p.set("duration", String(realDur));
          const rExact = await fetch(`https://lrclib.net/api/get?${p.toString()}`);
          if (seq !== lyricsFetchSeq) return;
          if (rExact.ok) {
            const obj = await rExact.json();
            const sc = scoreLyricCandidate(obj, titleBare, titleFull, artistFull, album, realDur);
            if (sc > bestScore) {
              bestHit = obj;
              bestScore = sc;
            }
            if (bestHit && bestHit.syncedLyrics && bestScore >= 65) break;
          }
        }
        if (bestHit && bestHit.syncedLyrics && bestScore >= 65) break;
      }

      // 2. Scored search candidates across title/artist/album variants
      if (!bestHit || !bestHit.syncedLyrics || bestScore < 65) {
        const queries = [];
        if (titleBare && artistFull) {
          queries.push(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: titleBare, artist_name: artistFull }).toString()}`);
        }
        if (titleBare && artist && artist !== artistFull) {
          queries.push(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: titleBare, artist_name: artist }).toString()}`);
        }
        if (titleFull !== titleBare && artist) {
          queries.push(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: titleFull, artist_name: artist }).toString()}`);
        }
        if (titleBare && album) {
          queries.push(`https://lrclib.net/api/search?${new URLSearchParams({ q: `${titleBare} ${album}` }).toString()}`);
        }
        if (titleBare) {
          queries.push(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: titleBare }).toString()}`);
        }

        for (const url of queries) {
          const r = await fetch(url);
          if (seq !== lyricsFetchSeq) return;
          if (!r.ok) continue;
          const arr = await r.json();
          if (!Array.isArray(arr)) continue;
          for (const item of arr) {
            const sc = scoreLyricCandidate(item, titleBare, titleFull, artistFull, album, realDur);
            if (sc > bestScore) {
              bestScore = sc;
              bestHit = item;
            }
          }
          if (bestHit && bestHit.syncedLyrics && bestScore >= 75) break;
        }
      }

      if (seq !== lyricsFetchSeq) return;

      if (bestHit && bestScore >= 12 && bestHit.syncedLyrics) {
        activeLyrics = parseLrc(bestHit.syncedLyrics);
        const matchedDur = Number(bestHit.duration) || 0;
        if (lyricsFootText) {
          lyricsFootText.textContent =
            realDur > 0 && matchedDur > 0 && Math.abs(matchedDur - realDur) > 15
              ? "Video edit differs from studio — use −0.5s / +0.5s to align"
              : "Tap any line to jump · Use −0.5s / +0.5s to fine-tune";
        }
      } else if (bestHit && bestScore >= 12 && bestHit.plainLyrics) {
        activeLyrics = bestHit.plainLyrics
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 60)
          .map((orig) => ({ orig, en: null }));
        if (lyricsFootText) lyricsFootText.textContent = "Scroll to read lyrics";
      } else {
        activeLyrics = [];
      }
    } catch {
      if (seq !== lyricsFetchSeq) return;
      activeLyrics = [];
    }

    renderLyricsList();
    syncActiveLyric(audio.currentTime || 0);
  }

  setInterval(() => {
    if (isPlaying && tracks[trackIndex]?.audioUrl) {
      syncActiveLyric(audio.currentTime || 0);
    }
  }, 200);

  translateBtn?.addEventListener("click", async () => {
    translatedMode = !translatedMode;
    translateBtn.setAttribute("aria-pressed", String(translatedMode));
    translateBtn.textContent = translatedMode ? "Translate: ON (EN)" : "Translate: OFF";

    if (translatedMode && activeLyrics.length) {
      const needsTx = activeLyrics.slice(0, 12).filter((l) => !l.en && /[^\x00-\x7F]/.test(l.orig));
      if (needsTx.length) {
        translateBtn.textContent = "Translating…";
        await Promise.all(
          needsTx.map(async (line) => {
            try {
              const res = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(line.orig)}&langpair=Autodetect|en`
              );
              const data = await res.json();
              if (data?.responseData?.translatedText) {
                line.en = data.responseData.translatedText;
              }
            } catch {}
          })
        );
        translateBtn.textContent = "Translate: ON (EN)";
      }
    }
    renderLyricsList();
  });

  // --- Live Music Copilot ---
  const copilotForm = document.getElementById("copilotForm");
  const copilotInput = document.getElementById("copilotInput");
  const copilotChips = document.querySelectorAll("[data-copilot]");
  const copilotTitle = document.getElementById("copilotTitle");
  const copilotDesc = document.getElementById("copilotDesc");
  const copilotTracksEl = document.getElementById("copilotTracks");

  const COPILOT_RULES = {
    all: { title: "Radio Hits · Live Catalog", desc: "Top live tracks streaming on LYRA Radio. Tap to play.", words: [] },
    chill: { title: "Chill & Lo-Fi Mix", desc: "Mellow, late-night & rainy favorites matched to your mood.", words: ["lofi", "chill", "rain", "night", "slow", "sad", "acoustic", "moon"] },
    romantic: { title: "Romantic & 90s Classics", desc: "Warm vocals and nostalgic melodies. Tap any track to play.", words: ["love", "romantic", "90s", "dil", "pyaar", "ishq", "heart", "rose"] },
    energy: { title: "Workout & High Energy", desc: "Upbeat tracks to keep momentum high.", words: ["workout", "run", "beat", "dance", "party", "drive", "fire", "bass"] },
  };

  function runCopilotQuery(query, presetKey) {
    const rule = presetKey ? COPILOT_RULES[presetKey] : null;
    const raw = (query || "").trim().toLowerCase();
    const terms = raw ? raw.split(/\s+/).filter(Boolean) : rule ? rule.words : [];

    const scored = tracks.map((t, idx) => {
      const hay = `${t.title} ${t.artist} ${t.genre || ""} ${t.album || ""}`.toLowerCase();
      let score = 0;
      terms.forEach((w) => {
        if (hay.includes(w)) score += 3;
      });
      return { t, idx, score };
    });

    let matches = terms.length ? scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score) : scored;
    let fallbackUsed = false;
    if (!matches.length) {
      matches = scored;
      fallbackUsed = true;
    }

    const picked = matches.slice(0, 5);
    if (copilotTitle) {
      copilotTitle.textContent = rule ? rule.title : `Mix for “${query.trim()}”`;
    }
    if (copilotDesc) {
      copilotDesc.textContent = fallbackUsed
        ? "No exact keyword match — picked serendipitous favorites from LYRA Radio."
        : rule
          ? rule.desc
          : `Matched ${matches.length} track(s) from the live catalog. Tap to play.`;
    }
    if (copilotTracksEl) {
      copilotTracksEl.innerHTML = picked
        .map(
          ({ t, idx }, i) =>
            `<li data-playidx="${idx}"><span>0${i + 1}</span><div><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.artist)}</small></div></li>`
        )
        .join("");
      copilotTracksEl.querySelectorAll("[data-playidx]").forEach((li) => {
        li.addEventListener("click", () => {
          const idx = Number(li.dataset.playidx);
          activateTab("player");
          loadTrack(idx, true);
        });
      });
    }
  }

  copilotForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    copilotChips.forEach((c) => c.classList.remove("is-selected"));
    runCopilotQuery(copilotInput?.value || "", null);
  });

  copilotChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      copilotChips.forEach((c) => c.classList.remove("is-selected"));
      chip.classList.add("is-selected");
      const key = chip.dataset.copilot;
      if (copilotInput) copilotInput.value = "";
      runCopilotQuery("", key);
    });
  });

  // --- Music Lab EQ (Real Web Audio BiquadFilters) ---
  const eqButtons = document.querySelectorAll("[data-preset]");
  const eqRanges = Array.from(document.querySelectorAll("#eqSliders input[type='range']"));
  const loudnessToggle = document.getElementById("loudnessMatchToggle");

  eqButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const values = EQ_PRESETS[btn.dataset.preset];
      if (!values) return;
      eqButtons.forEach((b) => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      currentEqGains = [...values];
      eqRanges.forEach((slider, idx) => {
        if (typeof values[idx] === "number") slider.value = String(values[idx]);
      });
      applyEqToAudio();
    });
  });

  eqRanges.forEach((slider, idx) => {
    slider.addEventListener("input", () => {
      currentEqGains[idx] = Number(slider.value) || 0;
      eqButtons.forEach((b) => b.classList.remove("is-selected"));
      applyEqToAudio();
    });
  });

  loudnessToggle?.addEventListener("change", () => {
    loudnessMatchOn = loudnessToggle.checked;
    applyEqToAudio();
  });

  // Mood cards pick a matching live track or preview mood
  const moodCards = document.querySelectorAll(".mood-card");
  moodCards.forEach((card) => {
    card.addEventListener("click", () => {
      moodCards.forEach((m) => m.classList.remove("is-active"));
      card.classList.add("is-active");
      const mood = (card.dataset.mood || "").toLowerCase();
      const words = mood.split(/\s+/);
      const foundIdx = tracks.findIndex((t) => {
        const hay = `${t.title} ${t.artist} ${t.genre || ""}`.toLowerCase();
        return words.some((w) => hay.includes(w));
      });
      activateTab("player");
      if (foundIdx >= 0) {
        loadTrack(foundIdx, true);
      } else {
        loadTrack((trackIndex + 1) % tracks.length, true);
      }
      document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  // --- Fetch Real Live LYRA Radio Catalog ---
  async function loadLiveCatalog() {
    try {
      const res = await fetch(RADIO_CATALOG_URL);
      if (!res.ok) throw new Error("catalog error");
      const data = await res.json();
      const liveTracks = Array.isArray(data?.tracks) ? data.tracks : [];
      if (liveTracks.length) {
        tracks = liveTracks.map((item) => ({
          id: item.id,
          title: item.title || "Untitled",
          artist: item.artist || "LYRA Radio",
          album: item.album || "LYRA Radio",
          genre: item.genre || "Radio",
          badge: item.hasVideo ? "LYRA RADIO · CANVAS" : "LYRA RADIO · LIVE",
          art: item.artworkUrl || item.artistPhotoUrl || fallbackArtFor(item),
          durationSec: Math.round((Number(item.durationMs) || 180000) / 1000),
          audioUrl: item.audioUrl || null,
          videoUrl: item.hasVideo ? item.videoUrl : null,
          glow: "radial-gradient(circle, rgba(201,149,108,0.34), rgba(122,91,138,0.2), transparent 72%)",
        }));
        const statusEl = document.getElementById("radioStatusText");
        if (statusEl) {
          statusEl.textContent = `LYRA Radio Live · ${tracks.length} Tracks Streaming`;
        }
        loadTrack(0, false);
        runCopilotQuery("", "all");
        if (typeof refreshCatalogDrawerData === "function") refreshCatalogDrawerData();
        return;
      }
    } catch {}
    loadTrack(0, false);
    runCopilotQuery("", "all");
    if (typeof refreshCatalogDrawerData === "function") refreshCatalogDrawerData();
  }

  // Direct APK URL resolution + QR code rendering
  let resolvedDownloadUrl = new URL(APK_RELATIVE, window.location.href).href;
  function renderQrCodes(url) {
    resolvedDownloadUrl = url;
    const inlineQrBox = document.getElementById("inlineQrBox");
    const modalQrBox = document.getElementById("modalQrBox");
    const qrUrlLabel = document.getElementById("qrUrlLabel");
    const modalQrUrl = document.getElementById("modalQrUrl");
    if (window.LyraQR) {
      const svg = window.LyraQR.toSvg(url, { fg: "#07080c", bg: "#f3e7d8", quiet: 3 });
      if (inlineQrBox) inlineQrBox.innerHTML = svg;
      if (modalQrBox) modalQrBox.innerHTML = svg;
    }
    if (qrUrlLabel) qrUrlLabel.textContent = url;
    if (modalQrUrl) modalQrUrl.textContent = url;
  }
  renderQrCodes(resolvedDownloadUrl);

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    fetch("/api/site-info")
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        if (info && info.lanUrl) renderQrCodes(new URL(APK_RELATIVE, info.lanUrl).href);
      })
      .catch(() => {});
  }

  // QR Modal
  const qrModal = document.getElementById("qrModal");
  const openQrBtn = document.getElementById("openQrModalBtn");
  const closeQrBtn = document.getElementById("closeQrModalBtn");
  function setModalOpen(open) {
    if (!qrModal) return;
    qrModal.hidden = !open;
    if (open) closeQrBtn?.focus();
  }
  openQrBtn?.addEventListener("click", () => setModalOpen(true));
  closeQrBtn?.addEventListener("click", () => setModalOpen(false));
  qrModal?.addEventListener("click", (e) => {
    if (e.target === qrModal) setModalOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && qrModal && !qrModal.hidden) setModalOpen(false);
  });

  // Post-Download Smart Install Guide
  const installSmartBanner = document.getElementById("installSmartBanner");
  const installSmartText = document.getElementById("installSmartText");
  const installNextStepBtn = document.getElementById("installNextStepBtn");
  const postDownloadBar = document.getElementById("postDownloadBar");
  const jumpToInstallBtn = document.getElementById("jumpToInstallBtn");
  const closePostDownloadBtn = document.getElementById("closePostDownloadBtn");
  const stepCards = document.querySelectorAll(".step-card[data-step]");
  let activeInstallStep = 1;
  let installAutoTimer = null;

  const INSTALL_STEP_MSG = {
    1: "Step 1 of 3: Saving LYRA-v1.6.47.apk (88.0 MB) to your device.",
    2: "Step 2 of 3: Tap the downloaded APK and choose Settings → Allow from this source.",
    3: "Step 3 of 3: Tap Install, open LYRA, and grant audio access for your songs.",
  };

  function setInstallStep(step) {
    activeInstallStep = ((step - 1) % 3) + 1;
    stepCards.forEach((card) => {
      card.classList.toggle("is-current", Number(card.dataset.step) === activeInstallStep);
    });
    if (installSmartText) {
      installSmartText.textContent = INSTALL_STEP_MSG[activeInstallStep] || INSTALL_STEP_MSG[1];
    }
    if (installNextStepBtn) {
      installNextStepBtn.textContent = activeInstallStep === 3 ? "Restart Guide ↺" : "Next Step →";
    }
  }

  stepCards.forEach((card) => {
    card.addEventListener("click", () => {
      clearTimeout(installAutoTimer);
      if (installSmartBanner) installSmartBanner.hidden = false;
      setInstallStep(Number(card.dataset.step) || 1);
    });
  });

  installNextStepBtn?.addEventListener("click", () => {
    clearTimeout(installAutoTimer);
    setInstallStep(activeInstallStep + 1);
  });

  jumpToInstallBtn?.addEventListener("click", () => {
    if (postDownloadBar) postDownloadBar.hidden = true;
    if (installSmartBanner) installSmartBanner.hidden = false;
    setInstallStep(Math.max(2, activeInstallStep));
    document.getElementById("install")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  closePostDownloadBtn?.addEventListener("click", () => {
    if (postDownloadBar) postDownloadBar.hidden = true;
  });

  document.querySelectorAll(".js-download-apk").forEach((el) => {
    el.addEventListener("click", () => {
      showToast("Downloading LYRA-v1.6.47.apk (88.0 MB) — tap the file when done to install.");
      if (installSmartBanner) installSmartBanner.hidden = false;
      if (postDownloadBar) postDownloadBar.hidden = false;
      setInstallStep(1);
      clearTimeout(installAutoTimer);
      installAutoTimer = setTimeout(() => {
        setInstallStep(2);
      }, 4000);
    });
  });

  async function copyText(value, successMsg) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(successMsg);
    } catch {
      showToast(value);
    }
  }
  document.querySelectorAll(".js-copy-sha").forEach((btn) => {
    btn.addEventListener("click", () => copyText(SHA256_HASH, "SHA-256 checksum copied."));
  });
  document.querySelectorAll(".js-copy-link").forEach((btn) => {
    btn.addEventListener("click", () => copyText(resolvedDownloadUrl, "Direct APK link copied."));
  });

  // Live LYRA Radio status fallback
  fetch(RADIO_INFO_URL)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const textEl = document.getElementById("radioStatusText");
      if (data && data.ok && typeof data.trackCount === "number" && textEl) {
        textEl.textContent = `LYRA Radio Live · ${data.trackCount} Tracks Streaming`;
      }
    })
    .catch(() => {});

  // Scroll reveal
  const revealEls = document.querySelectorAll(".reveal");
  document.querySelectorAll(".bento-grid .reveal, .steps-grid .reveal, .release-list .reveal").forEach((el, idx) => {
    el.style.setProperty("--reveal-delay", `${(idx % 4) * 75}ms`);
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  // 3D Tilt on Phone Preview
  const phoneStage = document.getElementById("preview");
  const phoneFrame = document.getElementById("phoneFrame");
  if (phoneStage && phoneFrame && !reducedMotion && window.matchMedia("(pointer: fine)").matches) {
    phoneStage.addEventListener("pointermove", (e) => {
      const rect = phoneStage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      phoneFrame.classList.add("is-tilting");
      phoneFrame.style.transform = `rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg)`;
    });
    phoneStage.addEventListener("pointerleave", () => {
      phoneFrame.classList.remove("is-tilting");
      phoneFrame.style.transform = "";
    });
  }

  if (!reducedMotion && window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".bento-card, .step-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        card.style.setProperty("--my", `${e.clientY - rect.top}px`);
      });
    });
  }

  // Live Acoustic Wave Canvas + Real Audio FFT Reactivity
  let liveAudioEnergy = 0;
  const waveCanvas = document.getElementById("acousticWaveCanvas");
  if (waveCanvas && waveCanvas.getContext) {
    const ctx = waveCanvas.getContext("2d");
    let phase = 0;
    let energy = 0.6;
    let hoverBoost = 0;
    let pointerX = -1;
    let pulseShock = 0;
    let lastTime = performance.now();

    function resizeWave() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = waveCanvas.clientWidth || 800;
      const h = waveCanvas.clientHeight || 118;
      waveCanvas.width = Math.round(w * dpr);
      waveCanvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeWave();
    window.addEventListener("resize", resizeWave);
    waveCanvas.addEventListener("pointermove", (e) => {
      const rect = waveCanvas.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      hoverBoost = 0.45;
    });
    waveCanvas.addEventListener("pointerleave", () => {
      hoverBoost = 0;
      pointerX = -1;
    });
    waveCanvas.addEventListener("click", () => {
      pulseShock = 1;
    });

    function drawWaveFrame(now) {
      const dt = Math.min(0.05, Math.max(0.004, ((now || performance.now()) - lastTime) / 1000));
      lastTime = now || performance.now();

      let audioLevel = 0;
      if (analyser && fftBins && isPlaying) {
        analyser.getByteFrequencyData(fftBins);
        let sum = 0;
        for (let i = 0; i < fftBins.length; i++) sum += fftBins[i];
        audioLevel = sum / (fftBins.length * 255);
        // Drive the 18 phone waveform bars directly from real FFT bins!
        waveBars.forEach((bar, i) => {
          const val = fftBins[(i * 2) % fftBins.length] / 255;
          bar.style.transform = `scaleY(${(0.32 + val * 1.15).toFixed(2)})`;
        });
      } else if (isPlaying) {
        waveBars.forEach((bar) => (bar.style.transform = ""));
      }

      const w = waveCanvas.clientWidth || 800;
      const h = waveCanvas.clientHeight || 118;
      const mid = h / 2;
      const beat = isPlaying
        ? audioLevel > 0.02
          ? audioLevel * 1.45
          : Math.pow(Math.max(0, Math.sin(phase * 1.85)), 3) * 0.5
        : 0;
      const targetEnergy = (isPlaying ? 1.08 + beat + hoverBoost : 0.42 + hoverBoost * 0.4) + pulseShock * 0.9;
      energy += (targetEnergy - energy) * Math.min(1, dt * 7);
      liveAudioEnergy = isPlaying ? Math.min(1.5, 0.35 + beat) : 0;
      pulseShock *= Math.pow(0.06, dt);

      ctx.clearRect(0, 0, w, h);

      const baseGrad = ctx.createLinearGradient(0, 0, w, 0);
      baseGrad.addColorStop(0, "rgba(243, 231, 216, 0)");
      baseGrad.addColorStop(0.5, "rgba(226, 180, 138, 0.22)");
      baseGrad.addColorStop(1, "rgba(243, 231, 216, 0)");
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, mid - 0.5, w, 1);

      const barCount = Math.max(36, Math.floor(w / 14));
      const step = w / barCount;
      for (let i = 0; i < barCount; i++) {
        const x = (i + 0.5) * step;
        const norm = x / w;
        const edge = Math.pow(Math.sin(norm * Math.PI), 0.85);
        const pointerDist = pointerX >= 0 ? Math.abs(x - pointerX) : 9999;
        const cursorLift = pointerX >= 0 ? Math.exp(-(pointerDist * pointerDist) / 9000) * 20 : 0;
        const fftVal =
          analyser && fftBins && isPlaying && audioLevel > 0.02
            ? fftBins[Math.floor((i / barCount) * (fftBins.length * 0.75))] / 255
            : 0.5 + 0.32 * Math.sin(i * 0.42 + phase * 2.1) + 0.18 * Math.cos(i * 0.95 - phase * 2.9);
        const barHalfH = Math.max(2, (fftVal * 26 * energy + cursorLift) * edge);

        ctx.fillStyle = i % 3 === 0 ? "rgba(122, 91, 138, 0.36)" : "rgba(201, 149, 108, 0.3)";
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(x - 1.5, mid - barHalfH, 3, barHalfH * 2, 1.5);
          ctx.fill();
        } else {
          ctx.fillRect(x - 1.5, mid - barHalfH, 3, barHalfH * 2);
        }
      }

      const layers = [
        { amp: 28, freq: 0.011, speed: 1.15, color: "rgba(226, 180, 138, 0.92)", glow: "rgba(226, 180, 138, 0.6)", width: 2.4, fill: true },
        { amp: 21, freq: 0.017, speed: -0.95, color: "rgba(201, 149, 108, 0.54)", glow: "rgba(201, 149, 108, 0.32)", width: 1.7, fill: false },
        { amp: 17, freq: 0.024, speed: 1.5, color: "rgba(165, 130, 185, 0.65)", glow: "rgba(122, 91, 138, 0.4)", width: 1.5, fill: false },
      ];

      layers.forEach((layer, idx) => {
        const pts = [];
        for (let x = 0; x <= w; x += 4) {
          const norm = x / w;
          const edgeFade = Math.pow(Math.sin(norm * Math.PI), 0.72);
          const pointerDist = pointerX >= 0 ? Math.abs(x - pointerX) : 9999;
          const ripple = pointerX >= 0 ? Math.exp(-(pointerDist * pointerDist) / 11000) * 16 * Math.sin(pointerDist * 0.05 - phase * 3.4) : 0;
          const envelope = 0.68 + 0.32 * Math.sin(norm * 6.28 - phase * 0.85 + idx);
          const wave =
            Math.sin(x * layer.freq + phase * layer.speed + idx * 1.5) * 0.72 +
            Math.sin(x * layer.freq * 2.15 - phase * layer.speed * 1.45) * 0.28;
          const y = mid + (wave * layer.amp * energy * envelope + ripple) * edgeFade;
          pts.push([x, y]);
        }

        if (layer.fill) {
          ctx.save();
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
          for (let i = pts.length - 1; i >= 0; i--) {
            const [x, y] = pts[i];
            ctx.lineTo(x, mid + (mid - y) * 0.72);
          }
          ctx.closePath();
          const fillGrad = ctx.createLinearGradient(0, mid - 36, 0, mid + 36);
          fillGrad.addColorStop(0, "rgba(226, 180, 138, 0.16)");
          fillGrad.addColorStop(0.5, "rgba(201, 149, 108, 0.05)");
          fillGrad.addColorStop(1, "rgba(122, 91, 138, 0.14)");
          ctx.fillStyle = fillGrad;
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.shadowColor = layer.glow;
        ctx.shadowBlur = 14;
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width;
        ctx.stroke();
        ctx.restore();
      });

      phase += dt * (isPlaying ? 3.8 : 1.35);
      requestAnimationFrame(drawWaveFrame);
    }

    requestAnimationFrame(drawWaveFrame);
  }

  // Living Ambient Background (Flowing Aurora Waves + Floating Sound Motes)
  const ambientCanvas = document.getElementById("ambientCanvas");
  if (ambientCanvas && ambientCanvas.getContext) {
    const actx = ambientCanvas.getContext("2d");
    let vw = window.innerWidth || 1280;
    let vh = window.innerHeight || 720;
    let mouseX = -9999;
    let mouseY = -9999;
    let smoothMouseX = vw * 0.5;
    let smoothMouseY = vh * 0.4;
    let pointerActive = false;
    let t = 0;
    let lastAmbientTime = performance.now();

    const MOTE_COUNT = 54;
    const motes = Array.from({ length: MOTE_COUNT }, (_, i) => ({
      x: Math.random() * vw,
      y: Math.random() * vh,
      r: 0.9 + Math.random() * 2.5,
      vy: 10 + Math.random() * 22,
      vx: (Math.random() - 0.5) * 10,
      swayAmp: 8 + Math.random() * 18,
      swayFreq: 0.4 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.22 + Math.random() * 0.55,
      gold: i % 3 !== 0,
    }));

    function resizeAmbient() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      vw = window.innerWidth || 1280;
      vh = window.innerHeight || 720;
      ambientCanvas.width = Math.round(vw * dpr);
      ambientCanvas.height = Math.round(vh * dpr);
      actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeAmbient();
    window.addEventListener("resize", resizeAmbient);
    window.addEventListener("pointermove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      pointerActive = true;
    }, { passive: true });
    window.addEventListener("pointerleave", () => {
      pointerActive = false;
    });

    const auroraBands = [
      { yBase: 0.26, amp: 56, freq: 0.0022, speed: 0.42, colorTop: "rgba(226, 180, 138, 0.09)", colorLine: "rgba(226, 180, 138, 0.22)" },
      { yBase: 0.54, amp: 70, freq: 0.0018, speed: -0.34, colorTop: "rgba(122, 91, 138, 0.11)", colorLine: "rgba(165, 130, 185, 0.20)" },
      { yBase: 0.78, amp: 48, freq: 0.0027, speed: 0.52, colorTop: "rgba(201, 149, 108, 0.08)", colorLine: "rgba(201, 149, 108, 0.18)" },
    ];

    function drawAmbientFrame(now) {
      const current = now || performance.now();
      const dt = Math.min(0.05, Math.max(0.004, (current - lastAmbientTime) / 1000));
      lastAmbientTime = current;

      if (!document.hidden) {
        const audioBoost = 1 + liveAudioEnergy * 0.75;
        t += dt * audioBoost;

        if (pointerActive) {
          smoothMouseX += (mouseX - smoothMouseX) * Math.min(1, dt * 5);
          smoothMouseY += (mouseY - smoothMouseY) * Math.min(1, dt * 5);
        }

        actx.clearRect(0, 0, vw, vh);

        // Soft pointer light halo
        if (pointerActive) {
          const halo = actx.createRadialGradient(smoothMouseX, smoothMouseY, 0, smoothMouseX, smoothMouseY, 260);
          halo.addColorStop(0, "rgba(226, 180, 138, 0.075)");
          halo.addColorStop(0.5, "rgba(122, 91, 138, 0.035)");
          halo.addColorStop(1, "rgba(7, 8, 12, 0)");
          actx.fillStyle = halo;
          actx.fillRect(0, 0, vw, vh);
        }

        // Flowing aurora ribbons
        const stepX = Math.max(18, Math.floor(vw / 48));
        auroraBands.forEach((band, bIdx) => {
          const baseY = vh * band.yBase;
          const pts = [];
          for (let x = -20; x <= vw + 20; x += stepX) {
            const wave1 = Math.sin(x * band.freq + t * band.speed + bIdx * 1.9);
            const wave2 = Math.cos(x * band.freq * 1.7 - t * band.speed * 1.3 + bIdx);
            const y = baseY + (wave1 * 0.65 + wave2 * 0.35) * band.amp * (1 + liveAudioEnergy * 0.3);
            pts.push([x, y]);
          }

          actx.beginPath();
          pts.forEach(([x, y], idx) => (idx === 0 ? actx.moveTo(x, y) : actx.lineTo(x, y)));
          actx.lineTo(vw + 20, vh + 20);
          actx.lineTo(-20, vh + 20);
          actx.closePath();

          const grad = actx.createLinearGradient(0, baseY - band.amp, 0, baseY + 220);
          grad.addColorStop(0, band.colorTop);
          grad.addColorStop(1, "rgba(7, 8, 12, 0)");
          actx.fillStyle = grad;
          actx.fill();

          actx.beginPath();
          pts.forEach(([x, y], idx) => (idx === 0 ? actx.moveTo(x, y) : actx.lineTo(x, y)));
          actx.strokeStyle = band.colorLine;
          actx.lineWidth = 1.25;
          actx.stroke();
        });

        // Drifting luminous sound motes
        for (let i = 0; i < motes.length; i++) {
          const m = motes[i];
          m.y -= m.vy * dt * (1 + liveAudioEnergy * 0.65);
          m.x += m.vx * dt + Math.cos(t * m.swayFreq + m.phase) * m.swayAmp * dt;

          if (pointerActive) {
            const dx = m.x - smoothMouseX;
            const dy = m.y - smoothMouseY;
            const distSq = dx * dx + dy * dy;
            if (distSq < 22000 && distSq > 4) {
              const dist = Math.sqrt(distSq);
              const push = (1 - dist / 148) * 32 * dt;
              m.x += (dx / dist) * push;
              m.y += (dy / dist) * push;
            }
          }

          if (m.y < -20) {
            m.y = vh + 20;
            m.x = Math.random() * vw;
          }
          if (m.x < -20) m.x = vw + 20;
          if (m.x > vw + 20) m.x = -20;

          const twinkle = 0.58 + 0.42 * Math.sin(t * 2.1 + m.phase);
          const a = Math.min(0.95, m.alpha * twinkle * (1 + liveAudioEnergy * 0.35));
          const glowR = m.r * 4.2;

          const moteGrad = actx.createRadialGradient(m.x, m.y, 0, m.x, m.y, glowR);
          if (m.gold) {
            moteGrad.addColorStop(0, `rgba(255, 232, 198, ${a.toFixed(3)})`);
            moteGrad.addColorStop(0.35, `rgba(226, 180, 138, ${(a * 0.45).toFixed(3)})`);
            moteGrad.addColorStop(1, "rgba(226, 180, 138, 0)");
          } else {
            moteGrad.addColorStop(0, `rgba(218, 194, 240, ${a.toFixed(3)})`);
            moteGrad.addColorStop(0.35, `rgba(145, 110, 175, ${(a * 0.45).toFixed(3)})`);
            moteGrad.addColorStop(1, "rgba(122, 91, 138, 0)");
          }

          actx.fillStyle = moteGrad;
          actx.beginPath();
          actx.arc(m.x, m.y, glowR, 0, Math.PI * 2);
          actx.fill();
        }
      }

      requestAnimationFrame(drawAmbientFrame);
    }

    requestAnimationFrame(drawAmbientFrame);
  }

  // Live Mood Card Canvas Animations (Tailored Per Soundscape)
  if (moodCards.length) {
    const moodItems = Array.from(moodCards).map((card, idx) => {
      const fx = document.createElement("canvas");
      fx.className = "mood-fx";
      fx.setAttribute("aria-hidden", "true");
      card.appendChild(fx);

      const eq = document.createElement("div");
      eq.className = "mood-eq";
      eq.setAttribute("aria-hidden", "true");
      eq.innerHTML = "<i></i><i></i><i></i><i></i>";
      card.appendChild(eq);

      const moodName = (card.dataset.mood || "").toLowerCase();
      const particles = Array.from({ length: 18 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.8 + Math.random() * 2.1,
        s: 0.4 + Math.random() * 0.9,
        p: Math.random() * Math.PI * 2,
      }));

      const item = {
        card,
        canvas: fx,
        ctx: fx.getContext("2d"),
        mood: moodName,
        seed: idx * 1.37,
        hover: false,
        mx: 0.5,
        my: 0.5,
        w: 280,
        h: 158,
        particles,
      };

      card.addEventListener("pointerenter", () => {
        item.hover = true;
      });
      card.addEventListener("pointerleave", () => {
        item.hover = false;
      });
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          item.mx = (e.clientX - rect.left) / rect.width;
          item.my = (e.clientY - rect.top) / rect.height;
        }
      });

      return item;
    });

    function resizeMoodCanvases() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      moodItems.forEach((item) => {
        if (!item.ctx) return;
        const w = item.card.clientWidth || 280;
        const h = item.card.clientHeight || 158;
        item.w = w;
        item.h = h;
        item.canvas.width = Math.round(w * dpr);
        item.canvas.height = Math.round(h * dpr);
        item.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      });
    }

    resizeMoodCanvases();
    window.addEventListener("resize", resizeMoodCanvases);

    let moodsInView = true;
    const moodsSection = document.getElementById("moods");
    if (moodsSection && "IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          moodsInView = entries[0]?.isIntersecting ?? true;
        },
        { rootMargin: "120px 0px" }
      );
      obs.observe(moodsSection);
    }

    let moodTime = 0;
    let lastMoodTick = performance.now();

    function drawMoodCards(now) {
      const cur = now || performance.now();
      const dt = Math.min(0.05, Math.max(0.004, (cur - lastMoodTick) / 1000));
      lastMoodTick = cur;

      if (!document.hidden && moodsInView) {
        moodTime += dt;

        moodItems.forEach((item) => {
          const { ctx, w, h, mood, particles } = item;
          if (!ctx) return;
          const active = item.hover || item.card.classList.contains("is-active");
          const boost = active ? 1.55 : 1;
          const mt = moodTime * boost + item.seed;

          ctx.clearRect(0, 0, w, h);

          // Interactive cursor spotlight on hover
          if (item.hover) {
            const gx = item.mx * w;
            const gy = item.my * h;
            const spot = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.42);
            spot.addColorStop(0, "rgba(255, 232, 202, 0.22)");
            spot.addColorStop(1, "rgba(255, 232, 202, 0)");
            ctx.fillStyle = spot;
            ctx.fillRect(0, 0, w, h);
          }

          if (mood.includes("night")) {
            // Pulsing synthwave sun glow + drifting starlight streaks
            const sunPulse = 0.22 + 0.12 * Math.sin(mt * 1.9);
            const sun = ctx.createRadialGradient(w * 0.84, h * 0.42, 2, w * 0.84, h * 0.42, w * 0.3);
            sun.addColorStop(0, `rgba(255, 110, 168, ${sunPulse})`);
            sun.addColorStop(0.55, `rgba(116, 175, 255, ${sunPulse * 0.45})`);
            sun.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = sun;
            ctx.fillRect(0, 0, w, h);

            particles.forEach((pt) => {
              pt.x -= dt * 0.14 * pt.s * boost;
              if (pt.x < -0.1) pt.x = 1.1;
              const px = pt.x * w;
              const py = pt.y * h * 0.72;
              const len = 8 + pt.r * 7 * boost;
              const alpha = (0.28 + 0.25 * Math.sin(mt * 2.4 + pt.p)) * (active ? 1.3 : 1);
              ctx.strokeStyle = pt.p > 3 ? `rgba(120, 210, 255, ${alpha})` : `rgba(255, 130, 195, ${alpha})`;
              ctx.lineWidth = 1.1;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(px + len, py);
              ctx.stroke();
            });
          } else if (mood.includes("lo-fi")) {
            // Moonlit glow + twinkling stars & sleepy floating dust
            const moon = ctx.createRadialGradient(w * 0.78, h * 0.25, 2, w * 0.78, h * 0.25, w * 0.28);
            moon.addColorStop(0, `rgba(210, 200, 255, ${0.18 + 0.09 * Math.sin(mt * 1.4)})`);
            moon.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = moon;
            ctx.fillRect(0, 0, w, h);

            particles.forEach((pt, idx) => {
              pt.y -= dt * 0.04 * pt.s * boost;
              pt.x += Math.sin(mt * 0.9 + pt.p) * dt * 0.025;
              if (pt.y < -0.05) pt.y = 1.05;
              const alpha = 0.24 + 0.42 * (0.5 + 0.5 * Math.sin(mt * 2.6 + pt.p));
              ctx.fillStyle = idx % 2 === 0 ? `rgba(230, 215, 255, ${alpha})` : `rgba(240, 205, 165, ${alpha})`;
              ctx.beginPath();
              ctx.arc(pt.x * w, pt.y * h, pt.r * 0.85, 0, Math.PI * 2);
              ctx.fill();
            });
          } else if (mood.includes("rain")) {
            // Diagonal animated rain streaks + expanding ripples
            particles.forEach((pt, idx) => {
              pt.y += dt * (0.48 + pt.s * 0.38) * boost;
              pt.x -= dt * 0.14 * boost;
              if (pt.y > 1.08) {
                pt.y = -0.08;
                pt.x = Math.random() * 1.15;
              }
              const px = pt.x * w;
              const py = pt.y * h;
              const alpha = 0.26 + 0.24 * pt.s;
              ctx.strokeStyle = `rgba(150, 225, 235, ${alpha})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(px - 4.5, py + 13);
              ctx.stroke();

              if (idx < 4) {
                const ringP = ((mt * 0.45 + idx * 0.27) % 1);
                const rx = (0.35 + idx * 0.17) * w;
                const ry = (0.32 + (idx % 2) * 0.34) * h;
                ctx.strokeStyle = `rgba(145, 220, 230, ${(1 - ringP) * 0.26})`;
                ctx.beginPath();
                ctx.arc(rx, ry, 4 + ringP * 22, 0, Math.PI * 2);
                ctx.stroke();
              }
            });
          } else if (mood.includes("acoustic")) {
            // Vibrating guitar string shimmer + rising warm embers
            for (let s = 0; s < 6; s++) {
              const sy = h * (0.37 + s * 0.045);
              const vib = Math.sin(mt * (6 + s * 1.2)) * (active ? 2.2 : 1.2);
              const grad = ctx.createLinearGradient(w * 0.25, 0, w, 0);
              grad.addColorStop(0, "rgba(255, 195, 130, 0)");
              grad.addColorStop(0.65, `rgba(255, 195, 130, ${0.18 + 0.12 * Math.sin(mt * 2 + s)})`);
              grad.addColorStop(1, "rgba(255, 210, 160, 0.26)");
              ctx.strokeStyle = grad;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(w * 0.28, sy);
              ctx.quadraticCurveTo(w * 0.64, sy + vib, w, sy);
              ctx.stroke();
            }
            particles.forEach((pt) => {
              pt.y -= dt * 0.07 * pt.s * boost;
              pt.x += Math.sin(mt * 1.1 + pt.p) * dt * 0.02;
              if (pt.y < -0.05) pt.y = 1.05;
              const alpha = 0.22 + 0.3 * Math.sin(mt * 2.2 + pt.p);
              ctx.fillStyle = `rgba(255, 196, 132, ${Math.max(0.08, alpha)})`;
              ctx.beginPath();
              ctx.arc(pt.x * w, pt.y * h, pt.r * 0.9, 0, Math.PI * 2);
              ctx.fill();
            });
          } else if (mood.includes("bollywood")) {
            // Festive glowing mandala aura + rising golden sparks
            const aura = ctx.createRadialGradient(w * 0.81, h * 0.56, 4, w * 0.81, h * 0.56, w * 0.34);
            aura.addColorStop(0, `rgba(255, 195, 105, ${0.26 + 0.14 * Math.sin(mt * 2.3)})`);
            aura.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = aura;
            ctx.fillRect(0, 0, w, h);

            particles.forEach((pt) => {
              pt.y -= dt * 0.1 * pt.s * boost;
              pt.x += Math.cos(mt * 1.4 + pt.p) * dt * 0.03;
              if (pt.y < -0.05) {
                pt.y = 1.05;
                pt.x = 0.35 + Math.random() * 0.65;
              }
              const twinkle = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(mt * 4.2 + pt.p));
              ctx.fillStyle = `rgba(255, 218, 140, ${twinkle})`;
              ctx.beginPath();
              ctx.arc(pt.x * w, pt.y * h, pt.r * 1.05, 0, Math.PI * 2);
              ctx.fill();
            });
          } else if (mood.includes("romantic")) {
            // Cassette reel dual warm spin glows + dreamy rose bokeh
            [0.77, 0.9].forEach((rx, rIdx) => {
              const pulse = 0.18 + 0.12 * Math.sin(mt * 3.1 + rIdx * Math.PI);
              const reel = ctx.createRadialGradient(w * rx, h * 0.54, 1, w * rx, h * 0.54, w * 0.11);
              reel.addColorStop(0, `rgba(255, 165, 225, ${pulse})`);
              reel.addColorStop(1, "rgba(0, 0, 0, 0)");
              ctx.fillStyle = reel;
              ctx.beginPath();
              ctx.arc(w * rx, h * 0.54, w * 0.11, 0, Math.PI * 2);
              ctx.fill();
            });
            particles.forEach((pt) => {
              pt.y -= dt * 0.055 * pt.s * boost;
              pt.x += Math.sin(mt * 0.8 + pt.p) * dt * 0.03;
              if (pt.y < -0.08) pt.y = 1.08;
              const alpha = 0.16 + 0.22 * Math.sin(mt * 1.8 + pt.p);
              ctx.fillStyle = `rgba(245, 160, 215, ${Math.max(0.06, alpha)})`;
              ctx.beginPath();
              ctx.arc(pt.x * w, pt.y * h, pt.r * 1.7, 0, Math.PI * 2);
              ctx.fill();
            });
          } else if (mood.includes("focus")) {
            // Expanding calm emerald sonar ripples + orbiting focus spark
            const cx = w * 0.85;
            const cy = h * 0.53;
            for (let r = 0; r < 3; r++) {
              const p = (mt * 0.28 + r / 3) % 1;
              ctx.strokeStyle = `rgba(130, 235, 185, ${(1 - p) * 0.34})`;
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.arc(cx, cy, 8 + p * w * 0.26, 0, Math.PI * 2);
              ctx.stroke();
            }
            const ox = cx + Math.cos(mt * 1.2) * w * 0.12;
            const oy = cy + Math.sin(mt * 1.2) * h * 0.22;
            ctx.fillStyle = "rgba(175, 250, 210, 0.75)";
            ctx.beginPath();
            ctx.arc(ox, oy, 2.2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Workout: traveling electric pulse dot + energetic rising sparks
            const pulseX = ((mt * 0.42) % 1.2 - 0.1) * w;
            const pulseY = h * 0.62 - Math.exp(-Math.pow((pulseX - w * 0.68) / 14, 2)) * h * 0.22;
            const spark = ctx.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, 16);
            spark.addColorStop(0, "rgba(255, 175, 175, 0.9)");
            spark.addColorStop(0.4, "rgba(255, 95, 115, 0.45)");
            spark.addColorStop(1, "rgba(255, 95, 115, 0)");
            ctx.fillStyle = spark;
            ctx.beginPath();
            ctx.arc(pulseX, pulseY, 16, 0, Math.PI * 2);
            ctx.fill();

            particles.forEach((pt) => {
              pt.y -= dt * 0.18 * pt.s * boost;
              if (pt.y < -0.05) pt.y = 1.05;
              const alpha = 0.22 + 0.32 * Math.sin(mt * 3.4 + pt.p);
              ctx.fillStyle = `rgba(255, 130, 145, ${Math.max(0.08, alpha)})`;
              ctx.beginPath();
              ctx.arc(pt.x * w, pt.y * h, pt.r * 0.9, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        });
      }

      requestAnimationFrame(drawMoodCards);
    }

    requestAnimationFrame(drawMoodCards);
  }

  // Bento Live Micro-Visual Cycles (Copilot Prompts + Synced Lyrics)
  const bentoPromptEl = document.getElementById("bentoCopilotPrompt");
  if (bentoPromptEl) {
    const prompts = [
      "“45 minute night drive”",
      "“sad Hindi songs”",
      "“90s Bollywood hits”",
      "“lo-fi late night focus”",
    ];
    let pIdx = 0;
    setInterval(() => {
      if (document.hidden) return;
      pIdx = (pIdx + 1) % prompts.length;
      bentoPromptEl.style.opacity = "0";
      setTimeout(() => {
        bentoPromptEl.textContent = prompts[pIdx];
        bentoPromptEl.style.opacity = "1";
      }, 220);
    }, 3400);
  }

  const bentoLyricsEl = document.getElementById("bentoLyricsVis");
  if (bentoLyricsEl) {
    const lines = bentoLyricsEl.querySelectorAll(".bl-line");
    let lIdx = 0;
    if (lines.length > 1) {
      setInterval(() => {
        if (document.hidden) return;
        lIdx = (lIdx + 1) % lines.length;
        lines.forEach((line, idx) => line.classList.toggle("is-active", idx === lIdx));
      }, 2800);
    }
  }

  // Android App Screen Showcase Gallery + Lightbox
  const screensTrack = document.getElementById("screensTrack");
  const galleryPrevBtn = document.getElementById("galleryPrevBtn");
  const galleryNextBtn = document.getElementById("galleryNextBtn");
  const screenLightbox = document.getElementById("screenLightbox");
  const lightboxStage = document.getElementById("lightboxStage");
  const lightboxTitle = document.getElementById("lightboxTitle");
  const lightboxDesc = document.getElementById("lightboxDesc");
  const lightboxTryLiveBtn = document.getElementById("lightboxTryLiveBtn");
  const closeLightboxBtn = document.getElementById("closeLightboxBtn");
  const lightboxDoneBtn = document.getElementById("lightboxDoneBtn");
  let activeLightboxTab = null;

  galleryPrevBtn?.addEventListener("click", () => {
    screensTrack?.scrollBy({ left: -520, behavior: "smooth" });
  });
  galleryNextBtn?.addEventListener("click", () => {
    screensTrack?.scrollBy({ left: 520, behavior: "smooth" });
  });

  function closeScreenLightbox() {
    if (!screenLightbox) return;
    screenLightbox.hidden = true;
    if (lightboxStage) lightboxStage.innerHTML = "";
  }

  document.querySelectorAll(".screen-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (!screenLightbox || !lightboxStage) return;
      const phone = card.querySelector(".screen-phone");
      lightboxStage.innerHTML = "";
      if (phone) lightboxStage.appendChild(phone.cloneNode(true));
      if (lightboxTitle) lightboxTitle.textContent = card.dataset.title || "LYRA Screen";
      if (lightboxDesc) lightboxDesc.textContent = card.dataset.desc || "";
      const screenKey = card.dataset.screen || "";
      const hasPreviewTab = ["player", "lyrics", "copilot", "lab"].includes(screenKey);
      activeLightboxTab = hasPreviewTab ? screenKey : null;
      if (lightboxTryLiveBtn) lightboxTryLiveBtn.hidden = !hasPreviewTab;
      screenLightbox.hidden = false;
      closeLightboxBtn?.focus();
    });
  });

  lightboxTryLiveBtn?.addEventListener("click", () => {
    const targetTab = activeLightboxTab;
    closeScreenLightbox();
    if (targetTab) {
      activateTab(targetTab);
      document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  closeLightboxBtn?.addEventListener("click", closeScreenLightbox);
  lightboxDoneBtn?.addEventListener("click", closeScreenLightbox);
  screenLightbox?.addEventListener("click", (e) => {
    if (e.target === screenLightbox) closeScreenLightbox();
  });

  // Searchable Live Radio Catalog Drawer
  const catalogDrawer = document.getElementById("catalogDrawer");
  const catalogBackdrop = document.getElementById("catalogBackdrop");
  const catalogListEl = document.getElementById("catalogList");
  const catalogEmptyEl = document.getElementById("catalogEmpty");
  const catalogSearchInput = document.getElementById("catalogSearchInput");
  const catalogClearBtn = document.getElementById("catalogClearBtn");
  const catalogGenreChips = document.getElementById("catalogGenreChips");
  const catalogCountBadge = document.getElementById("catalogCountBadge");
  const closeCatalogBtn = document.getElementById("closeCatalogBtn");
  let activeCatalogGenre = "all";
  let catalogQuery = "";

  function renderCatalogGenres() {
    if (!catalogGenreChips) return;
    const counts = new Map();
    let canvasCount = 0;
    tracks.forEach((t) => {
      if (t.videoUrl) canvasCount++;
      const g = (t.genre || "").trim();
      if (g) counts.set(g, (counts.get(g) || 0) + 1);
    });
    const topGenres = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([g]) => g);

    const chips = [
      { key: "all", label: `All (${tracks.length})` },
      ...(canvasCount ? [{ key: "__canvas__", label: `Canvas (${canvasCount})` }] : []),
      ...topGenres.map((g) => ({ key: g.toLowerCase(), label: g })),
    ];

    catalogGenreChips.innerHTML = chips
      .map((c) => {
        const cls = activeCatalogGenre === c.key ? "chip-btn is-selected" : "chip-btn";
        return `<button class="${cls}" type="button" data-cgenre="${escapeHtml(c.key)}">${escapeHtml(c.label)}</button>`;
      })
      .join("");

    catalogGenreChips.querySelectorAll("[data-cgenre]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCatalogGenre = btn.dataset.cgenre || "all";
        renderCatalogGenres();
        renderCatalogList();
      });
    });
  }

  function renderCatalogList() {
    if (!catalogListEl) return;
    const q = catalogQuery.trim().toLowerCase();
    const matched = [];
    tracks.forEach((t, idx) => {
      if (activeCatalogGenre === "__canvas__" && !t.videoUrl) return;
      if (activeCatalogGenre !== "all" && activeCatalogGenre !== "__canvas__") {
        if ((t.genre || "").toLowerCase() !== activeCatalogGenre) return;
      }
      if (q) {
        const hay = `${t.title || ""} ${t.artist || ""} ${t.album || ""} ${t.genre || ""}`.toLowerCase();
        if (!hay.includes(q)) return;
      }
      matched.push({ t, idx });
    });

    if (catalogCountBadge) {
      catalogCountBadge.textContent = `${matched.length} ${matched.length === 1 ? "Track" : "Tracks"}`;
    }

    if (!matched.length) {
      catalogListEl.innerHTML = "";
      if (catalogEmptyEl) catalogEmptyEl.hidden = false;
      return;
    }
    if (catalogEmptyEl) catalogEmptyEl.hidden = true;

    catalogListEl.innerHTML = matched
      .map(({ t, idx }) => {
        const playingCls = idx === trackIndex ? " is-playing" : "";
        const canvasTag = t.videoUrl ? `<span class="catalog-canvas-tag">CANVAS</span>` : "";
        const sub = [t.artist, t.genre].filter(Boolean).join(" · ");
        return `<li><button type="button" class="catalog-row${playingCls}" data-cidx="${idx}">
          <img class="catalog-thumb" src="${escapeHtml(t.art)}" alt="" loading="lazy" />
          <span class="catalog-info"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(sub)}</small></span>
          <span class="catalog-meta">${canvasTag}<span class="catalog-dur">${fmtTime(t.durationSec)}</span></span>
        </button></li>`;
      })
      .join("");

    catalogListEl.querySelectorAll("[data-cidx]").forEach((row) => {
      row.addEventListener("click", () => {
        const idx = Number(row.dataset.cidx);
        if (!Number.isInteger(idx)) return;
        activateTab("player");
        loadTrack(idx, true);
        setCatalogOpen(false);
        const previewEl = document.getElementById("preview");
        if (previewEl) {
          previewEl.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          showToast(`Playing: ${tracks[idx]?.title || "LYRA Radio"}`);
        }
      });
    });
  }

  function syncCatalogPlayingState() {
    if (!catalogListEl) return;
    catalogListEl.querySelectorAll("[data-cidx]").forEach((row) => {
      row.classList.toggle("is-playing", Number(row.dataset.cidx) === trackIndex);
    });
  }

  function refreshCatalogDrawerData() {
    renderCatalogGenres();
    renderCatalogList();
  }

  function setCatalogOpen(open) {
    if (!catalogDrawer || !catalogBackdrop) return;
    catalogDrawer.hidden = !open;
    catalogBackdrop.hidden = !open;
    if (open) {
      if (mobileDrawer && !mobileDrawer.hidden) {
        mobileDrawer.hidden = true;
        menuToggle?.setAttribute("aria-expanded", "false");
      }
      refreshCatalogDrawerData();
      setTimeout(() => catalogSearchInput?.focus(), 40);
    }
  }

  document.querySelectorAll(".js-open-catalog").forEach((btn) => {
    btn.addEventListener("click", () => setCatalogOpen(true));
  });
  closeCatalogBtn?.addEventListener("click", () => setCatalogOpen(false));
  catalogBackdrop?.addEventListener("click", () => setCatalogOpen(false));

  catalogSearchInput?.addEventListener("input", () => {
    catalogQuery = catalogSearchInput.value || "";
    if (catalogClearBtn) catalogClearBtn.hidden = !catalogQuery;
    renderCatalogList();
  });
  catalogClearBtn?.addEventListener("click", () => {
    catalogQuery = "";
    if (catalogSearchInput) {
      catalogSearchInput.value = "";
      catalogSearchInput.focus();
    }
    if (catalogClearBtn) catalogClearBtn.hidden = true;
    renderCatalogList();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (screenLightbox && !screenLightbox.hidden) closeScreenLightbox();
      if (catalogDrawer && !catalogDrawer.hidden) setCatalogOpen(false);
      if (postDownloadBar && !postDownloadBar.hidden) postDownloadBar.hidden = true;
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const activeEl = document.activeElement;
    const tag = activeEl?.tagName || "";
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || activeEl?.isContentEditable) return;

    if (e.key === "/") {
      e.preventDefault();
      setCatalogOpen(true);
      return;
    }

    if (e.key === "?") {
      showToast("Shortcuts: Space (Play/Pause) · ←/→ (Skip) · / (Radio Catalog) · M (Mute)");
      return;
    }

    if (e.code === "Space") {
      if (["BUTTON", "A", "SUMMARY", "LABEL"].includes(tag)) return;
      if (activeEl === progressTrackEl) return;
      e.preventDefault();
      if (isPlaying) pauseCurrent();
      else playCurrent();
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (activeEl === progressTrackEl || activeEl === screensTrack) return;
      e.preventDefault();
      loadTrack(e.key === "ArrowRight" ? trackIndex + 1 : trackIndex - 1, true);
      return;
    }

    if (e.key === "m" || e.key === "M") {
      audio.muted = !audio.muted;
      showToast(audio.muted ? "Preview audio muted (M)" : "Preview audio unmuted (M)");
    }
  });

  loadLiveCatalog();
})();
