/* =========================================================
   Bukhari Azhar — Portfolio interactions
   GSAP + ScrollTrigger + Lenis
   ========================================================= */
(function () {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!(gsap && ScrollTrigger);

  if (!hasGsap) document.documentElement.classList.add("no-anim");
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  // Phones and tablets get a lighter version: native scrolling, fewer background layers,
  // no always-running decorative animation. (See the .is-lite rules in style.css.)
  const lite = window.matchMedia("(hover: none) and (pointer: coarse), (max-width: 720px)").matches;
  if (lite) document.documentElement.classList.add("is-lite");
  // the mobile address bar showing/hiding must not re-measure every pinned section
  if (hasGsap) ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- seeded random so the background is the same on every rebuild ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* =========================================================
     SMOOTH SCROLL (Lenis)
     ========================================================= */
  let lenis = null;
  if (hasGsap && window.Lenis && !reduceMotion && !lite) {
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const getScroll = () => (lenis ? lenis.scroll : window.scrollY);
  const getVelocity = () => (lenis ? lenis.velocity : 0);

  function scrollToY(y, opts = {}) {
    if (lenis) lenis.scrollTo(y, Object.assign({ duration: 1.2 }, opts));
    else window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* =========================================================
     HEADER — scrolled state, burger, anchors
     ========================================================= */
  const header = $("#header");
  const burger = $("#burger");
  let conveyorST = null; // set later; used by anchor scrolling
  let conveyorIntro = 0; // fraction of the pinned scroll before tray #1 is centred

  function onScrollHeader() {
    header.classList.toggle("is-scrolled", getScroll() > 10);
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  function setMenu(open) {
    header.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("is-locked", open);
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  burger.addEventListener("click", () => setMenu(!header.classList.contains("menu-open")));

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    setMenu(false);

    let y;
    if (id === "home") y = 0;
    else if (id === "projects" && conveyorST) {
      // jump to the moment the first tray sits in the middle of the belt
      y = conveyorST.start + (conveyorST.end - conveyorST.start) * conveyorIntro;
    } else {
      // pinned sections report their spacer position
      const el = target.closest(".pin-spacer") || target;
      y = el.getBoundingClientRect().top + window.scrollY;
      const st = hasGsap && ScrollTrigger.getAll().find((t) => t.pin && target.contains(t.pin));
      if (st) y = st.start;
    }
    scrollToY(Math.max(0, y));
  });

  /* =========================================================
     MODAL + LIGHTBOX
     ========================================================= */
  const modal = $("#messageModal");
  const lightbox = $("#lightbox");
  const resumeModal = $("#resumeModal");
  let lastFocus = null;

  function openLayer(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    if (lenis) lenis.stop();
    if (hasGsap && !reduceMotion) {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      const card = el.querySelector(".modal-card, img");
      if (card) gsap.fromTo(card, { scale: 0.7, y: 40 }, { scale: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" });
    }
  }
  function closeLayer(el) {
    if (el.hidden) return;
    el.hidden = true;
    if (lenis && !header.classList.contains("menu-open")) lenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  $$("[data-open-message]").forEach((b) =>
    b.addEventListener("click", () => {
      setMenu(false);
      openLayer(modal);
      const first = modal.querySelector("input");
      if (first) first.focus();
    })
  );
  $$("[data-close-modal]").forEach((b) => b.addEventListener("click", () => closeLayer(b.closest(".modal"))));
  $("#messageForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const subject = encodeURIComponent("Hello from " + f.get("name"));
    const body = encodeURIComponent(f.get("message") + "\n\n— " + f.get("name") + " (" + f.get("email") + ")");
    window.location.href = "mailto:bukhari@email.com?subject=" + subject + "&body=" + body;
    closeLayer(modal);
  });

  $$("button.hang").forEach((b) =>
    b.addEventListener("click", () => {
      const img = $("#lightboxImg");
      img.src = b.dataset.full;
      img.alt = b.querySelector(".poster").alt;
      openLayer(lightbox);
    })
  );
  // featured-project pictures open in the same lightbox
  $$(".polaroid-img, .pin-photo > img:not(.pushpin)").forEach((pic) => {
    pic.setAttribute("role", "button");
    pic.setAttribute("tabindex", "0");
    pic.classList.add("is-zoomable");
    const show = () => {
      const img = $("#lightboxImg");
      img.src = pic.currentSrc || pic.src;
      img.alt = pic.alt;
      openLayer(lightbox);
    };
    pic.addEventListener("click", show);
    pic.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(); }
    });
  });

  // résumé: in-page PDF viewer on desktop; phones follow the link, since their browsers open PDFs natively
  $$("[data-open-resume]").forEach((a) =>
    a.addEventListener("click", (e) => {
      if (window.matchMedia("(max-width: 720px), (pointer: coarse)").matches) return;
      e.preventDefault();
      const frame = $("#resumeFrame");
      if (!frame.getAttribute("src")) frame.src = a.getAttribute("href") + "#view=FitH";
      openLayer(resumeModal);
      resumeModal.querySelector(".modal-close").focus();
    })
  );

  lightbox.addEventListener("click", () => closeLayer(lightbox));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeLayer(modal); closeLayer(resumeModal); closeLayer(lightbox); setMenu(false);
  });

  /* =========================================================
     ABOUT — photo showcase
     ========================================================= */
  (function showcase() {
    const frame = $("#showcaseFrame");
    const thumbs = $$("#aboutThumbs button");
    const pedestal = $("#pedestalBody");
    if (!frame || !thumbs.length) return;
    let index = 0, busy = false, shift = 0, timer = null;

    function go(next, dir) {
      next = (next + thumbs.length) % thumbs.length;
      if (next === index || busy) return;
      const src = thumbs[next].querySelector("img").src;
      const old = frame.querySelector("img");
      const img = new Image();
      img.src = src; img.alt = "Snapshot " + (next + 1);
      thumbs[index].classList.remove("is-active");
      thumbs[next].classList.add("is-active");
      index = next;

      if (!hasGsap || reduceMotion) { old.replaceWith(img); return; }
      busy = true;
      frame.appendChild(img);
      gsap.fromTo(img, { xPercent: 100 * dir, rotation: 6 * dir }, { xPercent: 0, rotation: 0, duration: 0.6, ease: "power3.out" });
      gsap.to(old, { xPercent: -100 * dir, rotation: -6 * dir, duration: 0.6, ease: "power3.out", onComplete: () => { old.remove(); busy = false; } });
      gsap.fromTo(frame, { y: -10 }, { y: 0, duration: 0.6, ease: "bounce.out" });
      // spin the pedestal's reflections
      shift += dir * pedestal.offsetWidth * 0.5;
      gsap.to(pedestal, { "--shift": shift + "px", duration: 0.7, ease: "power2.out" });
    }

    thumbs.forEach((t, i) => t.addEventListener("click", () => { go(i, i > index ? 1 : -1); restart(); }));
    $(".showcase-arrow--prev").addEventListener("click", () => { go(index - 1, -1); restart(); });
    $(".showcase-arrow--next").addEventListener("click", () => { go(index + 1, 1); restart(); });

    function restart() {
      clearInterval(timer);
      if (reduceMotion) return;
      timer = setInterval(() => {
        const r = frame.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight && !document.hidden) go(index + 1, 1);
      }, 4500);
    }
    restart();
  })();

  /* ---------- barcode on the receipt ---------- */
  (function barcode() {
    const svg = $("#barcode");
    if (!svg) return;
    const r = rng(2026);
    let x = 0, out = "";
    while (x < 320) {
      const w = 1 + Math.floor(r() * 4);
      out += '<rect x="' + x + '" y="0" width="' + w + '" height="34" fill="#111"/>';
      x += w + 1 + Math.floor(r() * 3);
    }
    svg.innerHTML = out;
  })();

  $("#year").textContent = new Date().getFullYear();

  /* Everything below needs GSAP. Without it the page is a plain, fully visible document. */
  if (!hasGsap) { const l = $("#loader"); if (l) l.remove(); return; }

  /* =========================================================
     WORLD — layered perspective background
     ========================================================= */
  const world = $("#world");
  const worldInner = $(".world-inner", world);
  // lite: keep only the sky and the far clouds — the deeper layers are thousands of pixels tall
  // and too heavy for a phone GPU to move every frame
  if (lite) $$(".world-layer", world).forEach((el) => { if (parseFloat(el.dataset.depth) > 0.2) el.remove(); });
  const worldLayers = $$(".world-layer", world).map((el, i) => ({
    el, i, depth: parseFloat(el.dataset.depth), fill: el.dataset.fill || null,
    count: parseInt(el.dataset.count || "0", 10),
    size: (el.dataset.size || "10-20").split("-").map(Number),
    opacity: parseFloat(el.dataset.opacity || "1"),
  }));
  const tint = $("#worldTint");
  let docH = 0, builtFor = -1;

  function buildWorld() {
    docH = Math.max(document.documentElement.scrollHeight, innerHeight);
    if (Math.abs(docH - builtFor) < 4) return;
    builtFor = docH;
    const small = innerWidth < 720;

    worldLayers.forEach((L) => {
      const h = innerHeight + (docH - innerHeight) * L.depth + 160;
      L.el.style.height = h + "px";
      if (!L.fill) return;
      const r = rng(1000 + L.i * 97);
      const n = Math.round(L.count * (small ? 0.6 : 1) * Math.max(1, h / 2400));
      let html = "";
      for (let k = 0; k < n; k++) {
        const x = r() * 100, y = r() * h;
        let s = L.size[0] + r() * (L.size[1] - L.size[0]);
        if (small) s *= 0.7;
        if (L.fill === "clouds") {
          html += '<div class="cloud" style="--w:' + s.toFixed(0) + "px;left:" + (x - 10).toFixed(1) + "%;top:" + y.toFixed(0) + "px;opacity:" + (L.opacity * (0.6 + r() * 0.4)).toFixed(2) + ";transform:scaleX(" + (r() > 0.5 ? 1 : -1) + ')"></div>';
        } else if (L.fill === "sparkles") {
          html += '<div class="world-item twinkle" style="width:' + s.toFixed(0) + "px;height:" + s.toFixed(0) + "px;left:" + x.toFixed(1) + "%;top:" + y.toFixed(0) + "px;animation-delay:-" + (r() * 3).toFixed(2) + 's"><svg class="spark spark--white" viewBox="0 0 24 24"><use href="#i-spark"/></svg></div>';
        } else {
          const kind = Math.floor(r() * 6);
          const rot = (r() * 60 - 30).toFixed(0);
          const base = '<div class="world-item bob" style="width:' + s.toFixed(0) + "px;height:" + s.toFixed(0) + "px;left:" + x.toFixed(1) + "%;top:" + y.toFixed(0) + "px;--rot:" + rot + "deg;animation-delay:-" + (r() * 6).toFixed(2) + 's">';
          const colors = ["pink", "yellow", "cyan"];
          if (kind < 3) html += base + '<svg class="spark spark--' + colors[kind] + '" viewBox="0 0 24 24"><use href="#i-spark"/></svg></div>';
          else if (kind === 3) html += base + '<svg class="pixel-heart" style="width:100%;height:100%" viewBox="0 0 7 6"><use href="#i-heart"/></svg></div>';
          else html += base + '<div class="scrap scrap--' + (kind === 4 ? "pink" : "yellow") + '"></div></div>';
        }
      }
      L.el.innerHTML = html;
    });
  }

  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    mouse.x = e.clientX / innerWidth - 0.5;
    mouse.y = e.clientY / innerHeight - 0.5;
  }, { passive: true });

  function renderWorld() {
    const sy = getScroll();
    mouse.sx += (mouse.x - mouse.sx) * 0.06;
    mouse.sy += (mouse.y - mouse.sy) * 0.06;
    for (const L of worldLayers) {
      const tx = -mouse.sx * L.depth * 90;
      const ty = -sy * L.depth - mouse.sy * L.depth * 50;
      L.el.style.transform = "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0)";
    }
    if (lite) return;
    if (!reduceMotion) {
      worldInner.style.transform = "rotateX(" + (mouse.sy * 2.2).toFixed(3) + "deg) rotateY(" + (-mouse.sx * 2.2).toFixed(3) + "deg) scale(1.04)";
    }
    const prog = docH > innerHeight ? sy / (docH - innerHeight) : 0;
    tint.style.opacity = clamp((prog - 0.5) / 0.3, 0, 1).toFixed(3);
  }
  buildWorld();
  gsap.ticker.add(renderWorld);
  ScrollTrigger.addEventListener("refresh", buildWorld);

  /* =========================================================
     HERO
     ========================================================= */
  // split the first line into letters
  $$("[data-split]").forEach((el) => {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.innerHTML = text.split("").map((c) => (c === " " ? " " : '<span class="ch" aria-hidden="true">' + c + "</span>")).join("");
  });

  const heroEl = $(".hero");
  if (!reduceMotion) heroEl.classList.add("is-animating");
  const heroIntro = gsap.timeline({
    paused: true, defaults: { ease: "back.out(1.7)" },
    onComplete() { gsap.set(".hero-tags .tag", { clearProps: "transform,opacity" }); heroEl.classList.remove("is-animating"); },
  });
  if (!reduceMotion) {
    heroIntro
      .from(".hero-paper", { scale: 0.4, rotation: -10, opacity: 0, duration: 0.9 })
      .from(".hero-line1 .ch", { yPercent: 120, rotation: () => gsap.utils.random(-25, 25), opacity: 0, duration: 0.55, stagger: 0.04 }, "-=0.5")
      .from(".hero-is", { scale: 0, duration: 0.4, ease: "steps(4)" }, "-=0.15")
      .fromTo(".hero-name", { clipPath: "inset(-20% 100% -20% 0)" }, { clipPath: "inset(-20% -10% -20% 0)", duration: 1.1, ease: "power2.inOut" }, "-=0.2")
      .from(".hero-tags .tag", { y: -60, opacity: 0, rotation: () => gsap.utils.random(-30, 30), duration: 0.5, stagger: 0.07 }, "-=0.7")
      .from(".scroll-cue", { opacity: 0, y: -10, duration: 0.4 }, "-=0.2")
      .from(".header", { yPercent: -120, duration: 0.6, ease: "power3.out" }, 0.2);
  }

  if (!reduceMotion) {
    // layered scroll-out: card slow, tags faster, front clouds fastest
    const heroST = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
    gsap.to(".hero-card", { yPercent: -14, scale: 0.9, ease: "none", scrollTrigger: heroST });
    gsap.to(".hero-tags", { yPercent: -130, ease: "none", scrollTrigger: heroST });
    gsap.to(".hero-clouds-front", { yPercent: -45, scale: 1.25, ease: "none", scrollTrigger: heroST });
    gsap.to(".scroll-cue", { opacity: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "20% top", scrub: true } });

    // mouse tilt / depth
    const card = $(".hero-card"), tags = $(".hero-tags");
    const rx = gsap.quickTo(card, "rotationX", { duration: 0.6, ease: "power3" });
    const ry = gsap.quickTo(card, "rotationY", { duration: 0.6, ease: "power3" });
    const cx = gsap.quickTo(card, "x", { duration: 0.8, ease: "power3" });
    const cy = gsap.quickTo(card, "y", { duration: 0.8, ease: "power3" });
    const tx = gsap.quickTo(tags, "x", { duration: 0.8, ease: "power3" });
    const ty = gsap.quickTo(tags, "y", { duration: 0.8, ease: "power3" });
    $(".hero").addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const px = e.clientX / innerWidth - 0.5, py = e.clientY / innerHeight - 0.5;
      rx(-py * 10); ry(px * 12); cx(px * 24); cy(py * 16); tx(px * 54); ty(py * 30);
    });
  }

  /* ---------- marquee tape ---------- */
  (function marquee() {
    const track = $("#marqueeTrack");
    if (!track) return;
    const html = track.innerHTML;
    track.innerHTML = html + html + html + html;
    if (reduceMotion) return;
    let x = 0, w = 0, dir = -1;
    const measure = () => { w = track.scrollWidth / 4; };
    measure(); window.addEventListener("resize", measure);
    gsap.ticker.add((t, dt) => {
      const v = getVelocity();
      if (Math.abs(v) > 0.5) dir = v > 0 ? -1 : 1;
      x += dir * (0.06 * dt + Math.abs(v) * 0.6);
      if (w) { if (x <= -w) x += w; if (x > 0) x -= w; }
      track.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
    });
  })();

  /* ---------- generic reveals ---------- */
  if (!reduceMotion) {
    $$(".reveal-title").forEach((el) => {
      gsap.from(el, { scale: 0.5, rotation: "-=9", opacity: 0, duration: 0.8, ease: "back.out(1.8)", scrollTrigger: { trigger: el, start: "top 88%" } });
    });
    $$(".reveal-up").forEach((el) => {
      gsap.from(el, { y: 50, opacity: 0, duration: 0.7, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" } });
    });

    // about: showcase + thumbs
    gsap.from(".about-showcase", { y: 120, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: ".about-showcase", start: "top 85%" } });
    gsap.from("#aboutThumbs li", { scale: 0, rotation: () => gsap.utils.random(-40, 40), duration: 0.5, ease: "back.out(2)", stagger: 0.06, scrollTrigger: { trigger: "#aboutThumbs", start: "top 85%" } });
  }

  /* =========================================================
     EDUCATION — papers rise out of the folders as you scroll
     ========================================================= */
  const mm = gsap.matchMedia();
  const papers = $$(".folder-paper");
  const PAPER_DOWN = 236; // px the paper sits inside the folder before it rises

  if (reduceMotion) {
    /* papers stay up */
  } else {
    // desktop: pin the section and raise the papers one after another
    mm.add("(min-width: 961px) and (min-height: 700px)", () => {
      gsap.set(papers, { y: PAPER_DOWN });
      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: { trigger: "#eduPin", start: "top top", end: "+=170%", pin: true, scrub: 0.6, anticipatePin: 1 },
      });
      papers.forEach((p, i) => {
        const photo = p.querySelector(".fp-photo");
        tl.to(p, { y: 0, duration: 1 }, i * 0.8)
          .fromTo(photo, { rotation: 14, x: 30 }, { rotation: -6, x: 0, duration: 0.8 }, i * 0.8 + 0.2);
      });
      tl.to({}, { duration: 0.4 }); // small hold at the end
      return () => gsap.set(papers, { clearProps: "transform" });
    });

    // small screens: each paper rises as its own folder scrolls into view
    mm.add("(max-width: 960px), (max-height: 699px)", () => {
      const tweens = papers.map((p) =>
        gsap.fromTo(p, { y: PAPER_DOWN }, { y: 0, ease: "power1.out", scrollTrigger: { trigger: p.closest(".folder"), start: "top 85%", end: "top 30%", scrub: 0.6 } })
      );
      return () => { tweens.forEach((t) => t.kill()); gsap.set(papers, { clearProps: "transform" }); };
    });
  }

  /* =========================================================
     SKILLS — signboards pop up from behind the hill
     ========================================================= */
  if (!reduceMotion) {
    const signs = $("#signs");
    signs.classList.add("is-animating");
    gsap.timeline({
      scrollTrigger: { trigger: signs, start: "top 78%" },
      onComplete() { gsap.set(".sign-icons li", { clearProps: "transform" }); signs.classList.remove("is-animating"); },
    })
      .from(".sign", { y: 320, opacity: 0, duration: 0.9, ease: "back.out(1.3)", stagger: 0.09 })
      .from(".sign-icons li", { scale: 0, duration: 0.35, ease: "back.out(3)", stagger: 0.02 }, 0.45);
    gsap.fromTo(".hill-grass", { y: 90 }, { y: 0, ease: "none", scrollTrigger: { trigger: ".skills", start: "top bottom", end: "bottom bottom", scrub: true } });
    gsap.fromTo(".hill-cat", { y: 140 }, { y: 0, ease: "none", scrollTrigger: { trigger: ".skills", start: "40% bottom", end: "bottom bottom", scrub: true } });
    gsap.to(".hill-cat", { rotation: 7, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }

  /* =========================================================
     PROJECTS — conveyor belt, camera locked, trays roll out
     ========================================================= */
  (function conveyor() {
    const stage = $("#conveyor");
    const trays = $$(".tray", stage);
    const belt = $("#belt"), railL = $("#railL"), railR = $("#railR");
    const counter = $("#projCounter"), lights = $("#hoodLights"), hint = $("#conveyorHint");
    const N = trays.length;
    if (!stage || !N) return;

    $("#projTotal").textContent = String(N).padStart(2, "0");
    lights.innerHTML = trays.map(() => "<i></i>").join("");
    const dots = $$("i", lights);

    const INTRO = 0.8;   // the first tray starts this far "inside" the machine
    const HOLD = 0.35;   // rest on the last tray before the section unpins
    const TOTAL = INTRO + (N - 1) + HOLD;
    conveyorIntro = INTRO / TOTAL;

    const state = { p: -INTRO };
    let spacing = 800, current = -1;

    function layout() {
      const H = stage.clientHeight, W = stage.clientWidth;
      const cs = getComputedStyle(stage);
      const hood = $(".hood", stage).offsetHeight;
      const rail = railL.offsetWidth;
      const portrait = window.matchMedia("(max-width: 720px)").matches;
      const dw = portrait ? 520 : 1000, dh = portrait ? 656 : 794;
      const s = Math.min((W - rail * 2 + (portrait ? 14 : -16)) / dw, (H - hood - 26) / dh, 1.2);
      stage.style.setProperty("--s", s.toFixed(4));
      spacing = (H - hood) / 2 + (dh * s) / 2 + 40;
      void cs;
      render();
    }

    function render() {
      const p = state.p;
      for (let i = 0; i < N; i++) {
        const d = p - i; // 0 = centred, <0 = still inside the machine, >0 = rolled past
        const y = d * spacing;
        const rot = Math.sin(d * 2.4) * 1.4 + (i % 2 ? 0.6 : -0.6);
        trays[i].style.transform = "translate3d(0," + y.toFixed(1) + "px,0) rotate(" + rot.toFixed(2) + "deg)";
        trays[i].style.visibility = Math.abs(d) > 1.6 ? "hidden" : "visible";
      }
      const off = (p * spacing).toFixed(1) + "px";
      belt.style.backgroundPosition = "0 0, 0 " + off + ", 0 0";
      railL.style.backgroundPosition = railR.style.backgroundPosition = "0 " + off;

      const k = clamp(Math.round(p), 0, N - 1);
      if (k !== current) {
        current = k;
        counter.textContent = String(k + 1).padStart(2, "0");
        dots.forEach((d, i) => d.classList.toggle("on", i <= k));
      }
      hint.style.opacity = p > N - 1.2 ? "0" : "1";
    }

    if (reduceMotion) {
      // no pinning: show the trays as a simple stacked list
      stage.style.height = "auto";
      stage.style.padding = "calc(var(--hood) + 30px) 0 40px";
      $(".trays", stage).style.position = "static";
      trays.forEach((t) => { t.style.position = "relative"; t.style.left = "50%"; t.style.top = "auto"; t.style.height = "min(820px, 130vw)"; t.querySelector(".tray-body").style.top = "50%"; });
      hint.remove();
      const fit = () => stage.style.setProperty("--s", Math.min((stage.clientWidth - 90) / (innerWidth <= 720 ? 520 : 1000), 1).toFixed(3));
      fit(); window.addEventListener("resize", fit);
      return;
    }

    layout();
    ScrollTrigger.addEventListener("refreshInit", layout);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage, start: "top top",
        end: () => "+=" + Math.round(TOTAL * innerHeight * 0.85),
        pin: true, scrub: 0.5, anticipatePin: 1, invalidateOnRefresh: true,
      },
    });
    tl.to(state, { p: N - 1, duration: INTRO + N - 1, ease: "none", onUpdate: render })
      .to({}, { duration: HOLD });
    conveyorST = tl.scrollTrigger;

    // settle on the nearest tray once the user stops scrolling
    let idle = null, snapping = false;
    function scheduleSnap() {
      clearTimeout(idle);
      if (snapping) return;
      idle = setTimeout(() => {
        const st = conveyorST;
        const y = getScroll();
        if (y <= st.start + 2 || y >= st.end - 2) return;
        const raw = -INTRO + ((y - st.start) / (st.end - st.start)) * TOTAL;
        if (raw < -0.45 || raw > N - 1 + 0.05) return; // entering / leaving: leave the user alone
        const k = clamp(Math.round(raw), 0, N - 1);
        if (Math.abs(raw - k) < 0.02) return;
        const target = st.start + ((k + INTRO) / TOTAL) * (st.end - st.start);
        snapping = true;
        scrollToY(target, { duration: 0.7, onComplete: () => { snapping = false; } });
        setTimeout(() => { snapping = false; }, 900);
      }, 170);
    }
    // touch: no auto-settle — the page moving on its own after a swipe fights the finger
    if (lenis) lenis.on("scroll", scheduleSnap);
    else if (!lite) window.addEventListener("scroll", scheduleSnap, { passive: true });
  })();

  /* =========================================================
     EXPERIENCE — receipt prints out of the slot
     ========================================================= */
  (function printer() {
    const printer = $("#printer"), receipt = $("#receipt"), led = $("#printerLed");
    if (!printer || reduceMotion) return;
    let off = null;
    gsap.fromTo(receipt, { yPercent: -101 }, {
      yPercent: 0, ease: "none",
      scrollTrigger: {
        trigger: printer, start: "top 82%", end: "top 20%", scrub: 0.4,
        onUpdate(self) {
          const active = self.progress > 0 && self.progress < 1;
          printer.classList.toggle("is-printing", active);
          led.classList.toggle("on", active);
          clearTimeout(off);
          off = setTimeout(() => { printer.classList.remove("is-printing"); led.classList.toggle("on", self.progress >= 1); }, 220);
        },
      },
    });
  })();

  /* =========================================================
     GALLERY — clotheslines
     ========================================================= */
  if (!reduceMotion) {
    $$(".line").forEach((line) => {
      const dir = parseFloat(line.dataset.drift || "1");
      const items = $(".line-items", line);
      const hangs = $$(".hang", line);

      // rows drift sideways in opposite directions for depth
      gsap.fromTo(items, { x: -70 * dir }, { x: 70 * dir, ease: "none", scrollTrigger: { trigger: line, start: "top bottom", end: "bottom top", scrub: true } });
      gsap.fromTo($(".rope", line), { x: 30 * dir }, { x: -30 * dir, ease: "none", scrollTrigger: { trigger: line, start: "top bottom", end: "bottom top", scrub: true } });

      // posters get pegged on, then sway in the breeze
      gsap.from(hangs, {
        y: -120, opacity: 0, rotation: (i) => (i % 2 ? 16 : -16), duration: 0.9, ease: "elastic.out(1, 0.55)", stagger: 0.12,
        scrollTrigger: { trigger: line, start: "top 80%" },
        onComplete() {
          if (lite) return; // no endless sway on phones
          hangs.forEach((h, i) => {
            const amp = 1.2 + Math.random() * 1.4;
            gsap.fromTo(h, { rotation: -amp }, { rotation: amp, duration: 2.2 + Math.random() * 1.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.2 });
          });
        },
      });
    });

    // scroll speed = wind
    const hangsAll = lite ? [] : $$(".hang");
    const wind = hangsAll.map((h) => gsap.quickTo(h, "skewX", { duration: 0.8, ease: "power3" }));
    gsap.ticker.add(() => {
      const v = clamp(getVelocity() * 0.12, -7, 7);
      for (let i = 0; i < wind.length; i++) wind[i](v * (i % 2 ? 1 : 0.7));
    });
  }

  /* =========================================================
     CONTACT
     ========================================================= */
  if (!reduceMotion) {
    gsap.from(".contact-list li", { x: -80, opacity: 0, duration: 0.6, ease: "back.out(1.6)", stagger: 0.1, scrollTrigger: { trigger: ".contact-list", start: "top 88%" } });
    gsap.from("#resume", { y: 90, rotation: 16, opacity: 0, duration: 0.8, ease: "back.out(1.6)", scrollTrigger: { trigger: ".contact-main", start: "top 85%" } });
    gsap.from("#me", { yPercent: 55, ease: "none", scrollTrigger: { trigger: ".contact", start: "top 75%", end: "top 15%", scrub: 0.6 } });
    gsap.from("#bubble", { scale: 0, rotation: -20, transformOrigin: "0% 100%", duration: 0.5, ease: "back.out(2.4)", scrollTrigger: { trigger: ".contact", start: "top 20%" } });
    const meRot = gsap.quickTo("#me", "rotation", { duration: 0.9, ease: "power3" });
    $(".contact").addEventListener("pointermove", (e) => { if (e.pointerType !== "touch") meRot((e.clientX / innerWidth - 0.5) * 5); });
  }

  /* ---------- floating decorations inside coloured sections ---------- */
  if (!reduceMotion) {
    $$(".deco-float").forEach((el) => {
      const speed = parseFloat(el.dataset.speed || "0.5");
      gsap.fromTo(el, { y: 160 * speed }, { y: -160 * speed, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
  }

  /* ---------- active nav pill ---------- */
  const navLinks = $$(".header-list a");
  $$("[data-section]").forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: "top 55%", end: "bottom 55%",
      onToggle(self) {
        if (!self.isActive) return;
        navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + sec.id));
      },
    });
  });

  /* =========================================================
     LOADER — pink screen opens through a star
     ========================================================= */
  (function loader() {
    const el = $("#loader"), bar = $("#loaderBar");
    const done = () => { if (el) el.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); };
    if (!el || reduceMotion) { done(); heroIntro.progress(1); return; }

    if (lenis) lenis.stop();
    window.scrollTo(0, 0);
    const imgs = $$("img").filter((i) => i.loading !== "lazy");
    let loaded = 0;
    const tick = () => { loaded++; bar.style.width = Math.round((loaded / imgs.length) * 100) + "%"; };
    imgs.forEach((i) => (i.complete ? tick() : (i.addEventListener("load", tick, { once: true }), i.addEventListener("error", tick, { once: true }))));

    let started = false;
    function open() {
      if (started) return; started = true;
      bar.style.width = "100%";
      ScrollTrigger.refresh();
      gsap.timeline({ delay: 0.25 })
        .to(".loader-text", { opacity: 0, scale: 0.8, duration: 0.3 })
        .to(".loader-star", { scale: 16, rotation: 120, svgOrigin: "50 50", duration: 1.15, ease: "power3.in" }, "-=0.05")
        .add(() => heroIntro.play(), "-=0.55")
        .add(done);
    }
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    window.addEventListener("load", () => fontsReady.then(open));
    setTimeout(open, 4500); // never trap the visitor behind the loader
  })();

  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
