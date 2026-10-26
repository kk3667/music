const images = [1,2,3,4,5,6].map(n => `images/${n}.png`);
let index = 0;

const img = document.getElementById("albumImage");
const current = document.getElementById("current");
const dots = document.getElementById("dots");
const viewer = document.getElementById("viewer");
const lightbox = document.getElementById("lightbox");
const zoomImage = document.getElementById("zoomImage");

// Preload every image immediately. With only six images, this keeps page turns fast.
const cache = images.map(src => {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  return image;
});

images.forEach((_, i) => {
  const dot = document.createElement("button");
  dot.className = "dot" + (i === 0 ? " active" : "");
  dot.type = "button";
  dot.setAttribute("aria-label", `Go to image ${i + 1}`);
  dot.addEventListener("click", () => show(i));
  dots.appendChild(dot);
});

function show(i) {
  index = (i + images.length) % images.length;
  img.src = images[index];
  img.alt = `Album image ${index + 1}`;
  current.textContent = index + 1;
  document.querySelectorAll(".dot").forEach((d, n) => d.classList.toggle("active", n === index));
}

document.getElementById("prev").onclick = () => show(index - 1);
document.getElementById("next").onclick = () => show(index + 1);

document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") show(index - 1);
  if (e.key === "ArrowRight") show(index + 1);
  if (e.key === "Escape") closeLightbox();
});

img.addEventListener("click", () => openLightbox());

document.getElementById("close").onclick = closeLightbox;
lightbox.addEventListener("click", e => {
  if (e.target === lightbox) closeLightbox();
});

function openLightbox() {
  zoomImage.src = images[index];
  lightbox.classList.add("show");
  resetZoom();
}

function closeLightbox() {
  lightbox.classList.remove("show");
  resetZoom();
}

// ---------- Main viewer swipe ----------
let startX = 0, startY = 0;
viewer.addEventListener("touchstart", e => {
  if (e.touches.length !== 1) return;
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, {passive:true});

viewer.addEventListener("touchend", e => {
  if (!startX) return;
  const dx = e.changedTouches[0].clientX - startX;
  const dy = e.changedTouches[0].clientY - startY;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
    dx < 0 ? show(index + 1) : show(index - 1);
  }
  startX = startY = 0;
}, {passive:true});

// ---------- Zoom + pan ----------
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let lastDistance = 0;
let lastCenter = null;
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let startOffsetX = 0;
let startOffsetY = 0;
let tapTimer = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resetZoom() {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  applyTransform();
}

function applyTransform() {
  zoomImage.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
}

function setScale(nextScale, centerX = window.innerWidth / 2, centerY = window.innerHeight / 2) {
  const oldScale = scale;
  scale = clamp(nextScale, 1, 5);

  if (scale === 1) {
    offsetX = 0;
    offsetY = 0;
  } else if (oldScale !== scale) {
    // Keep the point under the fingers/mouse roughly fixed while zooming.
    const factor = scale / oldScale;
    const cx = centerX - window.innerWidth / 2;
    const cy = centerY - window.innerHeight / 2;
    offsetX = cx - (cx - offsetX) * factor;
    offsetY = cy - (cy - offsetY) * factor;
  }
  applyTransform();
}

zoomImage.addEventListener("wheel", e => {
  e.preventDefault();
  const amount = e.deltaY < 0 ? 0.18 : -0.18;
  setScale(scale + amount, e.clientX, e.clientY);
}, {passive:false});

// Double-click / double-tap zoom.
zoomImage.addEventListener("dblclick", e => {
  e.preventDefault();
  setScale(scale > 1 ? 1 : 2.5, e.clientX, e.clientY);
});

lightbox.addEventListener("touchstart", e => {
  if (e.touches.length === 2) {
    const a = e.touches[0], b = e.touches[1];
    lastDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    lastCenter = {x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2};
    dragging = false;
    return;
  }

  if (e.touches.length === 1) {
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
    dragging = scale > 1;
  }
}, {passive:false});

lightbox.addEventListener("touchmove", e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const a = e.touches[0], b = e.touches[1];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const center = {x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2};
    if (lastDistance) {
      setScale(scale * (distance / lastDistance), center.x, center.y);
    }
    lastDistance = distance;
    lastCenter = center;
    return;
  }

  if (e.touches.length === 1 && scale > 1) {
    e.preventDefault();
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    offsetX = startOffsetX + (x - dragStartX);
    offsetY = startOffsetY + (y - dragStartY);
    applyTransform();
  }
}, {passive:false});

lightbox.addEventListener("touchend", e => {
  if (e.touches.length < 2) lastDistance = 0;

  // Swipe to change pages only when not zoomed.
  if (e.changedTouches.length === 1 && scale === 1 && !dragging) {
    const dx = e.changedTouches[0].clientX - dragStartX;
    const dy = e.changedTouches[0].clientY - dragStartY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? show(index + 1) : show(index - 1);
      openLightbox();
    }
  }
  dragging = false;
});

// Mouse drag while zoomed on desktop.
zoomImage.addEventListener("mousedown", e => {
  if (scale <= 1) return;
  e.preventDefault();
  dragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  startOffsetX = offsetX;
  startOffsetY = offsetY;
  zoomImage.classList.add("dragging");
});

window.addEventListener("mousemove", e => {
  if (!dragging || scale <= 1) return;
  offsetX = startOffsetX + e.clientX - dragStartX;
  offsetY = startOffsetY + e.clientY - dragStartY;
  applyTransform();
});

window.addEventListener("mouseup", () => {
  dragging = false;
  zoomImage.classList.remove("dragging");
});

// Prevent browser image dragging.
zoomImage.addEventListener("dragstart", e => e.preventDefault());

show(0);
