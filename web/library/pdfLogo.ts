import type { jsPDF } from "jspdf";
import parishLogoUrl from "../src/assets/images/san_guillermo_logo.png";

let cached: Promise<string | null> | null = null;

/**
 * Parish seal as a small PNG data URL for PDFs (shrunk so files stay light).
 * Loaded once and reused. Resolves to null if it can't be loaded, so PDFs still print.
 */
export const loadParishLogo = (size = 240): Promise<string | null> => {
  if (!cached) {
    cached = new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, size, size);
          resolve(canvas.toDataURL("image/png"));
        } catch (err) {
          console.error("[PdfLogo] Could not prepare the logo", err);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.error("[PdfLogo] Could not load the logo");
        resolve(null);
      };
      img.src = parishLogoUrl;
    }).then((result) => {
      if (!result) cached = null; // try again next time
      return result;
    });
    return cached;
  }
  return cached;
};

/** Draw the seal (square, `size` mm) with its top-left corner at x, y. Does nothing without a logo. */
export const drawParishLogo = (doc: jsPDF, logo: string | null, x: number, y: number, size: number) => {
  if (logo) doc.addImage(logo, "PNG", x, y, size, size);
};
