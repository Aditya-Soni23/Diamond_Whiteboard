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

document.addEventListener('mousemove', (e) => {
  cursorDot.style.left = e.clientX + 'px';
  cursorDot.style.top = e.clientY + 'px';
  cursorDot.style.background = erasing ? 'red' : currentColor;
  cursorDot.style.width = erasing ? '25px' : penSize + 'px';
  cursorDot.style.height = erasing ? '25px' : penSize + 'px';
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
  slideCtx.clearRect(0, 0, slideCanvas.width, slideCanvas.height); // ensure clean save
  slideCtx.drawImage(canvas, 0, 0);
  updateSlideThumbnails();
}

function loadSlide(index) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(slides[index], 0, 0);
}

function startPosition(e) {
  drawing = true;
  draw(e);
}

function endPosition() {
  drawing = false;
  ctx.beginPath();
  saveCurrentSlide();
}

function draw(e) {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.lineWidth = erasing ? 25 : penSize;
  ctx.lineCap = 'round';
  ctx.strokeStyle = erasing ? '#fff' : currentColor;

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
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

// ✅ Clear current slide properly
document.getElementById('clear').addEventListener('click', () => {
  // Clear main canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Clear stored slide in memory
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

  pdf.save('My_Whiteboard.pdf');
});

// Mouse drawing events
canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mousemove', draw);

// Initialize first slide preview
updateSlideThumbnails();
