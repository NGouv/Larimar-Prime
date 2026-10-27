const properties = [
  {
    id: 1,
    title: "Casa de linhas contemporâneas",
    type: "Casa",
    region: "Ponta da Praia · Santos",
    price: "R$ 2.450.000",
    bedrooms: 4,
    bathrooms: 3,
    area: 248,
    description: "Uma casa de arquitetura contemporânea, com ambientes integrados e área externa pensada para aproveitar o tempo em casa.",
    features: ["Área externa", "Ambientes integrados", "Luz natural"],
    gallery: [
      {
        src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85",
        alt: "Casa contemporânea com jardim e fachada de linhas retas"
      },
      {
        src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85",
        alt: "Sala contemporânea com grandes aberturas para o exterior"
      },
      {
        src: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85",
        alt: "Interior residencial contemporâneo com acabamentos naturais"
      }
    ]
  },
  {
    id: 2,
    title: "Apartamento com varanda",
    type: "Apartamento",
    region: "Gonzaga · Santos",
    price: "R$ 1.180.000",
    bedrooms: 3,
    bathrooms: 2,
    area: 126,
    description: "Um apartamento de desenho atual, com sala integrada à varanda e espaços bem distribuídos para a rotina.",
    features: ["Varanda", "Sala integrada", "Planta funcional"],
    gallery: [
      {
        src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85",
        alt: "Sala de apartamento moderno com mobiliário contemporâneo"
      },
      {
        src: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85",
        alt: "Sala de estar moderna com janelas amplas e luz natural"
      },
      {
        src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85",
        alt: "Ambiente residencial com acabamentos modernos"
      }
    ]
  },
  {
    id: 3,
    title: "Residência de acabamento sofisticado",
    type: "Casa",
    region: "Boqueirão · Santos",
    price: "R$ 3.280.000",
    bedrooms: 4,
    bathrooms: 4,
    area: 312,
    description: "Uma residência de atmosfera acolhedora, com materiais de presença marcante e ambientes voltados ao convívio.",
    features: ["Acabamentos selecionados", "Ambientes amplos", "Projeto contemporâneo"],
    gallery: [
      {
        src: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=85",
        alt: "Residência sofisticada com fachada contemporânea"
      },
      {
        src: "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=900&q=85",
        alt: "Sala elegante com materiais naturais e iluminação suave"
      },
      {
        src: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85",
        alt: "Detalhe de interiores residenciais com acabamento refinado"
      }
    ]
  }
];

const whatsappUrl = "https://wa.me/5511947216091";

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

function createPropertyCard(property) {
  const card = document.createElement("article");
  card.className = "property-card";
  card.innerHTML = `
    <div class="property-card-gallery" data-property-gallery="${property.id}">
      <img class="property-card-image" src="${property.gallery[0].src}" alt="${property.gallery[0].alt}" width="900" height="900" loading="lazy">
    </div>
    <div class="property-card-body">
      <div class="property-card-topline">
        <p class="property-type">${property.type}</p>
        <p class="property-region">${property.region}</p>
      </div>
      <span class="illustrative-note">Exemplo ilustrativo</span>
      <p class="property-price">${property.price}</p>
      <p class="property-meta">
        <span>${property.bedrooms} quartos</span>
        <span>${property.bathrooms} banheiros</span>
        <span>${property.area} m²</span>
      </p>
      <a class="card-link" href="imovel.html?id=${property.id}">Ver detalhes</a>
    </div>
  `;
  return card;
}

function setupCarousel() {
  const track = document.querySelector("[data-property-track]");
  if (!track) return;

  properties.forEach((property) => track.append(createPropertyCard(property)));

  const previous = document.querySelector("[data-carousel-prev]");
  const next = document.querySelector("[data-carousel-next]");
  const updateButtons = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = maxScroll <= 2 || track.scrollLeft >= maxScroll - 2;
  };

  const scrollByCard = (direction) => {
    const card = track.querySelector(".property-card");
    if (!card) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  };

  previous.addEventListener("click", () => scrollByCard(-1));
  next.addEventListener("click", () => scrollByCard(1));
  track.addEventListener("scroll", updateButtons, { passive: true });
  window.addEventListener("resize", updateButtons);
  updateButtons();
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

function setupPropertyDetail() {
  const page = document.querySelector("[data-property-detail]");
  if (!page) return;

  const id = new URLSearchParams(window.location.search).get("id");
  const property = properties.find((item) => String(item.id) === id);
  if (!property) {
    window.location.replace("index.html#imoveis");
    return;
  }

  document.title = `${property.title} | Larimar Prime Imóveis`;
  document.querySelector('meta[name="description"]').content =
    `${property.type} ilustrativo em ${property.region}. ${property.bedrooms} quartos, ${property.bathrooms} banheiros e ${property.area} m².`;
  document.querySelector("[data-detail-type]").textContent = property.type;
  document.querySelector("[data-detail-title]").textContent = property.title;
  document.querySelector("[data-detail-region]").textContent = property.region;
  document.querySelector("[data-detail-price]").textContent = `${property.price} · valor ilustrativo`;
  document.querySelector("[data-detail-description]").textContent = property.description;

  const facts = [
    ["Quartos", property.bedrooms],
    ["Banheiros", property.bathrooms],
    ["Área", `${property.area} m²`],
    ["Referência", "Ilustrativa"]
  ];
  const factsList = document.querySelector("[data-detail-facts]");
  facts.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    factsList.append(item);
  });

  const featureList = document.querySelector("[data-detail-features]");
  property.features.forEach((feature) => {
    const item = document.createElement("li");
    item.textContent = feature;
    featureList.append(item);
  });

  const gallery = document.querySelector("[data-detail-gallery]");
  let currentImageIndex = 0;
  gallery.innerHTML = `
    <img class="detail-gallery-image" src="${property.gallery[0].src}" alt="${property.gallery[0].alt}" width="1200" height="1200" fetchpriority="high">
    <button class="detail-gallery-arrow detail-gallery-prev" type="button" aria-label="Foto anterior">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"></path></svg>
    </button>
    <button class="detail-gallery-arrow detail-gallery-next" type="button" aria-label="Próxima foto">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
    </button>
    <span class="detail-gallery-count" aria-live="polite"></span>
  `;
  const mainImage = gallery.querySelector(".detail-gallery-image");
  const counter = gallery.querySelector(".detail-gallery-count");
  const showImage = (index) => {
    currentImageIndex = (index + property.gallery.length) % property.gallery.length;
    mainImage.src = property.gallery[currentImageIndex].src;
    mainImage.alt = property.gallery[currentImageIndex].alt;
    counter.textContent = `${currentImageIndex + 1} / ${property.gallery.length}`;
  };
  gallery.querySelector(".detail-gallery-prev").addEventListener("click", () => {
    showImage(currentImageIndex - 1);
  });
  gallery.querySelector(".detail-gallery-next").addEventListener("click", () => {
    showImage(currentImageIndex + 1);
  });
  showImage(0);

  const message = `Olá! Tenho interesse neste imóvel apresentado como exemplo ilustrativo: ${property.title} (${property.region}).`;
  document.querySelector("[data-detail-whatsapp]").href = `${whatsappUrl}?text=${encodeURIComponent(message)}`;
}

setupMobileMenu();
setupHeroVideo();
setupCarousel();
setupPropertyDetail();
