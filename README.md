# ⚡ WebP Image Converter & Compressor

Este es un proyecto educativo desarrollado para el curso de **Fullstack**, enfocado en la manipulación de archivos en el cliente (Client-side) y la optimización de recursos web. La herramienta permite convertir cualquier formato de imagen (JPG, PNG, BMP, etc.) al formato moderno **WebP** con una calidad del 90%.

## ✨ Características
*   **Conversión Universal:** Soporta JPG, PNG, WEBP, BMP, AVIF, **TIFF** y **HEIC/HEIF**.
*   **Salida Optimizada:** Genera archivos `.webp` de alto rendimiento.
*   **Procesamiento 100% Local:** Las imágenes no se suben a ningún servidor; la compresión ocurre íntegramente en el navegador del usuario, garantizando máxima privacidad y velocidad.
*   **Comparativa en Tiempo Real:** Visualiza el peso original frente al optimizado y el porcentaje de ahorro antes de descargar.
*   **Diseño Premium:** Interfaz moderna con Glassmorphism, animaciones fluidas y modo oscuro.

## 🛠️ Tecnologías Utilizadas
*   **HTML5:** Estructura semántica avanzada y SEO-friendly.
*   **CSS3 (Vanilla):** Diseño moderno mediante Variables CSS, Flexbox, y animaciones de alto rendimiento.
*   **JavaScript (ES6+):**
    *   **FileReader API:** Para el acceso instantáneo a archivos locales.
    *   **Canvas API:** El motor de renderizado que permite la recodificación de píxeles.
    *   **UTIF.js:** Decodificador profesional para archivos TIFF.
    *   **heic2any:** Conversor para formatos HEIC/HEIF (iOS).
    *   **JSZip:** Para la generación de descargas por lotes en archivos ZIP.
    *   **Blobs & URLs:** Para la gestión eficiente de memoria y descargas directas.

## 📝 Lógica de Compresión
El núcleo del proyecto utiliza el potencial del elemento `<canvas>`:
1.  **Carga:** El usuario selecciona un archivo (Input o Drag & Drop).
2.  **Lectura:** `FileReader` transforma el archivo en un `DataURL` (Base64) para previsualización inmediata.
3.  **Procesamiento:** Se instancia un objeto `Image` y se dibuja en un canvas con las dimensiones originales.
4.  **Codificación:** Se extrae el contenido mediante `canvas.toBlob('image/webp', 0.9)`, delegando la compresión al motor nativo del navegador.

## ⚙️ Instalación y Uso
1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/compresor-webp.git
    ```
2.  **Abre el proyecto:**
    Simplemente abre `index.html` en cualquier navegador moderno. No requiere dependencias de servidor (Node.js, PHP, etc.) para funcionar.

---
*Desarrollado como parte de la formación Fullstack.*
