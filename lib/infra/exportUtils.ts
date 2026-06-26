export function buildJpegPdf(jpeg: Uint8Array, width: number, height: number): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const text = (value: string) => push(encoder.encode(value));
  const startObject = (id: number) => {
    offsets[id] = length;
  };

  text("%PDF-1.3\n");
  startObject(1);
  text("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObject(2);
  text("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  startObject(3);
  text(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  startObject(4);
  text(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  text("\nendstream\nendobj\n");
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  startObject(5);
  text(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  const xrefOffset = length;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  text(xref);
  text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const output = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }
  return new Blob([output], { type: "application/pdf" });
}

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(value: string, fileName: string, type: string) {
  triggerDownload(new Blob([value], { type }), fileName);
}

export function svgToCanvas(svg: string, scale: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const width = Number(svg.match(/width="(\d+(?:\.\d+)?)"/)?.[1] ?? 1024);
    const height = Number(svg.match(/height="(\d+(?:\.\d+)?)"/)?.[1] ?? 768);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG rasterization failed"));
    };
    image.src = url;
  });
}

export async function downloadSvgAsPng(svg: string, fileName: string, scale = 2) {
  const canvas = await svgToCanvas(svg, scale);
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG export failed"));
        return;
      }
      triggerDownload(blob, fileName);
      resolve();
    }, "image/png");
  });
}

export async function downloadSvgAsPdf(svg: string, fileName: string, scale = 2) {
  const canvas = await svgToCanvas(svg, scale);
  const base64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
  const binary = atob(base64);
  const jpeg = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) jpeg[i] = binary.charCodeAt(i);
  triggerDownload(buildJpegPdf(jpeg, canvas.width, canvas.height), fileName);
}
