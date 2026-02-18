// --- Configuración Inicial ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
const CORS_PROXY = "https://corsproxy.io/?"; 

// --- Elementos DOM ---
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const urlInput = document.getElementById("urlInput");
const urlBtn = document.getElementById("urlBtn");

const preview = document.getElementById("preview");
const loadingIndicator = document.getElementById("loading");

const qualityRange = document.getElementById("qualityRange");
const qualityValue = document.getElementById("qualityValue");
const scaleRange = document.getElementById("scaleRange");
const scaleValue = document.getElementById("scaleValue");
const compressToggle = document.getElementById("compressToggle");
const formatSelect = document.getElementById("formatSelect");
const applyBtn = document.getElementById("applyBtn");
const originalSizeLabel = document.getElementById("originalSize");
const compressedSizeLabel = document.getElementById("compressedSize");
const downloadZipBtn = document.getElementById("downloadZip");

let sourceImages = []; // Array: { id, sourceName, canvas, originalSize }
let currentFileName = "archivo";

// --- Eventos UI ---
qualityRange.oninput = () => qualityValue.textContent = qualityRange.value;
scaleRange.oninput = () => scaleValue.textContent = scaleRange.value + "x";

[qualityRange, scaleRange, formatSelect, compressToggle].forEach(el => el.onchange = processImages);
applyBtn.onclick = processImages;

document.getElementById("autoCompress").onclick = () => {
    compressToggle.checked = true;
    formatSelect.value = "image/webp";
    qualityRange.value = 0.7;
    scaleRange.value = 0.8;
    qualityValue.textContent = "0.7";
    scaleValue.textContent = "0.8x";
    processImages();
};

// --- Manejo Archivos Locales ---
dropZone.onclick = () => fileInput.click();
dropZone.ondragover = e => { e.preventDefault(); dropZone.style.background = "#eef"; };
dropZone.ondragleave = () => dropZone.style.background = "#f8fafc";
dropZone.ondrop = e => {
    e.preventDefault();
    dropZone.style.background = "#f8fafc";
    if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
};
fileInput.onchange = e => { if(e.target.files.length) handleFile(e.target.files[0]); };

// --- Manejo URL ---
urlBtn.onclick = async () => {
    const url = urlInput.value.trim();
    if(!url) return alert("Por favor ingresa una URL válida");
    if(!url.startsWith("http")) return alert("La URL debe comenzar con http:// o https://");
    
    currentFileName = "web_" + new URL(url).hostname.replace(/\./g,"_");
    sourceImages = [];
    preview.innerHTML = "";
    downloadZipBtn.style.display = "none";
    loadingIndicator.style.display = "block";
    loadingIndicator.textContent = "🌐 Conectando a la URL...";

    try {
        await extractFromURL(url);
        if (sourceImages.length === 0) {
            alert("No se pudieron extraer imágenes. Es posible que el sitio tenga protecciones.");
            loadingIndicator.style.display = "none";
        } else {
            processImages();
        }
    } catch (err) {
        console.error(err);
        alert("Error al acceder a la URL: " + err.message);
        loadingIndicator.style.display = "none";
    }
};

// --- LOGICA DE EXTRACCIÓN ---

async function handleFile(file) {
    if (!file) return;
    currentFileName = file.name.split('.').slice(0, -1).join('.');
    sourceImages = [];
    preview.innerHTML = "";
    downloadZipBtn.style.display = "none";
    loadingIndicator.style.display = "block";
    
    try {
        const ext = file.name.split('.').pop().toLowerCase();
        loadingIndicator.textContent = "📂 Analizando archivo...";

        if (file.type === 'application/pdf' || ext === 'pdf') {
            await extractFromPDF(file);
        } else if (ext === 'pptx') {
            await extractFromPPTX(file);
        } else if (file.type === 'text/html' || ext === 'html' || ext === 'htm') {
            await extractFromHTMLFile(file);
        } else {
            throw new Error("Formato no soportado");
        }

        if (sourceImages.length === 0) {
            alert("No se encontraron imágenes extraíbles.");
            loadingIndicator.style.display = "none";
        } else {
            processImages();
        }
    } catch (err) {
        alert("Error: " + err.message);
        loadingIndicator.style.display = "none";
    }
}

// 1. PDF - EXTRACTOR PURO (CORREGIDO)
// Ahora busca objetos de imagen (XObjects) en lugar de tomar fotos a la página
// --- 1. PDF - EXTRACTOR PURO (CORREGIDO Y ROBUSTO) ---
async function extractFromPDF(file) {
    loadingIndicator.textContent = "📄 Analizando objetos internos del PDF...";
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(buffer).promise;
    
    let totalImagesFound = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
        try {
            const page = await pdf.getPage(i);
            const ops = await page.getOperatorList();
            
            for (let j = 0; j < ops.fnArray.length; j++) {
                if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject) {
                    const imgName = ops.argsArray[j][0];
                    
                    try {
                        // Intentamos obtener el objeto. Si falla, saltamos al siguiente sin romper el bucle.
                        const imgObj = await page.objs.get(imgName);
                        
                        if (imgObj) {
                            // Caso 1: Imagen ya decodificada por el navegador (JPEGs comunes)
                            if (imgObj.bitmap) {
                                const canvas = document.createElement('canvas');
                                canvas.width = imgObj.width;
                                canvas.height = imgObj.height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(imgObj.bitmap, 0, 0);
                                
                                addImageToQueue(i, totalImagesFound++, canvas);
                            } 
                            // Caso 2: Datos crudos (RAW) - Aquí ocurría el error de "multiple of 4"
                            else if (imgObj.data) {
                                const canvas = normalizeImageData(imgObj);
                                if (canvas) {
                                    addImageToQueue(i, totalImagesFound++, canvas);
                                }
                            }
                        }
                    } catch (innerErr) {
                        // Ignoramos errores de objetos no resueltos para seguir con los demás
                        console.warn(`Saltando objeto dañado en pág ${i}:`, innerErr);
                    }
                }
            }
        } catch (pageErr) {
            console.warn(`Error leyendo página ${i}`, pageErr);
        }
    }
}

// --- FUNCIÓN AUXILIAR PARA CORREGIR COLORES (NUEVA) ---
function normalizeImageData(imgObj) {
    try {
        const width = imgObj.width;
        const height = imgObj.height;
        const rawData = imgObj.data;
        const kind = imgObj.kind || -1; // ImageKind: 1=GRAY, 2=RGB, 3=RGBA

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        let finalData;

        // Validamos el tamaño esperado vs real
        // RGB (3 bytes por pixel)
        if (kind === 2 || rawData.length === width * height * 3) {
            finalData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0, j = 0; i < rawData.length; i += 3, j += 4) {
                finalData[j] = rawData[i];     // R
                finalData[j + 1] = rawData[i + 1]; // G
                finalData[j + 2] = rawData[i + 2]; // B
                finalData[j + 3] = 255;        // Alpha (Opaco)
            }
        } 
        // Grayscale (1 byte por pixel)
        else if (kind === 1 || rawData.length === width * height) {
            finalData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0, j = 0; i < rawData.length; i++, j += 4) {
                finalData[j] = rawData[i];     // R
                finalData[j + 1] = rawData[i]; // G
                finalData[j + 2] = rawData[i]; // B
                finalData[j + 3] = 255;        // Alpha
            }
        }
        // RGBA (4 bytes - Ya compatible)
        else if (kind === 3 || rawData.length === width * height * 4) {
            finalData = new Uint8ClampedArray(rawData);
        } 
        // CMYK u otros formatos raros (Intentamos conversión simple o fallamos)
        else {
            console.warn("Formato de color no soportado automáticamente:", kind, rawData.length);
            return null;
        }

        const imageData = new ImageData(finalData, width, height);
        ctx.putImageData(imageData, 0, 0);
        return canvas;

    } catch (e) {
        console.error("Error normalizando imagen:", e);
        return null;
    }
}

// --- Helper para no repetir código en el loop ---
function addImageToQueue(pageParams, count, canvas) {
    sourceImages.push({
        id: `${pageParams}_${count}`,
        sourceName: `PDF_Pag${pageParams}_Img${count}`,
        canvas: canvas,
        originalSize: estimateSize(canvas.toDataURL()) 
    });
}

// 2. PPTX
async function extractFromPPTX(file) {
    const zip = await JSZip.loadAsync(file);
    let count = 1;
    const mediaFiles = Object.keys(zip.files).filter(path => path.startsWith("ppt/media/"));
    for (const path of mediaFiles) {
        if (zip.files[path].dir) continue;
        const blob = await zip.files[path].async("blob");
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0);
        sourceImages.push({ id: count++, sourceName: path.split("/").pop(), canvas: canvas, originalSize: blob.size });
    }
}

// 3. HTML Archivo Local
async function extractFromHTMLFile(file) {
    const text = await file.text();
    await parseAndExtractImages(text, null); 
}

// 4. URL Web
async function extractFromURL(targetUrl) {
    const proxyUrl = CORS_PROXY + encodeURIComponent(targetUrl);
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`El sitio rechazó la conexión (Status: ${response.status})`);
    const htmlText = await response.text();
    await parseAndExtractImages(htmlText, targetUrl);
}

// Lógica compartida para HTML
async function parseAndExtractImages(htmlContent, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const imgs = doc.querySelectorAll("img");
    let count = 1;
    const uniqueUrls = new Set();

    for (const img of imgs) {
        let src = img.getAttribute("src") || img.getAttribute("data-src"); 
        if (!src) continue;
        src = src.trim();

        let absoluteUrl = src;
        if (baseUrl && !src.startsWith("data:")) {
            try { absoluteUrl = new URL(src, baseUrl).href; } catch (e) { continue; }
        }

        if(uniqueUrls.has(absoluteUrl) || absoluteUrl.endsWith(".svg")) continue;
        uniqueUrls.add(absoluteUrl);

        try {
            loadingIndicator.textContent = `Descargando imagen ${count}...`;
            let cvs = null;
            let size = 0;

            if (absoluteUrl.startsWith("data:")) {
                const imgEl = await loadImage(absoluteUrl);
                cvs = imageToCanvas(imgEl);
                size = estimateSize(absoluteUrl);
            } else if (baseUrl) {
                const proxiedImgUrl = CORS_PROXY + encodeURIComponent(absoluteUrl);
                const resp = await fetch(proxiedImgUrl);
                if(!resp.ok) continue;
                const blob = await resp.blob();
                if(blob.size < 5000) continue; 
                const bitmap = await createImageBitmap(blob);
                cvs = document.createElement("canvas");
                cvs.width = bitmap.width; cvs.height = bitmap.height;
                cvs.getContext("2d").drawImage(bitmap, 0, 0);
                size = blob.size;
            }

            if (cvs) {
                let name = absoluteUrl.split('/').pop().split('?')[0];
                if(name.length > 30) name = "imagen_web_" + count;
                if(!name.includes(".")) name += ".jpg";
                sourceImages.push({ id: count++, sourceName: name, canvas: cvs, originalSize: size });
            }
        } catch (e) { console.warn("Skipping image"); }
    }
}

// --- PROCESAMIENTO ---

async function processImages() {
    if (!sourceImages.length) return;
    loadingIndicator.style.display = "block";
    loadingIndicator.textContent = "⚙️ Optimizando imágenes...";
    
    setTimeout(async () => {
        preview.innerHTML = "";
        let totalOriginal = 0, totalCompressed = 0;
        const zip = new JSZip();
        const config = {
            quality: parseFloat(qualityRange.value),
            scale: parseFloat(scaleRange.value),
            format: formatSelect.value,
            enabled: compressToggle.checked
        };
        const ext = config.format.split("/")[1];

        for (const item of sourceImages) {
            const finalData = compressCanvas(item.canvas, config);
            const finalSize = estimateSize(finalData);
            totalOriginal += item.originalSize;
            totalCompressed += finalSize;
            
            let name = item.sourceName.replace(/\.[^/.]+$/, "") || "imagen";
            const filename = `${name}.${ext}`;
            
            addCard(item, finalData, item.originalSize, finalSize, filename);
            zip.file(filename, finalData.split(",")[1], {base64: true});
        }

        originalSizeLabel.textContent = formatBytes(totalOriginal);
        compressedSizeLabel.textContent = formatBytes(totalCompressed);
        downloadZipBtn.style.display = "block";
        downloadZipBtn.onclick = async () => {
            const content = await zip.generateAsync({type:"blob"});
            const a = document.createElement("a");
            a.href = URL.createObjectURL(content);
            a.download = `${currentFileName}_pack.zip`;
            a.click();
        };
        loadingIndicator.style.display = "none";
    }, 50);
}

function compressCanvas(canvas, cfg) {
    if (!cfg.enabled) return canvas.toDataURL("image/png");
    const w = Math.max(1, Math.floor(canvas.width * cfg.scale));
    const h = Math.max(1, Math.floor(canvas.height * cfg.scale));
    const tCanvas = document.createElement("canvas");
    tCanvas.width = w; tCanvas.height = h;
    const ctx = tCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, w, h);
    return tCanvas.toDataURL(cfg.format, cfg.quality);
}

// --- Helpers ---
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
function imageToCanvas(img) {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return c;
}
function addCard(item, imgData, orig, comp, filename) {
    const savings = orig > 0 ? Math.round((1 - (comp / orig)) * 100) : 0;
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
        <div style="font-weight:bold; font-size:0.9em; margin-bottom:5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${filename}</div>
        <img src="${imgData}">
        <div class="card-info">
            <div>Antes: ${formatBytes(orig)}</div>
            <div>Ahora: <b>${formatBytes(comp)}</b></div>
            <span class="badge ${savings > 0 ? 'badge-green' : 'badge-gray'}">
                ${savings > 0 ? `-${savings}%` : 'Original'}
            </span>
        </div>
        <button class="secondary full-width" onclick="downloadItem('${imgData}', '${filename}')">⬇ Bajar</button>
    `;
    preview.appendChild(div);
}

function downloadItem(url, name){ const a = document.createElement("a"); a.href = url; a.download = name; a.click(); }
function estimateSize(b64) { return Math.round((b64.length * 3) / 4); }
function formatBytes(b) { if(b===0)return'0 B'; const k=1024; const i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+['B','KB','MB','GB'][i]; }