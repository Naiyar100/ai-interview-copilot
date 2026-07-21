import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { cleanResumeText } from "./cleaner.js";

const createPdfError = (message) => {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
};

export const parseResumePdf = async (filePath) => {
  const data = await readFile(filePath);

  if (data.length < 5 || data.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw createPdfError("The uploaded file is not a valid PDF");
  }

  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const extractedText = cleanResumeText(result.text || "");

    if (!extractedText) {
      throw createPdfError(
        "No readable text was found. Please upload a text-based PDF resume.",
      );
    }

    return extractedText;
  } catch (error) {
    if (error.statusCode) throw error;
    const details = `${error.name || ""} ${error.message || ""}`.toLowerCase();
    if (details.includes("password") || details.includes("encrypted")) {
      throw createPdfError("Encrypted or password-protected PDFs are not supported");
    }
    throw createPdfError("The PDF is corrupted or could not be read");
  } finally {
    await parser.destroy().catch(() => {});
  }
};
