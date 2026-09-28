/* FileDrop — client-side drag & drop image uploader (vanilla JS) */

// ---------- Settings ----------
const STORAGE_KEY = "uploadedImages";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif"];

// ---------- Elements ----------
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const browseButton = document.getElementById("browseButton");
const statusMessage = document.getElementById("statusMessage");

const previewBox = document.getElementById("previewBox");
const previewImage = document.getElementById("previewImage");
const previewName = document.getElementById("previewName");
const previewMeta = document.getElementById("previewMeta");
const progressWrap = document.querySelector(".progress");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const imageGrid = document.getElementById("imageGrid");
const emptyState = document.getElementById("emptyState");
const clearAllButton = document.getElementById("clearAllButton");

let uploadTimer = null; // holds the running progress interval

// ---------- Utilities ----------

/** Convert bytes into a readable string: 500 B, 1 KB, 1.5 MB */
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/** "image/png" -> "PNG" */
const getExtensionLabel = (type) => {
  if (type === "image/jpeg") return "JPG";
  if (type === "image/png") return "PNG";
  if (type === "image/gif") return "GIF";
  return "IMAGE";
};

/** Show a message in the status area. type: "error" | "success" | "info" */
const showMessage = (message, type = "info") => {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.hidden = false;
};

const hideMessage = () => {
  statusMessage.hidden = true;
  statusMessage.textContent = "";
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ---------- localStorage ----------

/** Read the stored images safely; resets corrupted data. */
const loadFromLocalStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Stored data was invalid, resetting.", error);
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
    return [];
  }
};

/** Save one image object. Returns true on success. */
const saveToLocalStorage = (image) => {
  try {
    const images = loadFromLocalStorage();
    images.unshift(image);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
    return true;
  } catch (error) {
    console.warn("Could not save image.", error);
    return false;
  }
};

// ---------- Rendering ----------

/** Build one uploaded image card (no innerHTML for user values). */
const createImageCard = (image) => {
  const card = document.createElement("article");
  card.className = "image-card";
  card.dataset.id = image.id;

  const img = document.createElement("img");
  img.src = image.data;
  img.alt = `Uploaded image: ${image.name}`;
  img.loading = "lazy";

  const body = document.createElement("div");
  body.className = "image-card-body";

  const name = document.createElement("p");
  name.className = "image-card-name";
  name.textContent = image.name;

  const meta = document.createElement("p");
  meta.className = "image-card-meta";
  meta.textContent = `${getExtensionLabel(image.type)} • ${formatFileSize(image.size)}`;

  const actions = document.createElement("div");
  actions.className = "image-card-actions";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn-delete";
  deleteButton.dataset.action = "delete";
  deleteButton.textContent = "Delete";

  actions.appendChild(deleteButton);
  body.append(name, meta, actions);
  card.append(img, body);
  return card;
};

/** Redraw the uploaded images grid from localStorage. */
const renderUploadedImages = () => {
  const images = loadFromLocalStorage();
  imageGrid.textContent = "";

  const hasImages = images.length > 0;
  emptyState.hidden = hasImages;
  imageGrid.hidden = !hasImages;
  clearAllButton.hidden = !hasImages;

  images.forEach((image) => imageGrid.appendChild(createImageCard(image)));
};

// ---------- Validation ----------

/** Returns { valid: boolean, error?: string } */
const validateFile = (file) => {
  if (!file) return { valid: false, error: "No file selected." };

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "❌ Invalid file type. Please upload a JPG, PNG, or GIF image." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "❌ File is too large. Maximum allowed size is 5MB." };
  }

  return { valid: true };
};

// ---------- Upload flow ----------

/** Reset the progress UI back to 0%. */
const resetProgress = () => {
  if (uploadTimer) clearInterval(uploadTimer);
  uploadTimer = null;
  progressBar.style.width = "0%";
  progressBar.classList.remove("done");
  progressText.classList.remove("done");
  progressText.textContent = "Uploading...";
  progressWrap.setAttribute("aria-valuenow", "0");
};

/** Animate a fake upload, then persist the image. */
const simulateUpload = (image) => {
  resetProgress();
  let progress = 0;

  uploadTimer = setInterval(() => {
    progress = Math.min(progress + 5, 100);
    progressBar.style.width = `${progress}%`;
    progressWrap.setAttribute("aria-valuenow", String(progress));

    if (progress === 100) {
      clearInterval(uploadTimer);
      uploadTimer = null;

      progressBar.classList.add("done");
      progressText.classList.add("done");
      progressText.textContent = "Upload Complete!";

      const saved = saveToLocalStorage(image);
      if (saved) {
        showMessage("✅ Upload Complete! Your image was saved.", "success");
        renderUploadedImages();
      } else {
        showMessage("Unable to save this image. Browser storage may be full.", "error");
      }
    }
  }, 90);
};

/** Read the file, show the preview, then start the simulated upload. */
const showPreview = (file) => {
  const reader = new FileReader();

  reader.onload = () => {
    const dataUrl = reader.result;

    previewImage.src = dataUrl;
    previewImage.alt = `Preview of ${file.name}`;
    previewName.textContent = file.name;
    previewMeta.textContent = `${getExtensionLabel(file.type)} • ${formatFileSize(file.size)}`;
    previewBox.hidden = false;

    simulateUpload({
      id: createId(),
      name: file.name,
      type: file.type,
      size: file.size,
      data: dataUrl,
    });
  };

  reader.onerror = () => showMessage("❌ Could not read this file. Please try again.", "error");

  reader.readAsDataURL(file);
};

/** Entry point for both the file input and drag & drop. */
const handleFiles = (fileList) => {
  if (!fileList || fileList.length === 0) return; // Case 1: nothing selected

  if (fileList.length > 1) {
    showMessage("Please upload one image at a time.", "error");
    return;
  }

  const file = fileList[0];
  const result = validateFile(file);

  if (!result.valid) {
    previewBox.hidden = true;
    resetProgress();
    showMessage(result.error, "error");
    return;
  }

  hideMessage();
  showMessage("Uploading your image...", "info");
  showPreview(file);
};

// ---------- Delete / clear ----------

const deleteImage = (id) => {
  const images = loadFromLocalStorage().filter((image) => image.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
  } catch (error) {
    console.warn("Could not update storage.", error);
  }
  renderUploadedImages();
};

const clearAllImages = () => {
  const confirmed = confirm("Are you sure you want to delete all uploaded images?");
  if (!confirmed) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear storage.", error);
  }
  renderUploadedImages();
};

// ---------- Events ----------

browseButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (event) => {
  handleFiles(event.target.files);
  fileInput.value = ""; // allow re-selecting the same file
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

dropZone.addEventListener("dragleave", (event) => {
  event.preventDefault();
  if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  handleFiles(event.dataTransfer.files);
});

// Stop the browser from opening files dropped outside the zone
["dragover", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    if (!dropZone.contains(event.target)) event.preventDefault();
  });
});

// Event delegation for dynamically created delete buttons
imageGrid.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="delete"]');
  if (!button) return;
  const card = button.closest(".image-card");
  if (card) deleteImage(card.dataset.id);
});

clearAllButton.addEventListener("click", clearAllImages);

// ---------- Start ----------
renderUploadedImages();
