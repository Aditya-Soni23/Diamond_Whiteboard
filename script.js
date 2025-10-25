const { jsPDF } = window.jspdf;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const slidesPanel = document.getElementById('slidesPanel');

canvas.width = window.innerWidth - 130; 
canvas.height = window.innerHeight - 60; 

let drawing = false;
let erasing = false;
let currentColor = '#000';
let penSize = 3;
let slides = [createNewSlide()];
let currentSlide = 0;

// Custom cursor dot
const cursorDot = document.createElement('div');
cursorDot.classList.add('cursor-dot');
document.body.appendChild(cursorDot);

function updateCursor(x, y) {
  cursorDot.style.left = x + 'px';
  cursorDot.style.top = y + 'px';
  cursorDot.style.background = erasing ? 'red' : currentColor;
  cursorDot.style.width = erasing ? '25px' : penSize + 'px';
  cursorDot.style.height = erasing ? '25px' : penSize + 'px';
}

// Update cursor on mousemove
document.addEventListener('mousemove', (e) => updateCursor(e.clientX, e.clientY));
// Update cursor on touchmove
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    updateCursor(touch.clientX, touch.clientY);
  }
});

function createNewSlide() {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  return c;
}

function saveCurrentSlide() {
  const slideCanvas = slides[currentSlide];
  const slideCtx = slideCanvas.getContext('2d');
  slideCtx.clearRect(0, 0, slideCanvas.width, slideCanvas.height);
  slideCtx.drawImage(canvas, 0, 0);
  updateSlideThumbnails();
}

function loadSlide(index) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(slides[index], 0, 0);
}

function startPosition(x, y) {
  drawing = true;
  draw({ x, y });
}

function endPosition() {
  drawing = false;
  ctx.beginPath();
  saveCurrentSlide();
}

function draw(e) {
  if (!drawing) return;

  const x = e.x;
  const y = e.y;

  ctx.lineWidth = erasing ? 25 : penSize;
  ctx.lineCap = 'round';
  ctx.strokeStyle = erasing ? '#fff' : currentColor;

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function getCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function updateSlideThumbnails() {
  slidesPanel.innerHTML = '';
  slides.forEach((slide, i) => {
    const thumb = document.createElement('canvas');
    thumb.width = 120;
    thumb.height = 90;
    const tctx = thumb.getContext('2d');
    tctx.clearRect(0, 0, thumb.width, thumb.height);
    tctx.drawImage(slide, 0, 0, thumb.width, thumb.height);
    thumb.classList.add('slide-thumb');
    if (i === currentSlide) thumb.classList.add('active');

    thumb.addEventListener('click', () => {
      saveCurrentSlide();
      currentSlide = i;
      loadSlide(i);
      updateSlideThumbnails();
    });

    slidesPanel.appendChild(thumb);
  });
}

// 🎨 Toolbar actions
document.getElementById('colorPicker').addEventListener('input', (e) => {
  currentColor = e.target.value;
  erasing = false;
  document.getElementById('erase').innerText = '🩹 Eraser';
});

document.getElementById('penSize').addEventListener('input', (e) => {
  penSize = e.target.value;
});

document.getElementById('erase').addEventListener('click', () => {
  erasing = !erasing;
  document.getElementById('erase').innerText = erasing ? '✏️ Pen' : '🩹 Eraser';
});

document.getElementById('clear').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const slideCanvas = slides[currentSlide];
  const slideCtx = slideCanvas.getContext('2d');
  slideCtx.clearRect(0, 0, slideCanvas.width, slideCanvas.height);
  updateSlideThumbnails();
});

document.getElementById('newSlide').addEventListener('click', () => {
  saveCurrentSlide();
  slides.push(createNewSlide());
  currentSlide = slides.length - 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateSlideThumbnails();
});

// 📥 Download all slides as PDF
document.getElementById('downloadPDF').addEventListener('click', () => {
  saveCurrentSlide();
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });

  slides.forEach((slide, i) => {
    const imgData = slide.toDataURL('image/png');
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  });

  // Mobile-friendly download
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    const pdfBlob = pdf.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'My_Whiteboard.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    pdf.save('My_Whiteboard.pdf'); // Desktop
  }
});


// 🖌️ Mouse events
canvas.addEventListener('mousedown', (e) => {
  const pos = getCanvasCoords(e.clientX, e.clientY);
  startPosition(pos.x, pos.y);
});
canvas.addEventListener('mousemove', (e) => {
  const pos = getCanvasCoords(e.clientX, e.clientY);
  draw(pos);
});
canvas.addEventListener('mouseup', endPosition);

// 🖐️ Touch events
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = getCanvasCoords(touch.clientX, touch.clientY);
  startPosition(pos.x, pos.y);
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = getCanvasCoords(touch.clientX, touch.clientY);
  draw(pos);
});
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  endPosition();
});

// Initialize first slide preview
updateSlideThumbnails();
