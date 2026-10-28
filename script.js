function setupMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".main-nav");
  if (!toggle || !navigation) return;

  const mobileQuery = window.matchMedia("(max-width: 640px)");
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    navigation.classList.toggle("is-open", open && mobileQuery.matches);
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (!navigation.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
  });
  mobileQuery.addEventListener("change", () => setOpen(false));
}

function setupHeroVideo() {
  const video = document.querySelector(".hero-video");
  if (!video) return;

  const mobileQuery = window.matchMedia("(max-width: 640px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeSource = "";

  const updateVideoSource = () => {
    if (reducedMotionQuery.matches) {
      activeSource = "";
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.classList.remove("is-ready");
      return;
    }

    const source = mobileQuery.matches ? "assets/hero-mobile.mp4" : "assets/hero-pc.mp4";
    if (source === activeSource) return;

    activeSource = source;
    video.classList.remove("is-ready");
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.src = source;
    video.load();
  };

  video.addEventListener("loadeddata", () => video.classList.add("is-ready"));
  video.addEventListener("error", () => video.classList.remove("is-ready"));
  mobileQuery.addEventListener("change", updateVideoSource);
  reducedMotionQuery.addEventListener("change", updateVideoSource);
  updateVideoSource();
}

setupMobileMenu();
setupHeroVideo();
