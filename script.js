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
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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
        const validFiles = files.filter(f => 
            f.type.startsWith('image/') || 
            f.type === 'application/pdf' ||
            /\.(heic|heif|tif|tiff|pdf)$/i.test(f.name)
        );
        
        if (validFiles.length === 0) {
            alert('Por favor, selecciona archivos de imagen o PDF válidos.');
            return;
        }

        isProcessing = true;
        uploadSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        const config = {
            quality: parseInt(qualityRange.value) / 100,
            maxWidth: parseInt(maxWidthInput.value) || 1920
        };

        for (const file of validFiles) {
            await processFile(file, config);
        }

        isProcessing = false;
    }

    async function processFile(file, config) {
        const originalSize = file.size;
        const fileName = file.name;
        const extension = fileName.split('.').pop().toLowerCase();

        try {
            if (extension === 'pdf' || file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 });
                    
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = viewport.width;
                    tempCanvas.height = viewport.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    await page.render({
                        canvasContext: tempCtx,
                        viewport: viewport
                    }).promise;
                    
                    const lastDotIndex = fileName.lastIndexOf('.');
                    const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
                    const outputName = `${baseName}_p${i}.webp`;
                    await finalizeImage(tempCanvas, tempCanvas.toDataURL('image/jpeg', 0.6), Math.round(originalSize / pdf.numPages), outputName, config);
                }
                return;
            }

            let imageSource;
            let previewSource;

            if (extension === 'heic' || extension === 'heif') {
                const convertedBlob = await heic2any({
                    blob: file,
                    toType: 'image/jpeg',
                    quality: 0.8
                });
                const blobUrl = URL.createObjectURL(Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob);
                imageSource = await loadImage(blobUrl);
                previewSource = blobUrl;
            } else if (extension === 'tif' || extension === 'tiff') {
                // ... logic for TIFF ... (keep it as is but wrap in try/catch or ensure it returns what we need)
                imageSource = await handleTIFF(file);
                previewSource = (imageSource instanceof HTMLCanvasElement) ? imageSource.toDataURL('image/jpeg', 0.6) : imageSource.src;
            } else {
                const reader = new FileReader();
                const imgData = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
                imageSource = await loadImage(imgData);
                previewSource = imgData;
            }

            const lastDotIndex = fileName.lastIndexOf('.');
            const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
            const outputName = baseName + '_opt.webp';
            await finalizeImage(imageSource, previewSource, originalSize, outputName, config);

        } catch (error) {
            console.error('Error processing file:', fileName, error);
            alert(`Error al procesar ${fileName}: ${error.message}`);
        }
    }

    async function handleTIFF(file) {
        const buffer = await file.arrayBuffer();
        try {
            const ifds = UTIF.decode(buffer);
            let mainIfd = ifds[0];
            for (let i = 1; i < ifds.length; i++) {
                if ((ifds[i].width * ifds[i].height) > (mainIfd.width * mainIfd.height)) mainIfd = ifds[i];
            }
            UTIF.decodeImage(buffer, mainIfd);
            const rgba = UTIF.toRGBA8(mainIfd);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = mainIfd.width;
            tempCanvas.height = mainIfd.height;
            const tempCtx = tempCanvas.getContext('2d');
            const imgData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
            imgData.data.set(rgba);
            tempCtx.putImageData(imgData, 0, 0);
            return tempCanvas;
        } catch (e) {
            // GeoTIFF Fallback
            const tiff = await GeoTIFF.fromArrayBuffer(buffer);
            const image = await tiff.getImage();
            const width = image.getWidth();
            const height = image.getHeight();
            const rgb = await image.readRGB();
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            const imgData = tempCtx.createImageData(width, height);
            for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
                imgData.data[j] = rgb[i];
                imgData.data[j + 1] = rgb[i + 1];
                imgData.data[j + 2] = rgb[i + 2];
                imgData.data[j + 3] = 255;
            }
            tempCtx.putImageData(imgData, 0, 0);
            return tempCanvas;
        }
    }

    function getUniqueOutputName(name) {
        let baseName = name;
        let extension = '';
        const lastDot = name.lastIndexOf('.');
        if (lastDot !== -1) {
            baseName = name.substring(0, lastDot);
            extension = name.substring(lastDot);
        }
        
        let uniqueName = name;
        let counter = 1;
        while (processedFiles.some(f => f.outputName === uniqueName)) {
            uniqueName = `${baseName} (${counter})${extension}`;
            counter++;
        }
        return uniqueName;
    }

    async function finalizeImage(imageSource, previewSource, originalSize, outputName, config) {
        let width = imageSource.width || imageSource.videoWidth; 
        let height = imageSource.height || imageSource.videoHeight;
        
        if (width > config.maxWidth) {
            const ratio = config.maxWidth / width;
            width = config.maxWidth;
            height = height * ratio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageSource, 0, 0, width, height);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const compressedSize = blob.size;
                const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
                const compressedUrl = URL.createObjectURL(blob);
                
                const uniqueOutputName = getUniqueOutputName(outputName);
                const displayName = uniqueOutputName.replace(/\.[^/.]+$/, '').replace('_opt', '');

                const fileData = {
                    id: Date.now() + Math.random(),
                    name: displayName,
                    outputName: uniqueOutputName,
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
