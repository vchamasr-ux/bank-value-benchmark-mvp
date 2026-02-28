import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

// 8.5 x 11 Landscape in points (for jsPDF)
const PDF_WIDTH_IN = 11;
const PDF_HEIGHT_IN = 8.5;

export const exportDashboardToPDF = async (elementId, filename = "BankValue_Benchmark.pdf") => {
    try {
        const input = document.getElementById(elementId);
        if (!input) {
            throw new Error(`CRITICAL: Element ID ${elementId} not found in DOM for PDF export.`);
        }

        // Add a temporary class to the element to apply print-specific styling
        // (e.g. force all tabs to render, remove scrollbars, adjust sizing)
        input.classList.add('pdf-rendering-mode');

        const imgData = await toPng(input, {
            pixelRatio: 2, // High DPI capture
            cacheBust: true,
            style: {
                transform: 'scale(1)', // Prevent weird flexbox shrink wrapping
            }
        });

        // Remove the temporary class
        input.classList.remove('pdf-rendering-mode');

        // Create Landscape PDF
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'in',
            format: [PDF_HEIGHT_IN, PDF_WIDTH_IN]
        });

        // Calculate aspect ratio preserving dimensions
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Add image to PDF. 
        // If the captured dash is taller than 8.5in, this will span it across pages
        // or we just render it starting at top-left.
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

        // Download the final PDF
        pdf.save(filename);
        return true;

    } catch (error) {
        console.error("PDF Export failed:", error);
        throw error; // Fail Loudly
    }
};
