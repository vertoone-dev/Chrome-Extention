/**
 * @module exporter
 * Export logic for GuideSnap guides — HTML slideshow, PDF, and JSON.
 */

/**
 * Exports a guide as a self-contained HTML slideshow string.
 * The HTML embeds all screenshots as base64, includes dark theme styling,
 * keyboard navigation, lightbox, and responsive design.
 * @param {import('./guide-model.js').Guide} guide - The guide to export
 * @returns {string} Complete HTML document as a string
 */
export function exportAsHTML(guide) {
  if (!guide || !guide.steps?.length) {
    throw new Error('exportAsHTML: guide must have at least one step');
  }

  const slidesJSON = JSON.stringify(
    guide.steps.map((step, i) => ({
      index: i,
      screenshot: step.screenshotDataUrl,
      description: step.description || `Step ${i + 1}`,
      meta: step.meta || {},
    }))
  );

  const escapedTitle = escapeHtml(guide.title || 'Untitled Guide');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapedTitle} — GuideSnap</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#0f0f0f;color:#fff;overflow:hidden}
.gs-container{display:flex;flex-direction:column;height:100vh;position:relative}
.gs-header{padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #222}
.gs-header h1{font-size:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
.gs-counter{font-size:14px;color:#888;font-variant-numeric:tabular-nums}
.gs-slide-area{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:24px}
.gs-slide{position:absolute;opacity:0;transform:scale(.96) translateY(12px);transition:opacity .4s ease,transform .4s ease;display:flex;flex-direction:column;align-items:center;max-width:90%;max-height:90%}
.gs-slide.active{opacity:1;transform:scale(1) translateY(0);z-index:1}
.gs-slide img{max-width:100%;max-height:65vh;border-radius:8px;cursor:zoom-in;box-shadow:0 4px 24px rgba(0,0,0,.5);object-fit:contain}
.gs-description{margin-top:16px;font-size:15px;color:#ccc;text-align:center;max-width:700px;line-height:1.5}
.gs-controls{padding:16px 24px;display:flex;align-items:center;justify-content:center;gap:16px;border-top:1px solid #222}
.gs-btn{background:#1e1e1e;color:#fff;border:1px solid #333;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;transition:background .2s,border-color .2s}
.gs-btn:hover{background:#2a2a2a;border-color:#555}
.gs-btn:disabled{opacity:.3;cursor:default}
.gs-watermark{position:fixed;bottom:8px;right:12px;font-size:11px;color:#333;pointer-events:none;user-select:none}
/* Lightbox */
.gs-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center;z-index:100;cursor:zoom-out}
.gs-lightbox.open{display:flex}
.gs-lightbox img{max-width:96vw;max-height:96vh;border-radius:6px;object-fit:contain}
/* Responsive */
@media(max-width:600px){
  .gs-header h1{font-size:15px}
  .gs-slide img{max-height:55vh}
  .gs-btn{padding:8px 18px;font-size:13px}
}
</style>
</head>
<body>
<div class="gs-container">
  <div class="gs-header">
    <h1>${escapedTitle}</h1>
    <span class="gs-counter" id="counter"></span>
  </div>
  <div class="gs-slide-area" id="slideArea"></div>
  <div class="gs-controls">
    <button class="gs-btn" id="prevBtn">&#8592; Prev</button>
    <button class="gs-btn" id="nextBtn">Next &#8594;</button>
  </div>
  <span class="gs-watermark">Made with GuideSnap</span>
</div>
<div class="gs-lightbox" id="lightbox"><img id="lightboxImg" src="" alt="zoom"></div>

<script>
(function(){
  var slides=${slidesJSON};
  var current=0;
  var area=document.getElementById('slideArea');
  var counter=document.getElementById('counter');
  var prevBtn=document.getElementById('prevBtn');
  var nextBtn=document.getElementById('nextBtn');
  var lightbox=document.getElementById('lightbox');
  var lightboxImg=document.getElementById('lightboxImg');

  function render(){
    area.innerHTML='';
    slides.forEach(function(s,i){
      var div=document.createElement('div');
      div.className='gs-slide'+(i===current?' active':'');
      var img=document.createElement('img');
      img.src=s.screenshot;
      img.alt='Step '+(i+1);
      img.addEventListener('click',function(){lightboxImg.src=s.screenshot;lightbox.classList.add('open');});
      div.appendChild(img);
      if(s.description){
        var desc=document.createElement('div');
        desc.className='gs-description';
        desc.textContent=s.description;
        div.appendChild(desc);
      }
      area.appendChild(div);
    });
    counter.textContent=(current+1)+' / '+slides.length;
    prevBtn.disabled=current===0;
    nextBtn.disabled=current===slides.length-1;
  }

  function go(dir){
    var next=current+dir;
    if(next>=0&&next<slides.length){current=next;render();}
  }

  prevBtn.addEventListener('click',function(){go(-1);});
  nextBtn.addEventListener('click',function(){go(1);});
  lightbox.addEventListener('click',function(){lightbox.classList.remove('open');});

  document.addEventListener('keydown',function(e){
    if(lightbox.classList.contains('open')){
      if(e.key==='Escape')lightbox.classList.remove('open');
      return;
    }
    if(e.key==='ArrowLeft')go(-1);
    else if(e.key==='ArrowRight')go(1);
  });

  render();
})();
</script>
</body>
</html>`;
}

/**
 * Exports a guide as a PDF. Each step becomes a page with its screenshot and description.
 * Dynamically loads jsPDF from a CDN.
 * @param {import('./guide-model.js').Guide} guide - The guide to export
 * @returns {Promise<Blob>} PDF as a Blob
 */
export async function exportAsPDF(guide) {
  if (!guide || !guide.steps?.length) {
    throw new Error('exportAsPDF: guide must have at least one step');
  }

  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 30;

  for (let i = 0; i < guide.steps.length; i++) {
    if (i > 0) doc.addPage();

    const step = guide.steps[i];

    // Title bar
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Step badge
    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text(`Step ${i + 1} of ${guide.steps.length}`, margin, margin);

    // Screenshot
    if (step.screenshotDataUrl) {
      try {
        const imgProps = doc.getImageProperties(step.screenshotDataUrl);
        const maxImgWidth = pageWidth - margin * 2;
        const maxImgHeight = pageHeight - margin * 2 - 60;
        const ratio = Math.min(maxImgWidth / imgProps.width, maxImgHeight / imgProps.height);
        const imgW = imgProps.width * ratio;
        const imgH = imgProps.height * ratio;
        const imgX = (pageWidth - imgW) / 2;
        doc.addImage(step.screenshotDataUrl, 'PNG', imgX, margin + 20, imgW, imgH);
      } catch {
        doc.setFontSize(11);
        doc.setTextColor(255, 100, 100);
        doc.text('[Screenshot could not be embedded]', margin, margin + 40);
      }
    }

    // Description
    if (step.description) {
      doc.setFontSize(11);
      doc.setTextColor(200, 200, 200);
      const lines = doc.splitTextToSize(step.description, pageWidth - margin * 2);
      doc.text(lines, margin, pageHeight - margin);
    }
  }

  // Watermark on last page
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Made with GuideSnap', pageWidth - margin - 80, pageHeight - 10);

  return doc.output('blob');
}

/**
 * Exports the full guide as a JSON string.
 * @param {import('./guide-model.js').Guide} guide
 * @returns {string} JSON string
 */
export function exportAsJSON(guide) {
  if (!guide) {
    throw new Error('exportAsJSON: guide is required');
  }
  return JSON.stringify(guide, null, 2);
}

/**
 * Imports a guide from a JSON string.
 * @param {string} jsonString - JSON representation of a guide
 * @returns {import('./guide-model.js').Guide} Parsed guide object
 */
export function importFromJSON(jsonString) {
  let guide;
  try {
    guide = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`importFromJSON: invalid JSON – ${err.message}`);
  }

  if (!guide || typeof guide.id !== 'string' || !Array.isArray(guide.steps)) {
    throw new Error('importFromJSON: JSON does not match the expected guide schema');
  }

  return guide;
}

/**
 * Triggers a file download in the browser.
 * @param {string|Blob} content - File content (string or Blob)
 * @param {string} filename - Suggested file name
 * @param {string} mimeType - MIME type for the download
 */
export function downloadFile(content, filename, mimeType) {
  let blob;
  if (content instanceof Blob) {
    blob = content;
  } else {
    blob = new Blob([content], { type: mimeType });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Dynamically loads jsPDF from a CDN and returns the jsPDF constructor.
 * @returns {Promise<Function>} jsPDF constructor
 */
async function loadJsPDF() {
  // Return cached if already loaded
  if (typeof globalThis.jspdf !== 'undefined' && globalThis.jspdf.jsPDF) {
    return globalThis.jspdf.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
    script.onload = () => {
      if (globalThis.jspdf?.jsPDF) {
        resolve(globalThis.jspdf.jsPDF);
      } else {
        reject(new Error('jsPDF loaded but constructor not found'));
      }
    };
    script.onerror = () =>
      reject(new Error('Failed to load jsPDF from CDN. Check network connectivity.'));
    document.head.appendChild(script);
  });
}

/**
 * Escapes HTML special characters to prevent injection.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}
