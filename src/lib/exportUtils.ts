import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { ChatMessage } from "../types";
// @ts-ignore
import html2pdf from "html2pdf.js";

export const exportToPDF = async (chat: ChatMessage[]) => {
  const element = document.getElementById("chat-preview-export-container");
  if (!element) return;

  const opt: any = {
    margin: 15,
    filename: "AI_Chat_Export.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    pagebreak: { mode: ["css", "legacy"] },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  await html2pdf().set(opt).from(element).save();
};

export const exportToMarkdown = (chat: ChatMessage[]) => {
  let mdContent = "# AI Chat Export\n\n";
  chat.forEach((msg) => {
    mdContent += `**${msg.role === "user" ? "You" : "AI"}**\n\n${msg.content}\n\n---\n\n`;
  });

  const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
  saveAs(blob, "Chat_Export.md");
};

export const exportToDocx = async (chat: ChatMessage[]) => {
  const children: Paragraph[] = [
    new Paragraph({
      text: "AI Chat Export",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
    }),
  ];

  chat.forEach((msg) => {
    const isUser = msg.role === "user";
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: isUser ? "You" : "AI",
            bold: true,
            size: 24, // 12pt
            color: isUser ? "555555" : "000000",
          }),
        ],
        spacing: { before: 300, after: 100 },
        shading: {
          type: "solid",
          color: isUser ? "F3F4F6" : "FFFFFF",
          fill: isUser ? "F3F4F6" : "FFFFFF",
        },
      }),
    );

    const textLines = msg.content.split("\n");
    textLines.forEach((line) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: 22,
              color: "333333",
            }),
          ],
          spacing: { after: 120 },
        }),
      );
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Chat_Export.docx");
};
