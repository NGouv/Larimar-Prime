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

function setupSantosSlideshow() {
  const section = document.querySelector(".santos-section");
  if (!section) return;

  const slides = Array.from(section.querySelectorAll(".santos-slide"));
  const indicators = Array.from(section.querySelectorAll("[data-santos-slide-to]"));
  if (slides.length < 2 || slides.length !== indicators.length) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = 0;
  let changeId = 0;
  let timer;
  let paused = false;

  const loadSlide = (index) => {
    const slide = slides[index];
    const source = slide.dataset.src;
    if (!source || (slide.complete && slide.naturalWidth > 0)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      slide.addEventListener("load", resolve, { once: true });
      slide.addEventListener("error", reject, { once: true });
      slide.src = source;
    });
  };

  const showSlide = async (index) => {
    const requestId = ++changeId;
    try {
      await loadSlide(index);
    } catch (error) {
      console.error(`Não foi possível carregar a paisagem ${index + 1}.`, error);
      return;
    }

    if (requestId !== changeId) return;
    activeIndex = index;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === index);
    });
    indicators.forEach((indicator, slideIndex) => {
      indicator.setAttribute("aria-pressed", String(slideIndex === index));
    });
  };

  const stop = () => {
    window.clearTimeout(timer);
    timer = undefined;
  };

  const schedule = () => {
    stop();
    if (paused || reducedMotionQuery.matches) return;
    timer = window.setTimeout(async () => {
      await showSlide((activeIndex + 1) % slides.length);
      schedule();
    }, 6500);
  };

  indicators.forEach((indicator, index) => {
    indicator.addEventListener("click", async () => {
      stop();
      await showSlide(index);
      schedule();
    });
  });

  section.addEventListener("mouseenter", () => {
    paused = true;
    stop();
  });
  section.addEventListener("mouseleave", () => {
    paused = false;
    schedule();
  });
  section.addEventListener("focusin", () => {
    paused = true;
    stop();
  });
  section.addEventListener("focusout", (event) => {
    if (!section.contains(event.relatedTarget)) {
      paused = false;
      schedule();
    }
  });
  reducedMotionQuery.addEventListener("change", schedule);
  schedule();
}

setupMobileMenu();
setupSantosSlideshow();
