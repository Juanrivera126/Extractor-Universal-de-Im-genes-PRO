# 🖼️ Extractor Universal de Imágenes & Optimizador Web

Un potente extractor de imágenes "todo en uno" basado íntegramente en el navegador. Permite recuperar imágenes de archivos complejos (**PDF, PPTX, HTML**), extraer contenido visual de **sitios web** mediante URL o procesar **carpetas locales** enteras, incluyendo herramientas avanzadas de compresión y conversión a formatos modernos como **WebP**.

![Versión](https://img.shields.io/badge/version-2.0-blue)
![Tecnología](https://img.shields.io/badge/Tecnología-JS_Pure-yellow)
![Privacidad](https://img.shields.io/badge/Privacidad-100%25_Local-green)

## ✨ Características Principales

*   **📄 Extracción de PDF (Objetos Reales):** A diferencia de otros extractores, este accede a los objetos de imagen internos (`XObjects`) del PDF en lugar de tomar capturas de la página, preservando la resolución original.
*   **📊 Soporte PowerPoint (.pptx):** Analiza la estructura interna del archivo para extraer todos los recursos multimedia guardados en las diapositivas.
*   **🌐 Extractor de URL Web:** Ingresa una dirección web y la herramienta detectará y descargará las imágenes automáticamente (utiliza un proxy CORS para evitar bloqueos de seguridad).
*   **📁 Procesamiento de Carpetas y Archivos:** Permite seleccionar una carpeta completa de tu ordenador para realizar conversiones masivas (ej. de PNG a WebP) de forma instantánea.
*   **⚡ Panel de Optimización Real-Time:**
    *   **Formatos:** Salida en WebP, JPEG o PNG.
    *   **Escala:** Redimensiona imágenes proporcionalmente (de 0.2x a 1.5x).
    *   **Calidad:** Ajuste fino de la relación calidad/peso.
    *   **Comparativa:** Visualización del peso original vs. optimizado y porcentaje de ahorro.
*   **📦 Descarga en ZIP:** Empaqueta todos los resultados en un único archivo comprimido con un solo clic.

## 🚀 Instalación y Uso

Al ser una aplicación web estática (Client-side), no requiere servidor, base de datos ni instalación de dependencias en tu equipo.

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/extractor-imagenes-universal.git
    ```
2.  **Ejecuta:** Abre el archivo `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge, Safari).

## 🛠️ Tecnologías Utilizadas

*   **[PDF.js](https://mozilla.github.io/pdf.js/):** Para el análisis y renderizado de objetos dentro de documentos PDF.
*   **[JSZip](https://stuk.github.io/jszip/):** Para la descompresión de archivos Office (PPTX) y la generación de paquetes de descarga.
*   **HTML5 Canvas API:** Motor central para el procesamiento, redimensionado y compresión de imágenes.
*   **CORS Proxy:** Integración con servicios de proxy para la extracción de contenido web remoto.

## 🔒 Privacidad y Seguridad

**Tus archivos nunca salen de tu ordenador.** Todo el procesamiento de imágenes, lectura de PDFs y compresión se realiza localmente en la memoria de tu navegador. Esto garantiza:
*   Máxima velocidad de procesamiento.
*   Privacidad absoluta de tus documentos.
*   Funcionamiento sin necesidad de subir datos a la nube.

## 👤 Créditos y Desarrollo

*   **Autor:** Juan Guillermo Rivera Berrío.
*   **Tecnología:** Desarrollado con el apoyo de **Gemini 3 Pro** para la optimización de algoritmos de extracción y manejo de objetos de imagen.

## 📝 Licencia

Este proyecto se distribuye bajo la Licencia MIT. Siéntete libre de usarlo, modificarlo y adaptarlo a tus necesidades.

---

### 💡 ¿Quieres contribuir?
Si encuentras un error o tienes una sugerencia para mejorar la extracción de objetos:
1. Haz un **Fork** del proyecto.
2. Crea una rama (`git checkout -b feature/NuevaMejora`).
3. Haz un **Commit** con tus cambios.
4. Envía un **Pull Request**.
