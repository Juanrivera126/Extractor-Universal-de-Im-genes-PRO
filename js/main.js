// --- Configuración Inicial ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
const CORS_PROXIES = [
    "https://corsproxy.io/?",
    "https://api.allorigins.win/raw?url=",
    "https://api.codetabs.com/v1/proxy?quest=",
    "https://proxy.cors.sh/"
];
let currentProxyIndex = 0;

function getProxyUrl(url) {
    return CORS_PROXIES[currentProxyIndex] + encodeURIComponent(url);
}

// --- Elementos DOM ---
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const folderInput = document.getElementById("folderInput"); // Nuevo
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

let sourceImages = []; 
let currentFileName = "extraccion";

// --- Eventos UI ---
qualityRange.oninput = () => qualityValue.textContent = qualityRange.value;
scaleRange.oninput = () => scaleValue.textContent = scaleRange.value + "x";

[qualityRange, scaleRange, formatSelect, compressToggle].forEach(el => el.onchange = processImages);
applyBtn.onclick = processImages;

document.getElementById("autoCompress").onclick = async () => {
    compressToggle.checked = true;
    formatSelect.value = "image/webp";
    qualityRange.value = 0.7;
    scaleRange.value = 0.8;
    qualityValue.textContent = "0.7";
    scaleValue.textContent = "0.8x";
    await processImages();
};

// --- Manejo Archivos y Carpetas ---
dropZone.ondragover = e => { e.preventDefault(); dropZone.style.background = "#eef"; };
dropZone.ondragleave = () => dropZone.style.background = "#f8fafc";
dropZone.ondrop = e => {
    e.preventDefault();
    dropZone.style.background = "#f8fafc";
    if(e.dataTransfer.files.length) handleMultipleFiles(e.dataTransfer.files);
};

fileInput.onchange = e => { if(e.target.files.length) handleMultipleFiles(e.target.files); };
folderInput.onchange = e => { if(e.target.files.length) handleMultipleFiles(e.target.files); };

// Función unificada para manejar archivos (PDF, PPTX, HTML o Imágenes sueltas/carpetas)
async function handleMultipleFiles(files) {
    sourceImages = [];
    preview.innerHTML = "";
    downloadZipBtn.style.display = "none";
    loadingIndicator.style.display = "block";
    loadingIndicator.textContent = "⚙️ Analizando archivos...";

    const fileList = Array.from(files);
    
    // Si es un solo archivo especial, mantenemos el nombre del archivo para el ZIP
    if (fileList.length === 1) {
        currentFileName = fileList[0].name.split('.').slice(0, -1).join('.');
    } else {
        currentFileName = "coleccion_imagenes";
    }

    try {
        for (const file of fileList) {
            const ext = file.name.split('.').pop().toLowerCase();
            
            if (ext === 'pdf') {
                await extractFromPDF(file);
            } else if (ext === 'pptx') {
                await extractFromPPTX(file);
            } else if (ext === 'html' || ext === 'htm') {
                await extractFromHTMLFile(file);
            } else if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
                await processSingleImageFile(file);
            }
        }

        if (sourceImages.length === 0) {
            alert("No se encontraron imágenes válidas.");
            loadingIndicator.style.display = "none";
        } else {
            await processImages();
        }
    } catch (err) {
        alert("Error: " + err.message);
        loadingIndicator.style.display = "none";
    }
}

// --- NUEVA FUNCIÓN: Procesar archivos de imagen directamente (para carpetas/archivos sueltos) ---
async function processSingleImageFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const img = await loadImage(e.target.result);
                const canvas = imageToCanvas(img);
                sourceImages.push({
                    id: Math.random().toString(36).substr(2, 9),
                    sourceName: file.name,
                    canvas: canvas,
                    originalSize: file.size
                });
                resolve();
            } catch (err) {
                console.error("Error cargando imagen:", file.name);
                resolve();
            }
        };
        reader.readAsDataURL(file);
    });
}

// 1. PDF - EXTRACTOR
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
                        const imgObj = await page.objs.get(imgName);
                        
                        if (imgObj) {
                            if (imgObj.bitmap) {
                                const canvas = document.createElement('canvas');
                                canvas.width = imgObj.width;
                                canvas.height = imgObj.height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(imgObj.bitmap, 0, 0);
                                
                                sourceImages.push({
                                    id: `pdf_${i}_${totalImagesFound++}`,
                                    sourceName: `Pag${i}_Img${totalImagesFound}`,
                                    canvas: canvas,
                                    originalSize: estimateSize(canvas.toDataURL()) 
                                });
                            } 
                            else if (imgObj.data) {
                                const canvas = normalizeImageData(imgObj);
                                if (canvas) {
                                    sourceImages.push({
                                        id: `pdf_${i}_${totalImagesFound++}`,
                                        sourceName: `Pag${i}_Img${totalImagesFound}`,
                                        canvas: canvas,
                                        originalSize: estimateSize(canvas.toDataURL()) 
                                    });
                                }
                            }
                        }
                    } catch (innerErr) {
                        console.warn(`Saltando objeto en pág ${i}:`, innerErr);
                    }
                }
            }
        } catch (pageErr) {
            console.warn(`Error leyendo página ${i}`, pageErr);
        }
    }
}

// 2. PPTX - EXTRACTOR
async function extractFromPPTX(file) {
    loadingIndicator.textContent = "📊 Analizando PPTX: " + file.name;
    const zip = await JSZip.loadAsync(file);
    const mediaFiles = Object.keys(zip.files).filter(path => path.startsWith("ppt/media/"));
    
    // Extensiones de imagen soportadas por navegadores comunes
    const supportedExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'];

    for (const path of mediaFiles) {
        if (zip.files[path].dir) continue;
        
        const ext = path.split('.').pop().toLowerCase();
        if (!supportedExts.includes(ext)) {
            console.warn("Saltando formato no soportado en PPTX:", path);
            continue;
        }

        try {
            const blob = await zip.files[path].async("blob");
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            canvas.getContext("2d").drawImage(bitmap, 0, 0);
            sourceImages.push({ 
                id: path, 
                sourceName: path.split("/").pop(), 
                canvas: canvas, 
                originalSize: blob.size 
            });
        } catch (err) {
            console.error("Error decodificando imagen de PPTX:", path, err);
            // Seguimos con la siguiente imagen en lugar de romper todo el proceso
        }
    }
}

// 3. HTML / URL - EXTRACTORES
async function extractFromHTMLFile(file) {
    const text = await file.text();
    await parseAndExtractImages(text, null); 
}

urlBtn.onclick = async () => {
    const url = urlInput.value.trim();
    if(!url) return alert("Ingresa una URL");
    loadingIndicator.style.display = "block";
    loadingIndicator.textContent = "🌐 Conectando con la web...";
    
    async function tryFetch(u) {
        for (let i = 0; i < CORS_PROXIES.length; i++) {
            currentProxyIndex = i;
            try {
                const resp = await fetch(getProxyUrl(u));
                if (resp.ok) return resp;
            } catch (e) {}
        }
        throw new Error("No se pudo conectar con la web a través de ningún proxy.");
    }

    try {
        const resp = await tryFetch(url);
        const html = await resp.text();
        sourceImages = [];
        await parseAndExtractImages(html, url);
        if (sourceImages.length > 0) {
            await processImages();
        } else {
            alert("No se encontraron imágenes procesables en esta URL.");
            loadingIndicator.style.display = "none";
        }
    } catch (e) { 
        alert("Error al extraer de la web: " + e.message); 
        loadingIndicator.style.display="none"; 
    }
};

async function parseAndExtractImages(htmlContent, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const imgs = Array.from(doc.querySelectorAll("img"));
    
    const uniqueSrcs = new Set();
    for(const img of imgs) {
        let src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("srcset");
        if (!src) continue;
        
        if (src.includes(",")) src = src.split(",")[0].split(" ")[0];

        try {
            if (baseUrl && !src.startsWith("data:")) src = new URL(src, baseUrl).href;
            if (!src.endsWith(".svg") && !uniqueSrcs.has(src)) uniqueSrcs.add(src);
        } catch(e) {}
    }

    const srcsArray = Array.from(uniqueSrcs);
    const total = srcsArray.length;
    let count = 0;
    let successfulCount = 0;

    // Función interna para procesar una sola imagen con reintentos
    async function processSingleImage(src) {
        count++;
        loadingIndicator.textContent = `🖼️ Procesando imágenes... (${successfulCount} exitosas de ${total})`;
        
        if (src.startsWith("data:")) {
            try {
                const img = await loadImage(src);
                const cvs = imageToCanvas(img);
                successfulCount++;
                sourceImages.push({
                    id: `web_${Math.random().toString(36).substr(2, 5)}`,
                    sourceName: "web_img",
                    canvas: cvs,
                    originalSize: estimateSize(src)
                });
            } catch(e) {}
            return;
        }

        // Estrategias de descarga: Directa -> Proxy 1 -> Proxy 2 ...
        const strategies = [
            (url) => fetch(url), // Directo (a veces funciona si hay CORS abierto)
            (url) => fetch("https://corsproxy.io/?" + encodeURIComponent(url)),
            (url) => fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(url)),
            (url) => fetch("https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url))
        ];

        for (const strategy of strategies) {
            try {
                const res = await strategy(src);
                if (!res.ok) continue;
                const blob = await res.blob();
                if (blob.size < 4000) return; 
                
                const bitmap = await createImageBitmap(blob);
                const cvs = document.createElement("canvas");
                cvs.width = bitmap.width; cvs.height = bitmap.height;
                cvs.getContext("2d").drawImage(bitmap, 0, 0);
                
                successfulCount++;
                sourceImages.push({ 
                    id: `web_${Math.random().toString(36).substr(2, 5)}`, 
                    sourceName: "web_img", 
                    canvas: cvs, 
                    originalSize: blob.size 
                });
                return; // Éxito, salimos de las estrategias para esta imagen
            } catch (e) {
                // Siguiente estrategia
            }
        }
    }

    // Procesar en paralelo con límite de concurrencia (5 imágenes a la vez)
    const concurrency = 5;
    for (let i = 0; i < srcsArray.length; i += concurrency) {
        if (sourceImages.length >= 100) break; // Límite de seguridad
        const chunk = srcsArray.slice(i, i + concurrency);
        await Promise.all(chunk.map(src => processSingleImage(src)));
    }
}

// --- PROCESAMIENTO Y COMPRESIÓN ---
async function processImages() {
    if (!sourceImages.length) return;
    loadingIndicator.style.display = "block";
    loadingIndicator.textContent = "⚙️ Optimizando imágenes...";
    
    // Pequeño retardo para dejar que el loading indicator se muestre
    await new Promise(r => setTimeout(r, 100));

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

    let processedCount = 0;
    for (const item of sourceImages) {
        processedCount++;
        if (processedCount % 10 === 0) {
            loadingIndicator.textContent = `⚙️ Optimizando ${processedCount} de ${sourceImages.length}...`;
            // Ceder tiempo al hilo principal para no congelar la UI
            await new Promise(r => setTimeout(r, 0));
        }

        const finalData = compressCanvas(item.canvas, config);
        const finalSize = estimateSize(finalData);
        totalOriginal += item.originalSize;
        totalCompressed += finalSize;
        
        let cleanName = item.sourceName.split('.')[0];
        const filename = `${cleanName}_opt.${ext}`;
        
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
        a.download = `${currentFileName}_optimizado.zip`;
        a.click();
    };
    loadingIndicator.style.display = "none";
}

// --- HELPERS ---
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
        if (kind === 2 || rawData.length === width * height * 3) {
            finalData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0, j = 0; i < rawData.length; i += 3, j += 4) {
                finalData[j] = rawData[i];     // R
                finalData[j + 1] = rawData[i + 1]; // G
                finalData[j + 2] = rawData[i + 2]; // B
                finalData[j + 3] = 255;        // Alpha
            }
        } 
        else if (kind === 1 || rawData.length === width * height) {
            finalData = new Uint8ClampedArray(width * height * 4);
            for (let i = 0, j = 0; i < rawData.length; i++, j += 4) {
                finalData[j] = rawData[i];     // R
                finalData[j + 1] = rawData[i]; // G
                finalData[j + 2] = rawData[i]; // B
                finalData[j + 3] = 255;        // Alpha
            }
        }
        else if (kind === 3 || rawData.length === width * height * 4) {
            finalData = new Uint8ClampedArray(rawData);
        } 
        else {
            console.warn("Formato de color no soportado:", kind, rawData.length);
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

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
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
        <button class="secondary full-width" style="margin-top:10px; cursor:pointer;" onclick="downloadItem('${imgData}', '${filename}')">⬇ Bajar</button>
    `;
    preview.appendChild(div);
}

function estimateSize(b64) { return Math.round((b64.length * 3) / 4); }
function formatBytes(b) { 
    if(b===0) return '0 B'; 
    const k=1024; const i=Math.floor(Math.log(b)/Math.log(k)); 
    return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+['B','KB','MB','GB'][i]; 
}

// Función para descargar una sola imagen
function downloadItem(url, name) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}