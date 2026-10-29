import { createImageUrlMap, formatPrice, getPublicSupabase, propertyLocation } from "./supabase-client.js";

const propertyFields = "id,title,property_type,purpose,neighborhood,city,state,price,bedrooms,bathrooms,parking_spaces,area_sqm,description,features,gallery,cover_image_path,status,published_at,created_at";
const typeLabels = {
  casa: "Casa",
  apartamento: "Apartamento",
  cobertura: "Cobertura",
  terreno: "Terreno",
  comercial: "Imóvel comercial",
  outro: "Outro"
};
const purposeLabels = {
  venda: "À venda",
  locacao: "Para locação",
  venda_locacao: "Venda e locação"
};

function orderedGallery(property) {
  const gallery = Array.isArray(property.gallery) ? [...property.gallery] : [];
  return gallery.sort((first, second) => {
    if (first.path === property.cover_image_path) return -1;
    if (second.path === property.cover_image_path) return 1;
    return 0;
  });
}

function setCatalogStatus(message, retry) {
  const track = document.querySelector("[data-property-track]");
  if (!track) return;

  track.replaceChildren();
  document.querySelector("[data-carousel-prev]").disabled = true;
  document.querySelector("[data-carousel-next]").disabled = true;
  const status = document.createElement("p");
  status.className = "catalog-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.textContent = message;
  track.append(status);

  if (retry) {
    const button = document.createElement("button");
    button.className = "catalog-retry";
    button.type = "button";
    button.textContent = "Tentar novamente";
    button.addEventListener("click", loadCatalog);
    track.append(button);
  }
}

function createPropertyCard(property, imageUrls) {
  const card = document.createElement("article");
  card.className = "property-card";

  const gallery = orderedGallery(property);
  const cover = gallery[0];
  if (cover && imageUrls.has(cover.path)) {
    const image = document.createElement("img");
    image.className = "property-card-image";
    image.src = imageUrls.get(cover.path);
    image.alt = cover.alt || `Foto de ${property.title}`;
    image.width = 900;
    image.height = 900;
    image.loading = "lazy";
    const imageWrap = document.createElement("div");
    imageWrap.className = "property-card-gallery";
    imageWrap.append(image);
    card.append(imageWrap);
  }

  const body = document.createElement("div");
  body.className = "property-card-body";
  const topline = document.createElement("div");
  topline.className = "property-card-topline";
  const type = document.createElement("p");
  type.className = "property-type";
  type.textContent = typeLabels[property.property_type] || "Imóvel";
  const location = document.createElement("p");
  location.className = "property-region";
  location.textContent = propertyLocation(property);
  topline.append(type, location);

  const title = document.createElement("h3");
  title.className = "property-title";
  title.textContent = property.title;
  const purpose = document.createElement("p");
  purpose.className = "property-region";
  purpose.textContent = purposeLabels[property.purpose] || "";
  purpose.style.textAlign = "left";
  const price = document.createElement("p");
  price.className = "property-price";
  price.textContent = formatPrice(property.price);
  const meta = document.createElement("p");
  meta.className = "property-meta";
  [
    [property.bedrooms, "quartos"],
    [property.bathrooms, "banheiros"],
    [property.parking_spaces, "vagas"],
    [property.area_sqm, "m²"]
  ].forEach(([value, label]) => {
    if (value === null || value === undefined) return;
    const item = document.createElement("span");
    item.textContent = `${value} ${label}`;
    meta.append(item);
  });

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = `/imovel?id=${encodeURIComponent(property.id)}`;
  link.textContent = "Ver detalhes";
  body.append(topline, title, purpose, price, meta, link);
  card.append(body);
  return card;
}

function setupCarousel(track) {
  const previous = document.querySelector("[data-carousel-prev]");
  const next = document.querySelector("[data-carousel-next]");
  if (!previous || !next) return;

  const updateButtons = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = maxScroll <= 2 || track.scrollLeft >= maxScroll - 2;
  };
  const scrollByCard = (direction) => {
    const card = track.querySelector(".property-card");
    if (!card) return;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: "smooth"
    });
  };

  previous.addEventListener("click", () => scrollByCard(-1));
  next.addEventListener("click", () => scrollByCard(1));
  track.addEventListener("scroll", updateButtons, { passive: true });
  window.addEventListener("resize", updateButtons);
  updateButtons();
}

async function loadCatalog() {
  const track = document.querySelector("[data-property-track]");
  if (!track) return;

  setCatalogStatus("Carregando imóveis...", false);
  try {
    const supabase = await getPublicSupabase();
    const { data: properties, error } = await supabase
      .from("properties")
      .select(propertyFields)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    if (!properties?.length) {
      setCatalogStatus("Estamos preparando nossos imóveis para você.", false);
      return;
    }

    const paths = properties.flatMap((property) => orderedGallery(property).map((image) => image.path));
    const imageUrls = await createImageUrlMap(supabase, paths);
    if (imageUrls.size !== new Set(paths).size) {
      throw new Error("Uma ou mais fotos dos imóveis não estão disponíveis.");
    }
    track.replaceChildren(...properties.map((property) => createPropertyCard(property, imageUrls)));
    setupCarousel(track);
  } catch (error) {
    setCatalogStatus(`Não foi possível carregar os imóveis. ${error.message}`, true);
  }
}

function renderDetailStatus(message, retry) {
  const status = document.querySelector("[data-property-state]");
  if (!status) return;
  status.replaceChildren(document.createTextNode(message));

  if (retry) {
    const button = document.createElement("button");
    button.className = "catalog-retry";
    button.type = "button";
    button.textContent = "Tentar novamente";
    button.addEventListener("click", loadPropertyDetail);
    status.append(" ", button);
  }
}

function setDetailVisibility(visible) {
  document.querySelector("[data-detail-gallery]").hidden = !visible;
  document.querySelector(".detail-content").hidden = !visible;
  document.querySelector("[data-property-state]").hidden = visible;
}

function renderPropertyDetail(property, imageUrls) {
  const gallery = document.querySelector("[data-detail-gallery]");
  const images = orderedGallery(property);
  const firstImage = images.find((image) => imageUrls.has(image.path));

  gallery.replaceChildren();
  if (firstImage) {
    const image = document.createElement("img");
    image.className = "detail-gallery-image";
    image.src = imageUrls.get(firstImage.path);
    image.alt = firstImage.alt || `Foto de ${property.title}`;
    image.width = 1200;
    image.height = 1200;
    image.fetchPriority = "high";
    gallery.append(image);
  }

  const previous = document.createElement("button");
  previous.className = "detail-gallery-arrow detail-gallery-prev";
  previous.type = "button";
  previous.setAttribute("aria-label", "Foto anterior");
  previous.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6"></path></svg>';
  const next = document.createElement("button");
  next.className = "detail-gallery-arrow detail-gallery-next";
  next.type = "button";
  next.setAttribute("aria-label", "Próxima foto");
  next.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';
  const counter = document.createElement("span");
  counter.className = "detail-gallery-count";
  counter.setAttribute("aria-live", "polite");
  gallery.append(previous, next, counter);

  const availableImages = images.filter((item) => imageUrls.has(item.path));
  let currentIndex = 0;
  const showImage = (index) => {
    currentIndex = (index + availableImages.length) % availableImages.length;
    const current = availableImages[currentIndex];
    gallery.querySelector(".detail-gallery-image").src = imageUrls.get(current.path);
    gallery.querySelector(".detail-gallery-image").alt = current.alt || `Foto de ${property.title}`;
    counter.textContent = `${currentIndex + 1} / ${availableImages.length}`;
  };

  if (availableImages.length > 1) {
    previous.addEventListener("click", () => showImage(currentIndex - 1));
    next.addEventListener("click", () => showImage(currentIndex + 1));
  } else {
    previous.hidden = true;
    next.hidden = true;
    counter.hidden = true;
  }
  if (availableImages.length) showImage(0);

  document.querySelector("[data-detail-type]").textContent =
    `${typeLabels[property.property_type] || "Imóvel"} · ${purposeLabels[property.purpose] || ""}`;
  document.querySelector("[data-detail-title]").textContent = property.title;
  document.querySelector("[data-detail-region]").textContent = propertyLocation(property);
  document.querySelector("[data-detail-price]").textContent = formatPrice(property.price);
  document.querySelector("[data-detail-description]").textContent = property.description;

  const facts = [
    ["Quartos", property.bedrooms],
    ["Banheiros", property.bathrooms],
    ["Vagas", property.parking_spaces],
    ["Área", property.area_sqm === null ? null : `${property.area_sqm} m²`]
  ];
  const factsList = document.querySelector("[data-detail-facts]");
  factsList.replaceChildren();
  facts.filter(([, value]) => value !== null && value !== undefined).forEach(([label, value]) => {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    item.append(term, description);
    factsList.append(item);
  });

  const featureList = document.querySelector("[data-detail-features]");
  featureList.replaceChildren();
  (property.features || []).forEach((feature) => {
    const item = document.createElement("li");
    item.textContent = feature;
    featureList.append(item);
  });
  document.title = `${property.title} | Larimar Prime Imóveis`;
  document.querySelector('meta[name="description"]').content =
    `${property.title} em ${propertyLocation(property)}. ${property.description.slice(0, 130)}`;
  const message = `Olá! Tenho interesse no imóvel: ${property.title} (${propertyLocation(property)}).`;
  document.querySelector("[data-detail-whatsapp]").href =
    `https://wa.me/5511947216091?text=${encodeURIComponent(message)}`;
  setDetailVisibility(true);
}

async function loadPropertyDetail() {
  if (!document.querySelector("[data-property-detail]")) return;
  setDetailVisibility(false);
  renderDetailStatus("Carregando anúncio...", false);

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    renderDetailStatus("Este anúncio não está disponível.");
    return;
  }

  try {
    const supabase = await getPublicSupabase();
    const { data: property, error } = await supabase
      .from("properties")
      .select(propertyFields)
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!property) {
      renderDetailStatus("Este anúncio não está disponível ou foi removido.");
      return;
    }

    const imagePaths = orderedGallery(property).map((image) => image.path);
    const imageUrls = await createImageUrlMap(supabase, imagePaths);
    if (imageUrls.size !== new Set(imagePaths).size) {
      throw new Error("Uma ou mais fotos deste anúncio não estão disponíveis.");
    }
    renderPropertyDetail(property, imageUrls);
  } catch (error) {
    renderDetailStatus(`Não foi possível carregar este anúncio. ${error.message}`, true);
  }
}

loadCatalog();
loadPropertyDetail();
