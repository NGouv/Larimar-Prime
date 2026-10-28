import { createImageUrlMap, formatPrice, getSupabase, propertyLocation } from "./supabase-client.js";

const imageBucket = "property-images";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 10 * 1024 * 1024;
const maxGallerySize = 20;
const propertyFields = "id,title,property_type,purpose,neighborhood,city,state,price,bedrooms,bathrooms,parking_spaces,area_sqm,description,features,gallery,cover_image_path,status,created_at";

const statusElement = document.querySelector("[data-admin-status]");
const loginPanel = document.querySelector("[data-login-panel]");
const passwordResetPanel = document.querySelector("[data-password-reset-panel]");
const dashboard = document.querySelector("[data-dashboard]");
const editor = document.querySelector("[data-editor]");
const propertyForm = document.querySelector("[data-property-form]");
const imageInput = document.querySelector("#property-images");
const imageList = document.querySelector("[data-image-list]");
const saveButton = document.querySelector("[data-save-property]");

let supabase;
let properties = [];
let currentPropertyId = null;
let existingImages = [];
let pendingImages = [];
let coverKey = null;
let isSaving = false;
let passwordRecoveryRequested =
  new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

function showStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("is-error", isError);
}

function clearStatus() {
  showStatus("");
}

function resetImageState() {
  pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  existingImages = [];
  pendingImages = [];
  coverKey = null;
  imageList.replaceChildren();
  imageInput.value = "";
}

function allImages() {
  return [...existingImages, ...pendingImages].sort((first, second) => first.position - second.position);
}

function renderImageList() {
  imageList.replaceChildren();
  allImages().forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "admin-image-item";
    const preview = document.createElement("img");
    preview.src = image.previewUrl;
    preview.alt = image.alt || `Prévia da foto ${index + 1}`;
    preview.loading = "lazy";

    const coverLabel = document.createElement("label");
    const coverRadio = document.createElement("input");
    coverRadio.type = "radio";
    coverRadio.name = "cover-image";
    coverRadio.value = image.key;
    coverRadio.checked = coverKey === image.key;
    coverRadio.addEventListener("change", () => {
      coverKey = image.key;
    });
    coverLabel.append(coverRadio, document.createTextNode("Usar como capa"));

    const reorder = document.createElement("div");
    reorder.className = "admin-image-reorder";
    [
      ["Mover para cima", index - 1],
      ["Mover para baixo", index + 1]
    ].forEach(([label, targetIndex]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = targetIndex < 0 || targetIndex >= allImages().length;
      button.addEventListener("click", () => moveImage(image.key, targetIndex));
      reorder.append(button);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remover foto";
    removeButton.setAttribute("aria-label", `Remover foto ${index + 1}`);
    removeButton.addEventListener("click", () => removeImage(image.key));
    item.append(preview, coverLabel, reorder, removeButton);
    imageList.append(item);
  });
}

function moveImage(key, targetIndex) {
  const images = allImages();
  const currentIndex = images.findIndex((image) => image.key === key);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= images.length) return;
  const [image] = images.splice(currentIndex, 1);
  images.splice(targetIndex, 0, image);
  images.forEach((item, index) => {
    item.position = index;
  });
  existingImages = images.filter((item) => item.path);
  pendingImages = images.filter((item) => item.file);
  renderImageList();
  imageList.querySelectorAll('input[type="radio"]')[targetIndex]?.focus();
}

function removeImage(key) {
  const pending = pendingImages.find((image) => image.key === key);
  if (pending) {
    URL.revokeObjectURL(pending.previewUrl);
    pendingImages = pendingImages.filter((image) => image.key !== key);
  }
  existingImages = existingImages.filter((image) => image.key !== key);
  allImages().forEach((image, index) => {
    image.position = index;
  });
  if (coverKey === key) coverKey = allImages()[0]?.key || null;
  renderImageList();
  imageList.querySelector(".admin-image-item button")?.focus();
}

function addSelectedImages() {
  const files = [...imageInput.files];
  if (!files.length) return;

  const invalidFile = files.find((file) => !allowedTypes.has(file.type) || file.size > maxImageSize);
  if (invalidFile) {
    showStatus("Use apenas imagens JPG, PNG ou WebP de até 10 MB cada.", true);
    imageInput.value = "";
    return;
  }
  if (allImages().length + files.length > maxGallerySize) {
    showStatus(`A galeria permite até ${maxGallerySize} fotos.`, true);
    imageInput.value = "";
    return;
  }

  clearStatus();
  files.forEach((file) => {
    pendingImages.push({
      key: `new-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      alt: "",
      position: allImages().length
    });
  });
  if (!coverKey) coverKey = pendingImages[0]?.key || null;
  imageInput.value = "";
  renderImageList();
}

function resetEditor() {
  propertyForm.reset();
  currentPropertyId = null;
  resetImageState();
  editor.hidden = true;
  dashboard.hidden = false;
  document.querySelector("#editor-title").textContent = "Novo imóvel";
  saveButton.textContent = "Salvar imóvel";
}

function openNewProperty() {
  clearStatus();
  propertyForm.reset();
  currentPropertyId = null;
  resetImageState();
  dashboard.hidden = true;
  editor.hidden = false;
  document.querySelector("#editor-title").textContent = "Novo imóvel";
  saveButton.textContent = "Salvar imóvel";
  document.querySelector("#property-title").focus();
}

async function openEditProperty(property) {
  clearStatus();
  showStatus("Carregando fotos do anúncio...");
  try {
    const imageEntries = Array.isArray(property.gallery) ? property.gallery : [];
    const imageUrls = await createImageUrlMap(supabase, imageEntries.map((image) => image.path));
    if (imageUrls.size !== imageEntries.length) {
      throw new Error("Não foi possível carregar todas as fotos. O anúncio não foi alterado.");
    }
    currentPropertyId = property.id;
    propertyForm.elements.title.value = property.title;
    propertyForm.elements.property_type.value = property.property_type;
    propertyForm.elements.purpose.value = property.purpose;
    propertyForm.elements.neighborhood.value = property.neighborhood;
    propertyForm.elements.city.value = property.city;
    propertyForm.elements.state.value = property.state;
    propertyForm.elements.price.value = property.price ?? "";
    propertyForm.elements.bedrooms.value = property.bedrooms ?? "";
    propertyForm.elements.bathrooms.value = property.bathrooms ?? "";
    propertyForm.elements.parking_spaces.value = property.parking_spaces ?? "";
    propertyForm.elements.area_sqm.value = property.area_sqm ?? "";
    propertyForm.elements.description.value = property.description;
    propertyForm.elements.features.value = (property.features || []).join("\n");
    propertyForm.elements.status.value = property.status;
    resetImageState();
    existingImages = imageEntries
      .filter((image) => imageUrls.has(image.path))
      .map((image, index) => ({
        key: image.path,
        path: image.path,
        alt: image.alt || "",
        previewUrl: imageUrls.get(image.path),
        position: index
      }));
    coverKey = property.cover_image_path || existingImages[0]?.key || null;
    renderImageList();
    dashboard.hidden = true;
    editor.hidden = false;
    document.querySelector("#editor-title").textContent = "Editar imóvel";
    saveButton.textContent = "Salvar alterações";
    document.querySelector("#property-title").focus();
    clearStatus();
  } catch (error) {
    showStatus(`Não foi possível abrir as fotos deste imóvel. ${error.message}`, true);
  }
}

function nullableNumber(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function makePropertyPayload(id, uploadedImages) {
  const data = new FormData(propertyForm);
  const selectedImages = allImages();
  const gallery = selectedImages.map((image) => {
    const path = image.path || uploadedImages.get(image.key);
    return {
      path,
      alt: image.alt || `Foto de ${data.get("title").trim()}`
    };
  });
  const selectedCover = selectedImages.find((image) => image.key === coverKey);

  if (data.get("status") === "published" && (!gallery.length || !selectedCover)) {
    throw new Error("Inclua ao menos uma foto e escolha a imagem de capa para publicar o anúncio.");
  }

  return {
    id,
    title: data.get("title").trim(),
    property_type: data.get("property_type"),
    purpose: data.get("purpose"),
    neighborhood: data.get("neighborhood").trim(),
    city: data.get("city").trim(),
    state: data.get("state").trim().toUpperCase(),
    price: nullableNumber(data.get("price")),
    bedrooms: nullableNumber(data.get("bedrooms")),
    bathrooms: nullableNumber(data.get("bathrooms")),
    parking_spaces: nullableNumber(data.get("parking_spaces")),
    area_sqm: nullableNumber(data.get("area_sqm")),
    description: data.get("description").trim(),
    features: data.get("features").split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    gallery,
    cover_image_path: selectedCover ? selectedCover.path || uploadedImages.get(selectedCover.key) : null,
    status: data.get("status")
  };
}

function safeFileName(name) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}

async function uploadPendingImages(propertyId) {
  const uploadedImages = new Map();
  const uploadedPaths = [];
  for (const image of pendingImages) {
    const path = `${propertyId}/${crypto.randomUUID()}-${safeFileName(image.file.name)}`;
    const { error } = await supabase.storage
      .from(imageBucket)
      .upload(path, image.file, {
        cacheControl: "3600",
        contentType: image.file.type,
        upsert: false
      });
    if (error) {
      if (uploadedPaths.length) {
        const cleanup = await supabase.storage.from(imageBucket).remove(uploadedPaths);
        if (cleanup.error) {
          throw new Error(`O upload falhou (${error.message}) e não foi possível limpar as fotos temporárias (${cleanup.error.message}).`);
        }
      }
      throw new Error(`Não foi possível enviar a foto "${image.file.name}": ${error.message}`);
    }
    uploadedImages.set(image.key, path);
    uploadedPaths.push(path);
  }
  return { uploadedImages, uploadedPaths };
}

async function saveProperty(event) {
  event.preventDefault();
  if (isSaving || !propertyForm.reportValidity()) return;

  const formData = new FormData(propertyForm);
  if (formData.get("status") === "published" &&
      (!allImages().length || !allImages().some((image) => image.key === coverKey))) {
    showStatus("Inclua ao menos uma foto e escolha a imagem de capa para publicar o anúncio.", true);
    return;
  }

  isSaving = true;
  propertyForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = true;
  });
  document.querySelectorAll("[data-cancel-editor]").forEach((button) => {
    button.disabled = true;
  });
  showStatus("Salvando imóvel e fotos...");
  const propertyId = currentPropertyId || crypto.randomUUID();
  let uploadedPaths = [];

  try {
    const uploadResult = await uploadPendingImages(propertyId);
    uploadedPaths = uploadResult.uploadedPaths;
    const payload = makePropertyPayload(propertyId, uploadResult.uploadedImages);
    const result = currentPropertyId
      ? await supabase.from("properties").update(payload).eq("id", propertyId).select("id").single()
      : await supabase.from("properties").insert(payload).select("id").single();

    if (result.error || !result.data) {
      if (uploadedPaths.length) {
        const cleanup = await supabase.storage.from(imageBucket).remove(uploadedPaths);
        if (cleanup.error) {
          throw new Error(`O imóvel não foi salvo (${result.error?.message || "o registro não foi confirmado"}) e não foi possível limpar as fotos enviadas (${cleanup.error.message}).`);
        }
      }
      throw new Error(`Não foi possível salvar o imóvel: ${result.error?.message || "o registro não foi confirmado."}`);
    }

    const keptPaths = new Set(payload.gallery.map((image) => image.path));
    const removedPaths = (properties.find((property) => property.id === propertyId)?.gallery || [])
      .map((image) => image.path)
      .filter((path) => !keptPaths.has(path));

    resetEditor();
    await loadProperties();
    if (removedPaths.length) {
      const { error } = await supabase.storage.from(imageBucket).remove(removedPaths);
      if (error) {
        showStatus(`Imóvel salvo, mas algumas fotos removidas do anúncio ainda permanecem no armazenamento: ${error.message}`, true);
        return;
      }
    }
    showStatus("Imóvel salvo com sucesso.");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    isSaving = false;
    propertyForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = false;
    });
    document.querySelectorAll("[data-cancel-editor]").forEach((button) => {
      button.disabled = false;
    });
  }
}

function makePropertyRow(property) {
  const row = document.createElement("article");
  row.className = "admin-property-row";
  const content = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = property.title;
  const details = document.createElement("p");
  const statusLabel = property.status === "published" ? "Publicado" : "Rascunho";
  details.textContent = `${propertyLocation(property)} · ${formatPrice(property.price)} · ${statusLabel}`;
  content.append(title, details);

  const actions = document.createElement("div");
  actions.className = "admin-property-actions";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "Editar";
  editButton.addEventListener("click", () => openEditProperty(property));

  const publicationButton = document.createElement("button");
  publicationButton.type = "button";
  publicationButton.textContent = property.status === "published" ? "Despublicar" : "Publicar";
  publicationButton.addEventListener("click", () => togglePublication(property));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Excluir";
  deleteButton.addEventListener("click", () => deleteProperty(property));
  actions.append(editButton, publicationButton, deleteButton);
  row.append(content, actions);
  return row;
}

async function loadProperties() {
  showStatus("Atualizando anúncios...");
  const { data, error } = await supabase
    .from("properties")
    .select(propertyFields)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Não foi possível carregar os imóveis: ${error.message}`);

  properties = data || [];
  document.querySelector("[data-total-count]").textContent = String(properties.length);
  document.querySelector("[data-published-count]").textContent =
    String(properties.filter((property) => property.status === "published").length);
  document.querySelector("[data-draft-count]").textContent =
    String(properties.filter((property) => property.status === "draft").length);

  const list = document.querySelector("[data-property-list]");
  list.replaceChildren();
  if (!properties.length) {
    const empty = document.createElement("p");
    empty.className = "catalog-status";
    empty.textContent = "Ainda não há imóveis cadastrados.";
    list.append(empty);
  } else {
    list.append(...properties.map(makePropertyRow));
  }
  clearStatus();
}

async function togglePublication(property) {
  const nextStatus = property.status === "published" ? "draft" : "published";
  if (nextStatus === "published" && (!property.gallery?.length || !property.cover_image_path)) {
    showStatus("Adicione uma foto e escolha a capa antes de publicar este imóvel.", true);
    return;
  }

  showStatus(nextStatus === "published" ? "Publicando imóvel..." : "Despublicando imóvel...");
  try {
    const { data, error } = await supabase
      .from("properties")
      .update({ status: nextStatus })
      .eq("id", property.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("O anúncio não foi encontrado.");
    await loadProperties();
    showStatus(nextStatus === "published" ? "Imóvel publicado." : "Imóvel despublicado.");
  } catch (error) {
    showStatus(`Não foi possível atualizar a publicação: ${error.message}`, true);
  }
}

async function deleteProperty(property) {
  if (!window.confirm(`Excluir o anúncio "${property.title}"? Esta ação não pode ser desfeita.`)) return;

  showStatus("Excluindo anúncio...");
  try {
    const { data, error } = await supabase
      .from("properties")
      .delete()
      .eq("id", property.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("O anúncio não foi encontrado.");

    const paths = (property.gallery || []).map((image) => image.path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(imageBucket).remove(paths);
      if (storageError) {
        await loadProperties();
        showStatus(`Anúncio excluído, mas não foi possível remover todas as fotos: ${storageError.message}`, true);
        return;
      }
    }
    await loadProperties();
    showStatus("Anúncio e fotos excluídos.");
  } catch (error) {
    try {
      await loadProperties();
    } catch (loadError) {
      showStatus(`${error.message} ${loadError.message}`, true);
      return;
    }
    showStatus(`Não foi possível excluir o anúncio: ${error.message}`, true);
  }
}

async function showAuthorizedDashboard(user) {
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    let signOutError;
    try {
      const { error: authError } = await supabase.auth.signOut();
      signOutError = authError;
    } catch (authError) {
      signOutError = authError;
    }
    loginPanel.hidden = false;
    passwordResetPanel.hidden = true;
    dashboard.hidden = true;
    editor.hidden = true;
    const authorizationMessage = error
      ? `Não foi possível verificar a autorização: ${error.message}`
      : "Esta conta não está autorizada a administrar os imóveis.";
    showStatus(
      signOutError
        ? `${authorizationMessage} Não foi possível encerrar a sessão: ${signOutError.message || signOutError}`
        : authorizationMessage,
      true
    );
    return;
  }

  loginPanel.hidden = true;
  passwordResetPanel.hidden = true;
  editor.hidden = true;
  dashboard.hidden = false;
  try {
    await loadProperties();
  } catch (loadError) {
    showStatus(loadError.message, true);
  }
}

async function initialize() {
  try {
    supabase = await getSupabase();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        passwordRecoveryRequested = true;
        showPasswordReset();
      }
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(`Não foi possível verificar a sessão: ${error.message}`);
    if (passwordRecoveryRequested && data.session?.user) {
      showPasswordReset();
      return;
    }
    if (data.session?.user) {
      await showAuthorizedDashboard(data.session.user);
    } else {
      loginPanel.hidden = false;
      passwordResetPanel.hidden = true;
      showStatus(passwordRecoveryRequested
        ? "O link de recuperação expirou ou não é válido. Solicite outro link."
        : "");
    }
  } catch (error) {
    loginPanel.hidden = false;
    passwordResetPanel.hidden = true;
    showStatus(error.message, true);
  }
}

document.querySelector("[data-login-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showStatus("Validando acesso...");
  try {
    supabase ||= await getSupabase();
    const formData = new FormData(form);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.get("email"),
      password: formData.get("password")
    });
    if (error) throw new Error(`Não foi possível entrar: ${error.message}`);
    await showAuthorizedDashboard(data.user);
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("[data-recovery-button]").addEventListener("click", async () => {
  const email = document.querySelector("#login-email").value.trim();
  if (!email) {
    showStatus("Informe seu e-mail para receber o link de recuperação.", true);
    document.querySelector("#login-email").focus();
    return;
  }

  try {
    supabase ||= await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin.html`
    });
    if (error) throw new Error(`Não foi possível solicitar a recuperação: ${error.message}`);
    showStatus("Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.");
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelector("[data-logout]").addEventListener("click", async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    dashboard.hidden = true;
    editor.hidden = true;
    passwordResetPanel.hidden = true;
    loginPanel.hidden = false;
    showStatus("Sessão encerrada.");
  } catch (error) {
    showStatus(`Não foi possível encerrar a sessão: ${error.message}`, true);
  }
});

document.querySelector("[data-password-reset-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const password = formData.get("password");
  if (password !== formData.get("password_confirmation")) {
    showStatus("As senhas informadas não coincidem.", true);
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  showStatus("Atualizando senha...");
  try {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(`Não foi possível atualizar a senha: ${error.message}`);
    form.reset();
    passwordResetPanel.hidden = true;
    await showAuthorizedDashboard(data.user);
    showStatus("Senha atualizada com sucesso.");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

function showPasswordReset() {
  loginPanel.hidden = true;
  dashboard.hidden = true;
  editor.hidden = true;
  passwordResetPanel.hidden = false;
  showStatus("Defina uma senha nova para concluir a recuperação.");
  document.querySelector("#reset-password").focus();
}

document.querySelector("[data-new-property]").addEventListener("click", openNewProperty);
document.querySelectorAll("[data-cancel-editor]").forEach((button) => {
  button.addEventListener("click", resetEditor);
});
imageInput.addEventListener("change", addSelectedImages);
propertyForm.addEventListener("submit", saveProperty);

initialize();
