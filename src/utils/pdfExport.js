export const exportDashboardToPDF = async (elementIds, filename = "BankValue_Benchmark.pdf") => {
    // Dynamically import libraries to keep initial bundle size small if preferred
    const { toPng } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');

    // 16:9 Aspect Ratio dimensions in inches for Presentation
    const PDF_WIDTH_IN = 13.333; // 16:9 ratio w/ 7.5 height
    const PDF_HEIGHT_IN = 7.5;

    try {
        const ids = Array.isArray(elementIds) ? elementIds : [elementIds];

        // Ensure all elements exist before starting
        const elements = ids.map(id => {
            const el = document.getElementById(id);
            if (!el) throw new Error(`CRITICAL: Slide ID ${id} not found in DOM for PDF export.`);
            return el;
        });

        // Create 16:9 Landscape PDF
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'in',
            format: [PDF_HEIGHT_IN, PDF_WIDTH_IN]
        });

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];

            // Temporarily make it visible for capture (if it was hidden)
            // But keep it off-screen so the user doesn't see a giant flash
            const originalStyle = el.style.cssText;
            el.style.opacity = '1';
            el.style.position = 'absolute';
            el.style.top = '-9999px';
            el.style.left = '-9999px';
            el.style.display = 'block';

            const imgData = await toPng(el, {
                pixelRatio: 2, // High DPI capture
                cacheBust: true,
                style: {
                    transform: 'scale(1)',
                }
            });

            // Restore original styles
            el.style.cssText = originalStyle;

            if (i > 0) {
                pdf.addPage([PDF_WIDTH_IN, PDF_HEIGHT_IN], 'landscape');
            }

            // Calculate aspect ratio preserving dimensions
            // Our elements should already be 1920x1080, but this ensures perfect fit
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }

        pdf.save(filename);
        return true;

    } catch (error) {
        console.error("PDF Export failed:", error);
        throw error; // Fail Loudly
    }
};
