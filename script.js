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
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
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
        return new Promise((resolve) => {
            const originalSize = file.size;
            const fileName = file.name;
            const reader = new FileReader();

            reader.onload = (e) => {
                const imgData = e.target.result;
                const img = new Image();
                
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > config.maxWidth) {
                        const ratio = config.maxWidth / width;
                        width = config.maxWidth;
                        height = height * ratio;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, width, height);

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
                            preview: imgData
                        };

                        processedFiles.push(fileData);
                        updateGlobalStats(originalSize, compressedSize);
                        addTileToGrid(fileData);
                        resolve();
                    }, 'image/webp', config.quality);
                };
                img.src = imgData;
            };
            reader.readAsDataURL(file);
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
