/**
 * Source parser and extractor for Ctrl+ Production AI Knowledge Base (NotebookLM Mode)
 * Supports .txt, .md, .fountain, .pdf, .csv, .json, .srt, .tsv, etc.
 */

export interface KnowledgeSource {
  id: string;
  name: string;
  type: "file" | "text" | "script" | "pdf" | "csv";
  content: string;
  charCount: number;
  wordCount: number;
  sizeBytes: number;
  enabled: boolean;
  createdAt: string;
  departmentCode?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Parse an uploaded File into text content for AI grounding
 */
export async function parseUploadedFile(file: File, departmentCode?: string): Promise<KnowledgeSource> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  let content = "";
  let sourceType: KnowledgeSource["type"] = "file";

  if (extension === "fountain" || extension === "screenplay") {
    sourceType = "script";
    content = await file.text();
  } else if (extension === "pdf") {
    sourceType = "pdf";
    content = await extractTextFromPdf(file);
  } else if (extension === "csv" || extension === "tsv") {
    sourceType = "csv";
    content = await file.text();
  } else {
    // txt, md, json, srt, log, etc.
    sourceType = "file";
    content = await file.text();
  }

  // Clean up content
  content = content.replace(/\r\n/g, "\n").trim();

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: sourceType,
    content,
    charCount: content.length,
    wordCount: countWords(content),
    sizeBytes: file.size,
    enabled: true,
    createdAt: new Date().toISOString(),
    departmentCode,
  };
}

/**
 * Create a KnowledgeSource from manual raw text / notes
 */
export function createTextSource(
  title: string,
  rawText: string,
  departmentCode?: string,
): KnowledgeSource {
  const cleanTitle = title.trim() || "Untitled Note";
  const cleanContent = rawText.replace(/\r\n/g, "\n").trim();
  const blob = new Blob([cleanContent], { type: "text/plain" });

  return {
    id: crypto.randomUUID(),
    name: cleanTitle.endsWith(".txt") || cleanTitle.endsWith(".md") ? cleanTitle : `${cleanTitle}.txt`,
    type: "text",
    content: cleanContent,
    charCount: cleanContent.length,
    wordCount: countWords(cleanContent),
    sizeBytes: blob.size,
    enabled: true,
    createdAt: new Date().toISOString(),
    departmentCode,
  };
}

/**
 * Extract readable text from PDF in pure JavaScript/browser environment
 */
async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder("utf-8", { fatal: false });
    const rawString = textDecoder.decode(bytes);

    const textBlocks: string[] = [];
    const btEtRegex = /BT[\s\S]*?ET/g;
    let match: RegExpExecArray | null;

    while ((match = btEtRegex.exec(rawString)) !== null) {
      const block = match[0];
      
      const tjRegex = /\((.*?)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textBlocks.push(decodePdfString(tjMatch[1]));
      }

      const arrayRegex = /\[(.*?)\]\s*TJ/g;
      let arrMatch: RegExpExecArray | null;
      while ((arrMatch = arrayRegex.exec(block)) !== null) {
        const inner = arrMatch[1];
        const innerStrings = inner.match(/\((.*?)\)/g);
        if (innerStrings) {
          const combined = innerStrings
            .map((s) => decodePdfString(s.slice(1, -1)))
            .join("");
          textBlocks.push(combined);
        }
      }
    }

    if (textBlocks.length > 0) {
      return textBlocks.join(" ").replace(/\s+/g, " ").trim();
    }

    const fallbackLines: string[] = [];
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let streamMatch: RegExpExecArray | null;
    while ((streamMatch = streamRegex.exec(rawString)) !== null) {
      const streamData = streamMatch[1];
      const printable = streamData.replace(/[^\x20-\x7E\u0E00-\u0E7F\n]/g, " ");
      if (printable.trim().length > 20) {
        fallbackLines.push(printable.trim());
      }
    }

    if (fallbackLines.length > 0) {
      return fallbackLines.join("\n\n").replace(/[ \t]+/g, " ");
    }

    return `[PDF Document: ${file.name} (${formatBytes(file.size)}) - เนื้อหาถูกประมวลผล]`;
  } catch (err) {
    console.warn("PDF extraction fallback:", err);
    return `[PDF Document: ${file.name} - ไม่สามารถอ่านตัวหนังสือได้โดยตรง]`;
  }
}

function decodePdfString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}
