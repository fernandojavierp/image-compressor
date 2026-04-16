document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resultsSection = document.getElementById('results');
    const uploadSection = document.getElementById('drop-zone');
    const resultsGrid = document.getElementById('results-grid');
    const spotlight = document.getElementById('detail-spotlight');
    
    // Stats Summary
    const totalCountLabel = document.getElementById('total-count');
    const totalSavingsLabel = document.getElementById('total-savings-size');
    const avgEfficiencyLabel = document.getElementById('avg-efficiency');

    // Settings elements
    const qualityRange = document.getElementById('quality-range');
    const qualityValue = document.getElementById('quality-value');
    const maxWidthInput = document.getElementById('max-width');
    
    const resetBtn = document.getElementById('reset-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const canvas = document.getElementById('conversion-canvas');
    const ctx = canvas.getContext('2d');

    let isProcessing = false;
    let processedFiles = [];
    let globalStats = {
        count: 0,
        originalTotal: 0,
        compressedTotal: 0
    };

    // Update quality label
    qualityRange.addEventListener('input', (e) => {
        qualityValue.textContent = e.target.value;
    });

    // Click to upload
    dropZone.addEventListener('click', () => !isProcessing && fileInput.click());

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!isProcessing) dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (isProcessing) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleFiles(files);
    });

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) handleFiles(files);
    });

    async function handleFiles(files) {
        const imageFiles = files.filter(f => 
            f.type.startsWith('image/') || 
            /\.(heic|heif|tif|tiff)$/i.test(f.name)
        );
        
        if (imageFiles.length === 0) {
            alert('Por favor, selecciona archivos de imagen válidos.');
            return;
        }

        isProcessing = true;
        uploadSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        const config = {
            quality: parseInt(qualityRange.value) / 100,
            maxWidth: parseInt(maxWidthInput.value) || 1920
        };

        for (const file of imageFiles) {
            await processFile(file, config);
        }

        isProcessing = false;
    }

    async function processFile(file, config) {
        const originalSize = file.size;
        const fileName = file.name;
        const extension = fileName.split('.').pop().toLowerCase();

        try {
            let imageSource;
            let previewSource;

            if (extension === 'heic' || extension === 'heif') {
                // Convert HEIC to JPEG for browser compatibility
                const convertedBlob = await heic2any({
                    blob: file,
                    toType: 'image/jpeg',
                    quality: 0.8
                });
                const blobUrl = URL.createObjectURL(Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob);
                imageSource = await loadImage(blobUrl);
                previewSource = blobUrl;
            } else if (extension === 'tif' || extension === 'tiff') {
                try {
                    // Method 1: UTIF.js (Best for common TIFFs)
                    const buffer = await file.arrayBuffer();
                    const ifds = UTIF.decode(buffer);
                    if (!ifds || ifds.length === 0) throw new Error('No IFDs');

                    let mainIfd = ifds[0];
                    for (let i = 1; i < ifds.length; i++) {
                        if ((ifds[i].width * ifds[i].height) > (mainIfd.width * mainIfd.height)) mainIfd = ifds[i];
                    }

                    UTIF.decodeImage(buffer, mainIfd);
                    const rgba = UTIF.toRGBA8(mainIfd);
                    if (!rgba) throw new Error('UTIF could not convert to RGBA');
                    
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = mainIfd.width;
                    tempCanvas.height = mainIfd.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    const imgData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
                    imgData.data.set(rgba);
                    tempCtx.putImageData(imgData, 0, 0);
                    
                    imageSource = tempCanvas;
                    previewSource = tempCanvas.toDataURL('image/jpeg', 0.6);
                } catch (utifError) {
                    console.warn('UTIF failed, trying GeoTIFF.js:', utifError);
                    try {
                        // Method 2: GeoTIFF.js (Better for high-bit depth/PRO TIFFs)
                        const buffer = await file.arrayBuffer();
                        const tiff = await GeoTIFF.fromArrayBuffer(buffer);
                        const image = await tiff.getImage();
                        const width = image.getWidth();
                        const height = image.getHeight();
                        
                        // readRGB returns a flattened array of RGB values
                        const rgb = await image.readRGB();
                        
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        const tempCtx = tempCanvas.getContext('2d');
                        const imgData = tempCtx.createImageData(width, height);
                        
                        // Convert RGB to RGBA
                        for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
                            imgData.data[j] = rgb[i];     // R
                            imgData.data[j + 1] = rgb[i + 1]; // G
                            imgData.data[j + 2] = rgb[i + 2]; // B
                            imgData.data[j + 3] = 255;      // A
                        }
                        
                        tempCtx.putImageData(imgData, 0, 0);
                        imageSource = tempCanvas;
                        previewSource = tempCanvas.toDataURL('image/jpeg', 0.6);
                    } catch (geoTiffError) {
                        console.warn('GeoTIFF failed, trying native:', geoTiffError);
                        // Method 3: Native Fallback (Safari)
                        const reader = new FileReader();
                        const imgData = await new Promise((resolve, reject) => {
                            reader.onload = (e) => resolve(e.target.result);
                            reader.onerror = (e) => reject(new Error('Formato TIFF no soportado por este navegador.'));
                            reader.readAsDataURL(file);
                        });
                        imageSource = await loadImage(imgData);
                        previewSource = imgData;
                    }
                }
            } else {
                // Standard browser-supported images
                const reader = new FileReader();
                const imgData = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
                imageSource = await loadImage(imgData);
                previewSource = imgData;
            }

            // Processing with Canvas
            let width = imageSource.width || imageSource.videoWidth; 
            let height = imageSource.height || imageSource.videoHeight;
            
            if (width > config.maxWidth) {
                const ratio = config.maxWidth / width;
                width = config.maxWidth;
                height = height * ratio;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imageSource, 0, 0, width, height);

            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    const compressedSize = blob.size;
                    const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
                    const compressedUrl = URL.createObjectURL(blob);
                    const outputName = fileName.split('.')[0] + '_opt.webp';
                    
                    const fileData = {
                        id: Date.now() + Math.random(),
                        name: fileName,
                        outputName: outputName,
                        originalSize,
                        compressedSize,
                        savings,
                        url: compressedUrl,
                        preview: previewSource,
                        blob: blob
                    };

                    processedFiles.push(fileData);
                    updateGlobalStats(originalSize, compressedSize);
                    addTileToGrid(fileData);
                    resolve();
                }, 'image/webp', config.quality);
            });

        } catch (error) {
            console.error('Error processing file:', fileName, error);
            alert(`Error al procesar ${fileName}: ${error.message}`);
        }
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = src;
        });
    }

    function updateGlobalStats(orig, comp) {
        globalStats.count++;
        globalStats.originalTotal += orig;
        globalStats.compressedTotal += comp;

        const totalSaved = globalStats.originalTotal - globalStats.compressedTotal;
        const avgEff = ((globalStats.originalTotal - globalStats.compressedTotal) / globalStats.originalTotal * 100).toFixed(1);

        totalCountLabel.textContent = globalStats.count;
        totalSavingsLabel.textContent = formatBytes(totalSaved);
        avgEfficiencyLabel.textContent = `${avgEff}%`;
    }

    function addTileToGrid(data) {
        const tile = document.createElement('div');
        tile.className = 'result-tile';
        tile.innerHTML = `
            <img src="${data.preview}" alt="Tile">
            <div class="tile-badge">-${data.savings}%</div>
        `;

        tile.addEventListener('click', () => {
            document.querySelectorAll('.result-tile').forEach(t => t.classList.remove('active'));
            tile.classList.add('active');
            showSpotlight(data);
        });

        resultsGrid.appendChild(tile);
        
        // Auto-select first one
        if (globalStats.count === 1) tile.click();
    }

    function showSpotlight(data) {
        spotlight.innerHTML = `
            <div class="spotlight-card">
                <div class="spotlight-preview">
                    <img src="${data.url}" id="spotlight-img" alt="Spotlight">
                </div>
                <div class="result-info">
                   <h3 class="result-name">${data.name}</h3>
                </div>
                <div class="spotlight-stats">
                    <div class="stat-box">
                        <span class="stat-label">Original</span>
                        <span class="stat-value">${formatBytes(data.originalSize)}</span>
                    </div>
                    <div class="stat-box highlight-stat">
                        <span class="stat-label">Optimizado</span>
                        <span class="stat-value">${formatBytes(data.compressedSize)}</span>
                    </div>
                </div>
                <div class="spotlight-actions">
                    <button class="btn btn-primary w-full" id="single-dl">Descargar WebP</button>
                    <button class="btn btn-secondary w-full" id="compare-btn">Ver Original</button>
                </div>
            </div>
        `;

        const dlBtn = document.getElementById('single-dl');
        dlBtn.addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = data.url;
            link.download = data.outputName;
            link.click();
        });

        const compareBtn = document.getElementById('compare-btn');
        const img = document.getElementById('spotlight-img');
        compareBtn.addEventListener('mousedown', () => img.src = data.preview);
        compareBtn.addEventListener('mouseup', () => img.src = data.url);
        compareBtn.addEventListener('mouseleave', () => img.src = data.url);
    }

    downloadAllBtn.addEventListener('click', async () => {
        if (processedFiles.length === 0) return;
        const zip = new JSZip();
        processedFiles.forEach(file => {
            zip.file(file.outputName, file.blob);
        });
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'imagenes_optimizadas.zip';
        link.click();
    });

    resetBtn.addEventListener('click', () => {
        resultsGrid.innerHTML = '';
        spotlight.innerHTML = '<div class="empty-selection"><p>Selecciona una imagen para ver detalles</p></div>';
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        fileInput.value = '';
        processedFiles = [];
        globalStats = { count: 0, originalTotal: 0, compressedTotal: 0 };
    });

    function formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
