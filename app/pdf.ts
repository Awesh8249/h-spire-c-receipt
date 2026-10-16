export async function saveDisplayedReceipt(billNumber: string) {
  const pages = Array.from(
    document.querySelectorAll<HTMLElement>(".receiptWrap .paper"),
  );
  if (!pages.length) throw new Error("Receipt is not ready");

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const canvas = await html2canvas(page, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: index === 0 ? "#fffaf0" : "#090909",
      scrollX: 0,
      scrollY: -window.scrollY,
    });
    if (index > 0) pdf.addPage("a4", "portrait");
    const widthRatio = 210 / canvas.width;
    const heightRatio = 297 / canvas.height;
    const ratio = Math.min(widthRatio, heightRatio);
    const width = canvas.width * ratio;
    const height = canvas.height * ratio;
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      (210 - width) / 2,
      (297 - height) / 2,
      width,
      height,
      undefined,
      "FAST",
    );
  }

  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const name = `H-Spire-C-${billNumber}.pdf`;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) {
    const opened = window.open(url, "_blank");
    if (!opened) {
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
    }
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
