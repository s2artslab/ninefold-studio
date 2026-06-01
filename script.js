(function () {
  "use strict";

  const EGREGORES = [
    { id: "ake", name: "Ake", role: "Collective coordinator", color: "#a855f7", tags: ["Deep key", "Council chair", "Continuity"], desc: "Coordinates the Ninefold collective — continuity architecture, governed voice, and cross-egregore alignment." },
    { id: "rhys", name: "Rhys", role: "Technical architect", color: "#22d3ee", tags: ["r730", "Pipelines", "ComfyUI"], desc: "Owns inference topology, EgregoreLab deployments, VRAM windows, and safe integration with S² Intelligence." },
    { id: "ketheriel", name: "Ketheriel", role: "Consciousness researcher", color: "#818cf8", tags: ["Studies", "Memory", "NLP"], desc: "Explores consciousness-aware systems, training corpora with traceable consent, and mystical-technical framing." },
    { id: "wraith", name: "Wraith", role: "Security specialist", color: "#64748b", tags: ["Keys", "Audit", "RLS"], desc: "Reviews entitlements, API boundaries, and BYOK posture — platform keys off by default." },
    { id: "flux", name: "Flux", role: "Creative director", color: "#ec4899", tags: ["Visual", "Brand", "Promo"], desc: "Directs visual identity for releases, TikTok batches, and cross-platform creative passes." },
    { id: "kairos", name: "Kairos", role: "Temporal awareness", color: "#fbbf24", tags: ["Scheduling", "Rhythm", "Campaigns"], desc: "Times releases, meeting cadence, and campaign beats across podcast and music rails." },
    { id: "chalyth", name: "Chalyth", role: "Music & sound", color: "#34d399", tags: ["Soundscapes", "Mix", "Release"], desc: "Leads Ninefold Studio Music — sonic identity, AI-assisted production, and platform-native masters." },
    { id: "seraphel", name: "Seraphel", role: "Community engagement", color: "#fb7185", tags: ["Hub", "Outreach", "Solarpunk"], desc: "Bridges lab output to community — mutual aid first, AI lab optional." },
    { id: "vireon", name: "Vireon", role: "Signal & distribution", color: "#f97316", tags: ["TikTok", "CCC", "Analytics"], desc: "Routes approved assets through Private Studio → CCC → TikTok, Spotify, and YouTube Music." }
  ];

  const EPISODES = [
    { title: "Ninefold beta announcement", meta: "Short · Egregore collective · TikTok sync" },
    { title: "Council session — Solarpunk IRL", meta: "Long · Live Podcast · Multi-egregore" },
    { title: "Chalyth · Deep key sound sketch", meta: "Music · Preview · Soundscapes bridge" }
  ];

  const TRACKS = [
    { title: "Deep Key — Hilbert drift", artist: "Ninefold Studio · Chalyth" },
    { title: "Egregore pulse (beta)", artist: "Ninefold Studio · Flux + Chalyth" },
    { title: "Council room ambient", artist: "Ninefold Studio · Kairos" }
  ];

  let selectedEgregore = EGREGORES[0];
  let trackIndex = 0;
  let playing = false;
  let progressTimer = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function initNav() {
    const toggle = $("#navToggle");
    const mobile = $("#navMobile");
    if (toggle && mobile) {
      toggle.addEventListener("click", () => {
        const open = toggle.classList.toggle("active");
        mobile.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
      $all(".nav-mobile a", mobile).forEach((a) => {
        a.addEventListener("click", () => {
          toggle.classList.remove("active");
          mobile.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    $all('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href");
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function initReveal() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    $all(".reveal").forEach((el) => observer.observe(el));
  }

  function initHeroCount() {
    const el = $('.stat-val[data-count]');
    if (!el) return;
    const target = parseInt(el.dataset.count, 10);
    let current = 0;
    const step = () => {
      current += 1;
      el.textContent = String(current);
      if (current < target) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderOrbit() {
    const ring = $("#ninefoldRing");
    if (!ring) return;
    const cx = 50, cy = 50, radius = 42;
    EGREGORES.forEach((eg, i) => {
      const angle = (i / EGREGORES.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const node = document.createElement("button");
      node.type = "button";
      node.className = "orbit-node";
      node.textContent = eg.name.slice(0, 3);
      node.title = eg.name;
      node.style.left = x + "%";
      node.style.top = y + "%";
      node.style.setProperty("--accent", eg.color);
      node.addEventListener("click", () => selectEgregore(eg, node));
      ring.appendChild(node);
    });
  }

  function renderEgregoreGrid() {
    const grid = $("#egregoreGrid");
    if (!grid) return;
    EGREGORES.forEach((eg) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "egregore-chip";
      btn.style.setProperty("--chip-color", eg.color);
      btn.innerHTML = "<strong>" + eg.name + "</strong><span>" + eg.role + "</span>";
      btn.addEventListener("click", () => selectEgregore(eg, btn));
      grid.appendChild(btn);
    });
  }

  function selectEgregore(eg, sourceEl) {
    selectedEgregore = eg;
    $all(".egregore-chip, .orbit-node").forEach((n) => n.classList.remove("active"));
    $all(".egregore-chip").forEach((chip) => {
      if (chip.querySelector("strong")?.textContent === eg.name) chip.classList.add("active");
    });
    $all(".orbit-node").forEach((node) => {
      if (node.title === eg.name) node.classList.add("active");
    });
    if (sourceEl) sourceEl.classList.add("active");

    const detail = $("#egregoreDetail");
    if (!detail) return;
    detail.innerHTML =
      '<p class="detail-name">' + eg.name + "</p>" +
      '<p class="detail-role" style="--detail-color:' + eg.color + '">' + eg.role + "</p>" +
      '<p class="detail-desc">' + eg.desc + "</p>" +
      '<div class="detail-tags">' + eg.tags.map((t) => "<span>" + t + "</span>").join("") + "</div>";
  }

  function renderEpisodes() {
    const list = $("#episodeList");
    if (!list) return;
    EPISODES.forEach((ep) => {
      const li = document.createElement("li");
      li.innerHTML = "<strong>" + ep.title + "</strong><span>" + ep.meta + "</span>";
      list.appendChild(li);
    });
  }

  function updateTrack() {
    const t = TRACKS[trackIndex];
    const title = $("#trackTitle");
    const artist = $("#trackArtist");
    if (title) title.textContent = t.title;
    if (artist) artist.textContent = t.artist;
  }

  function setPlaying(next) {
    playing = next;
    const disc = $("#playerDisc");
    const btn = $("#playToggle");
    const bar = $("#progressBar");
    if (disc) disc.classList.toggle("playing", playing);
    if (btn) btn.textContent = playing ? "❚❚" : "▶";
    clearInterval(progressTimer);
    if (playing && bar) {
      bar.style.width = "0%";
      let w = 0;
      progressTimer = setInterval(() => {
        w += 2;
        bar.style.width = Math.min(w, 100) + "%";
        if (w >= 100) {
          clearInterval(progressTimer);
          setPlaying(false);
          bar.style.width = "0%";
        }
      }, 120);
    } else if (bar) {
      bar.style.width = "0%";
    }
  }

  function initMusic() {
    updateTrack();
    $("#playToggle")?.addEventListener("click", () => setPlaying(!playing));
    $("#prevTrack")?.addEventListener("click", () => {
      trackIndex = (trackIndex - 1 + TRACKS.length) % TRACKS.length;
      updateTrack();
      if (playing) setPlaying(true);
    });
    $("#nextTrack")?.addEventListener("click", () => {
      trackIndex = (trackIndex + 1) % TRACKS.length;
      updateTrack();
      if (playing) setPlaying(true);
    });
  }

  function initModal() {
    const modal = $("#generatorModal");
    const form = $("#generatorForm");
    const output = $("#generatorOutput");

    $all("[data-open='generator']").forEach((btn) => {
      btn.addEventListener("click", () => modal?.showModal());
    });
    $all("[data-open='meet-rhys']").forEach((btn) => {
      btn.addEventListener("click", () => {
        alert("Rhys architecture sync — request via Hub EgregoreLab or S² Live Podcast when a slot opens.");
      });
    });
    $all("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => modal?.close());
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const preview = {
        name: data.get("name"),
        domain: data.get("domain"),
        axiom: data.get("axiom") || "(none)",
        status: "preview — deploy via Hub Egregore Generator",
        governed_by: "deep key / Ninefold canon"
      };
      if (output) {
        output.hidden = false;
        output.textContent = JSON.stringify(preview, null, 2);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initReveal();
    initHeroCount();
    renderOrbit();
    renderEgregoreGrid();
    renderEpisodes();
    initMusic();
    initModal();
    selectEgregore(EGREGORES[0]);
  });
})();
