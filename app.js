document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resultsSection = document.getElementById('results');
    const uploadSection = document.getElementById('drop-zone');
    const resultsGrid = document.getElementById('results-grid');
    
    const resetBtn = document.getElementById('reset-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const canvas = document.getElementById('conversion-canvas');
    const ctx = canvas.getContext('2d');

    let isProcessing = false;
    let processedFiles = []; // To store {name, blob} for ZIP

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

        for (const file of imageFiles) {
            await processFile(file);
        }

        isProcessing = false;
        if (processedFiles.length > 1) {
            downloadAllBtn.classList.remove('hidden');
        }
    }

    async function processFile(file) {
        return new Promise((resolve) => {
            const originalSize = file.size;
            const fileName = file.name;
            const reader = new FileReader();

            reader.onload = (e) => {
                const imgData = e.target.result;
                const img = new Image();
                
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob((blob) => {
                        const compressedSize = blob.size;
                        const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
                        const compressedUrl = URL.createObjectURL(blob);
                        
                        const outputName = fileName.split('.')[0] + '_opt.webp';
                        
                        processedFiles.push({
                            name: outputName,
                            blob: blob
                        });

                        addResultToGrid({
                            name: fileName,
                            outputName: outputName,
                            originalSize,
                            compressedSize,
                            savings,
                            url: compressedUrl,
                            preview: imgData
                        });
                        resolve();
                    }, 'image/webp', 0.9);
                };
                img.src = imgData;
            };
            reader.readAsDataURL(file);
        });
    }

    function addResultToGrid(data) {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <img src="${data.preview}" class="result-img-preview" alt="Preview">
            <div class="result-info">
                <div class="result-name" title="${data.name}">${data.name}</div>
                <div class="result-stats">
                    <div class="stat-group">
                        <span class="text-muted">Original:</span>
                        <span>${formatBytes(data.originalSize)}</span>
                    </div>
                    <div class="stat-group">
                        <span class="text-muted">WebP:</span>
                        <span class="highlight">${formatBytes(data.compressedSize)}</span>
                    </div>
                    <div class="savings-label">-${data.savings}%</div>
                </div>
            </div>
            <div class="result-actions">
                <button class="btn-download" title="Descargar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>
        `;

        item.querySelector('.btn-download').addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = data.url;
            link.download = data.outputName;
            link.click();
        });

        resultsGrid.appendChild(item);
    }

    // Download All as ZIP
    downloadAllBtn.addEventListener('click', async () => {
        if (processedFiles.length === 0) return;

        const zip = new JSZip();
        processedFiles.forEach(file => {
            zip.file(file.name, file.blob);
        });

        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'imagenes_optimizadas_webp.zip';
        link.click();
    });

    resetBtn.addEventListener('click', () => {
        resultsGrid.innerHTML = '';
        resultsSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        fileInput.value = '';
        downloadAllBtn.classList.add('hidden');
        processedFiles = [];
    });

    function formatBytes(bytes, decimals = 1) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
