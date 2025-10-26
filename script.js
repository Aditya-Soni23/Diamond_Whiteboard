// script.js - fixed, final version (drawing, touch, paste, resize mode, save/restore)
window.addEventListener('DOMContentLoaded', () => {
  const { jsPDF } = window.jspdf;

  // elements
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const slidesPanel = document.getElementById('slidesPanel');
  const toolbar = document.querySelector('.toolbar');

  // ensure required toolbar buttons exist
  const pasteBtn = document.getElementById('paste');
  const resizeBtn = document.getElementById('resizeBtn');

  // sizing
  function setCanvasSize() {
    const sidebarWidth = slidesPanel ? slidesPanel.offsetWidth || 130 : 130;
    const toolbarHeight = toolbar ? toolbar.offsetHeight || 60 : 60;
    canvas.width = Math.max(300, window.innerWidth - sidebarWidth);
    canvas.height = Math.max(200, window.innerHeight - toolbarHeight);
  }
  setCanvasSize();
  window.addEventListener('resize', () => {
    // preserve slides but redraw current
    setCanvasSize();
    slides.forEach(s => {
      // ensure slide canvases match size for consistent export
      const temp = document.createElement('canvas');
      temp.width = canvas.width;
      temp.height = canvas.height;
      const tctx = temp.getContext('2d');
      tctx.fillStyle = '#fff';
      tctx.fillRect(0, 0, temp.width, temp.height);
      tctx.drawImage(s, 0, 0, temp.width, temp.height);
      // replace slide content
      s.width = temp.width;
      s.height = temp.height;
      s.getContext('2d').clearRect(0, 0, s.width, s.height);
      s.getContext('2d').drawImage(temp, 0, 0);
    });
    loadSlide(currentSlide);
    updateSlideThumbnails();
  });

  // state
  let drawing = false;
  let erasing = false;
  let currentColor = '#000';
  let penSize = 3;

  let slides = [];
  let currentSlide = 0;

  // paste/resize image overlay state
  let pastedImage = null; // { img, x, y, w, h }
  let resizeMode = false;
  let draggingOverlay = false;
  let resizingOverlay = false;
  let overlayDragOffset = { x: 0, y: 0 };
  const handleSize = 16; // red square size

  // cursor-dot (desktop)
  const cursorDot = document.createElement('div');
  cursorDot.className = 'cursor-dot';
  document.body.appendChild(cursorDot);
  function updateCursor(x, y) {
    if ('ontouchstart' in window) {
      cursorDot.style.display = 'none';
      return;
    }
    cursorDot.style.left = x + 'px';
    cursorDot.style.top = y + 'px';
    cursorDot.style.background = erasing ? 'red' : currentColor;
    cursorDot.style.width = erasing ? '25px' : penSize + 'px';
    cursorDot.style.height = erasing ? '25px' : penSize + 'px';
    cursorDot.style.display = 'block';
  }
  document.addEventListener('mousemove', e => updateCursor(e.clientX, e.clientY));
  document.addEventListener('touchmove', e => {
    if (e.touches && e.touches[0]) updateCursor(e.touches[0].clientX, e.touches[0].clientY);
  });

  // ---------- slide helpers ----------
  function createBlankSlide() {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const cctx = c.getContext('2d');
    cctx.fillStyle = '#fff';
    cctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function saveSlidesToLocalStorage() {
    try {
      const arr = slides.map(s => s.toDataURL('image/png'));
      localStorage.setItem('whiteboardSlides', JSON.stringify(arr));
      localStorage.setItem('whiteboardCurrentSlide', String(currentSlide));
    } catch (err) {
      console.warn('save error', err);
    }
  }

  function loadSlidesFromLocalStorage() {
    try {
      const raw = JSON.parse(localStorage.getItem('whiteboardSlides') || '[]');
      if (!raw || raw.length === 0) {
        slides = [createBlankSlide()];
        currentSlide = 0;
        return;
      }
      slides = raw.map(dataUrl => {
        const s = document.createElement('canvas');
        s.width = canvas.width;
        s.height = canvas.height;
        const sctx = s.getContext('2d');
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
          sctx.clearRect(0, 0, s.width, s.height);
          sctx.drawImage(img, 0, 0, s.width, s.height);
          if (slides.indexOf(s) === currentSlide) loadSlide(currentSlide);
        };
        return s;
      });
      currentSlide = parseInt(localStorage.getItem('whiteboardCurrentSlide') || '0', 10) || 0;
      if (currentSlide < 0 || currentSlide >= slides.length) currentSlide = 0;
    } catch (err) {
      slides = [createBlankSlide()];
      currentSlide = 0;
      console.warn('load error', err);
    }
  }

  function saveCurrentSlide(bakeOverlay = true) {
    // if overlay exists and bakeOverlay true, draw overlay onto main canvas then onto slide
    if (bakeOverlay && pastedImage) {
      // draw slide -> overlay onto main canvas then copy into slide
      drawAll(); // draw both slide and overlay onto visible canvas
      const target = slides[currentSlide];
      const tctx = target.getContext('2d');
      tctx.clearRect(0, 0, target.width, target.height);
      tctx.drawImage(canvas, 0, 0);
      // clear overlay
      pastedImage = null;
      resizeMode = false;
      saveSlidesToLocalStorage();
      updateSlideThumbnails();
      return;
    }
    // otherwise just copy main canvas to slide
    const target = slides[currentSlide];
    const tctx = target.getContext('2d');
    tctx.clearRect(0, 0, target.width, target.height);
    tctx.drawImage(canvas, 0, 0);
    saveSlidesToLocalStorage();
    updateSlideThumbnails();
  }

  function loadSlide(index) {
    if (!slides[index]) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(slides[index], 0, 0);
    // clear overlay when switching slides
    pastedImage = null;
    resizeMode = false;
    updateSlideThumbnails();
  }

  function updateSlideThumbnails() {
    if (!slidesPanel) return;
    slidesPanel.innerHTML = '';
    slides.forEach((s, i) => {
      const thumb = document.createElement('canvas');
      thumb.width = 120;
      thumb.height = 90;
      const tctx = thumb.getContext('2d');
      tctx.clearRect(0, 0, thumb.width, thumb.height);
      tctx.drawImage(s, 0, 0, thumb.width, thumb.height);
      thumb.className = 'slide-thumb';
      if (i === currentSlide) thumb.classList.add('active');
      thumb.addEventListener('click', () => {
        saveCurrentSlide();
        currentSlide = i;
        loadSlide(i);
      });
      slidesPanel.appendChild(thumb);
    });
  }

  // ---------- drawing ----------
  function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDrawingAt(pos) {
    if (resizeMode) return; // don't draw when in resize mode
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function stopDrawing() {
    if (!drawing) return;
    drawing = false;
    ctx.beginPath();
    saveCurrentSlide(); // saves what user drew into slide
  }

  function drawMove(pos) {
    if (!drawing) return;
    ctx.lineWidth = erasing ? 25 : penSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = erasing ? '#fff' : currentColor;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  // ---------- overlay & drawAll ----------
  function drawAll() {
    // draw base slide to main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(slides[currentSlide], 0, 0);

    // draw overlay if present
    if (pastedImage) {
      ctx.drawImage(pastedImage.img, pastedImage.x, pastedImage.y, pastedImage.w, pastedImage.h);

      if (resizeMode) {
        // cyan border
        ctx.strokeStyle = 'cyan';
        ctx.lineWidth = 2;
        ctx.strokeRect(pastedImage.x, pastedImage.y, pastedImage.w, pastedImage.h);
        // red resize handle bottom-right
        ctx.fillStyle = 'red';
        ctx.fillRect(pastedImage.x + pastedImage.w - handleSize, pastedImage.y + pastedImage.h - handleSize, handleSize, handleSize);
      }
    }
  }

  // ---------- paste handling ----------
 // modern clipboard + mobile file picker
async function pasteFromClipboardButton() {
  // desktop: Async Clipboard API supported?
  if (navigator.clipboard && navigator.clipboard.read) {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            await insertPastedBlob(blob);
            return;
          }
        }
      }
      alert('No image found in clipboard.');
    } catch (err) {
      console.error('paste read error', err);
      alert('Permission denied or not supported — try selecting image from device.');
      openFilePicker();
    }
  } else {
    // fallback: mobile or unsupported browser → file picker
    openFilePicker();
  }
}

// file picker fallback
function openFilePicker() {
  let fileInput = document.getElementById('filePicker');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.id = 'filePicker';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }

  fileInput.click();

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (file) {
      await insertPastedBlob(file);
    }
    fileInput.value = ''; // reset for next time
  };
}

// same as your original function
async function insertPastedBlob(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    // place image centered-ish
    const maxW = Math.min(400, img.width);
    const aspect = img.width / img.height;
    const w = maxW;
    const h = Math.round(w / aspect);
    pastedImage = {
      img,
      x: 80,
      y: 80,
      w,
      h
    };
    resizeMode = true; // open in resize mode automatically
    drawAll();
    URL.revokeObjectURL(url);
    // ensure button shows Finish state if exists
    if (resizeBtn) resizeBtn.textContent = '✅ Finish Resizing';
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('Could not load pasted image.');
  };
  img.src = url;
}

// legacy paste (Ctrl+V)
window.addEventListener('paste', ev => {
  const items = ev.clipboardData?.items || [];
  for (const it of items) {
    if (it.type && it.type.indexOf('image') !== -1) {
      const f = it.getAsFile();
      if (f) insertPastedBlob(f);
      return;
    }
  }
});


  // ---------- overlay interaction (mouse/touch) ----------
  function overlayHitTest(x, y) {
    if (!pastedImage) return null;
    const p = pastedImage;
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return p;
    return null;
  }
  function overHandleTest(p, x, y) {
    if (!p) return false;
    return x >= p.x + p.w - handleSize && x <= p.x + p.w && y >= p.y + p.h - handleSize && y <= p.y + p.h;
  }

  canvas.addEventListener('mousedown', e => {
    const pos = getCanvasCoords(e.clientX, e.clientY);
    // overlay interactions take precedence
    if (pastedImage && resizeMode) {
      if (overHandleTest(pastedImage, pos.x, pos.y)) {
        resizingOverlay = true;
        return;
      }
      const hit = overlayHitTest(pos.x, pos.y);
      if (hit) {
        draggingOverlay = true;
        overlayDragOffset.x = pos.x - pastedImage.x;
        overlayDragOffset.y = pos.y - pastedImage.y;
        return;
      }
    }
    // normal drawing start
    startDrawingAt(pos);
  });

  canvas.addEventListener('mousemove', e => {
    const pos = getCanvasCoords(e.clientX, e.clientY);
    updateCursor(e.clientX, e.clientY);

    // overlay interactions
    if (draggingOverlay && pastedImage) {
      pastedImage.x = pos.x - overlayDragOffset.x;
      pastedImage.y = pos.y - overlayDragOffset.y;
      drawAll();
      return;
    }
    if (resizingOverlay && pastedImage) {
      pastedImage.w = Math.max(20, pos.x - pastedImage.x);
      pastedImage.h = Math.max(20, pos.y - pastedImage.y);
      drawAll();
      return;
    }
    // otherwise drawing
    drawMove(pos);
  });

  function endPointerAction() {
    if (draggingOverlay || resizingOverlay) {
      draggingOverlay = false;
      resizingOverlay = false;
      // don't bake yet, wait for user to click Finish Resizing
      drawAll();
      return;
    }
    stopDrawing();
  }
  canvas.addEventListener('mouseup', endPointerAction);
  canvas.addEventListener('mouseleave', endPointerAction);

  // touch equivalents
  canvas.addEventListener('touchstart', ev => {
    ev.preventDefault();
    const t = ev.touches[0];
    const pos = getCanvasCoords(t.clientX, t.clientY);
    // use same logic as mousedown
    if (pastedImage && resizeMode) {
      if (overHandleTest(pastedImage, pos.x, pos.y)) {
        resizingOverlay = true;
        return;
      }
      if (overlayHitTest(pos.x, pos.y)) {
        draggingOverlay = true;
        overlayDragOffset.x = pos.x - pastedImage.x;
        overlayDragOffset.y = pos.y - pastedImage.y;
        return;
      }
    }
    startDrawingAt(pos);
  }, { passive: false });

  canvas.addEventListener('touchmove', ev => {
    ev.preventDefault();
    const t = ev.touches[0];
    const pos = getCanvasCoords(t.clientX, t.clientY);
    if (draggingOverlay && pastedImage) {
      pastedImage.x = pos.x - overlayDragOffset.x;
      pastedImage.y = pos.y - overlayDragOffset.y;
      drawAll();
      return;
    }
    if (resizingOverlay && pastedImage) {
      pastedImage.w = Math.max(20, pos.x - pastedImage.x);
      pastedImage.h = Math.max(20, pos.y - pastedImage.y);
      drawAll();
      return;
    }
    drawMove(pos);
  }, { passive: false });

  canvas.addEventListener('touchend', ev => {
    ev.preventDefault();
    endPointerAction();
  }, { passive: false });

  // ---------- Resize button behavior ----------
  if (resizeBtn) {
    resizeBtn.addEventListener('click', () => {
      if (!pastedImage) {
        alert('Paste an image first (Ctrl+V or Paste) to resize it.');
        return;
      }
      if (!resizeMode) {
        resizeMode = true;
        resizeBtn.textContent = '✅ Finish Resizing';
        drawAll();
        return;
      } else {
        // finish: bake overlay into slide and clear overlay
        saveCurrentSlide(true); // bake overlay
        resizeMode = false;
        pastedImage = null;
        resizeBtn.textContent = '📏 Resize';
        loadSlide(currentSlide);
        updateSlideThumbnails();
      }
    });
  }

  // ---------- other toolbar hookups ----------
  const colorPicker = document.getElementById('colorPicker');
  if (colorPicker) colorPicker.addEventListener('input', e => { currentColor = e.target.value; erasing = false; });

  const penSizeInput = document.getElementById('penSize');
  if (penSizeInput) penSizeInput.addEventListener('input', e => { penSize = +e.target.value; });

  const eraseBtn = document.getElementById('erase');
  if (eraseBtn) eraseBtn.addEventListener('click', () => { erasing = !erasing; eraseBtn.innerText = erasing ? '✏️ Pen' : '🩹 Eraser'; });

  const clearBtn = document.getElementById('clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    // clear visible and stored
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = slides[currentSlide];
    s.getContext('2d').clearRect(0, 0, s.width, s.height);
    pastedImage = null;
    resizeMode = false;
    saveSlidesToLocalStorage();
    updateSlideThumbnails();
  });

  const newSlideBtn = document.getElementById('newSlide');
  if (newSlideBtn) newSlideBtn.addEventListener('click', () => {
    saveCurrentSlide(true);
    slides.push(createBlankSlide());
    currentSlide = slides.length - 1;
    loadSlide(currentSlide);
    updateSlideThumbnails();
  });

  const pdfBtn = document.getElementById('downloadPDF');
  if (pdfBtn) pdfBtn.addEventListener('click', () => {
    saveCurrentSlide(true);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
    slides.forEach((s, i) => {
      const img = s.toDataURL('image/png');
      if (i > 0) pdf.addPage();
      pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height);
    });
    pdf.save('My_Whiteboard.pdf');
  });

  // paste button hookup
  if (pasteBtn) pasteBtn.addEventListener('click', pasteFromClipboardButton);

  // ---------- init load ----------
  loadSlidesFromLocalStorage();
  loadSlide(currentSlide);
  updateSlideThumbnails();
  drawAll();
});
