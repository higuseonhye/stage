"use client";

import type { RefObject } from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download, FileDown, Printer } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function slugifyTopic(topic: string) {
  const s = topic
    .slice(0, 72)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
  return s || "stage-run";
}

/** Slice a tall canvas into PDF pages (pt units). */
function addCanvasToPdf(canvas: HTMLCanvasElement, pdf: jsPDF) {
  const margin = 36;
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const pageW = pdfWidth - margin * 2;
  const pageH = pdfHeight - margin * 2;
  const scale = pageW / canvas.width;
  const sliceCanvasPx = pageH / scale;

  let srcY = 0;
  let first = true;
  while (srcY < canvas.height) {
    const sliceH = Math.min(sliceCanvasPx, canvas.height - srcY);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(
      canvas,
      0,
      srcY,
      canvas.width,
      sliceH,
      0,
      0,
      canvas.width,
      sliceH,
    );
    const imgData = slice.toDataURL("image/png");
    const drawH = sliceH * scale;
    if (!first) pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, margin, pageW, drawH);
    first = false;
    srcY += sliceH;
  }
}

type Props = {
  markdown: string;
  topic: string;
  /** Rendered memo DOM for print / PDF */
  printRef: RefObject<HTMLElement | null>;
};

export function DecisionMemoExport({ markdown, topic, printRef }: Props) {
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [markdown]);

  const downloadMd = useCallback(() => {
    const blob = new Blob([markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugifyTopic(topic)}-decision-memo.md`;
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  }, [markdown, topic]);

  const printMemo = useCallback(() => {
    const el = printRef.current;
    if (!el) return;
    el.classList.add("print-decision-memo");
    const prev = document.title;
    document.title = `${slugifyTopic(topic)}-decision-memo`;
    const onAfter = () => {
      el.classList.remove("print-decision-memo");
      document.title = prev;
      window.removeEventListener("afterprint", onAfter);
    };
    window.addEventListener("afterprint", onAfter);
    window.print();
  }, [printRef, topic]);

  const downloadPdf = useCallback(async () => {
    const el = printRef.current;
    if (!el) return;
    setPdfBusy(true);
    const prev = {
      maxHeight: el.style.maxHeight,
      overflow: el.style.overflow,
      height: el.style.height,
    };
    el.style.maxHeight = "none";
    el.style.overflow = "visible";
    el.style.height = "auto";
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowHeight: el.scrollHeight,
      });
      const pdf = new jsPDF({
        orientation: "p",
        unit: "pt",
        format: "a4",
      });
      addCanvasToPdf(canvas, pdf);
      pdf.save(`${slugifyTopic(topic)}-decision-memo.pdf`);
    } catch {
      /* ignore */
    } finally {
      el.style.maxHeight = prev.maxHeight;
      el.style.overflow = prev.overflow;
      el.style.height = prev.height;
      setPdfBusy(false);
    }
  }, [printRef, topic]);

  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={() => void copy()}
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        {copied ? "Copied" : "Copy Markdown"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={downloadMd}
      >
        <Download className="size-3.5" aria-hidden />
        Download .md
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={printMemo}
      >
        <Printer className="size-3.5" aria-hidden />
        Print
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={pdfBusy}
        onClick={() => void downloadPdf()}
      >
        <FileDown className="size-3.5" aria-hidden />
        {pdfBusy ? "PDF…" : "Download PDF"}
      </Button>
    </div>
  );
}
