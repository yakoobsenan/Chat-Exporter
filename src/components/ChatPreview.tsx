import { ChatMessage, ExportStyle } from "../types";
import { User, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";

interface ChatPreviewProps {
  chat: ChatMessage[];
  exportStyle?: ExportStyle;
}

export default function ChatPreview({
  chat,
  exportStyle = "modern",
}: ChatPreviewProps) {
  if (!chat || chat.length === 0) return null;

  const isAcademic = exportStyle === "academic";

  return (
    <div
      className={`mt-8 relative print:mt-0 ${isAcademic ? "font-serif text-sm" : ""}`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white pointer-events-none h-full z-10 opacity-20 ${isAcademic ? "hidden print:hidden" : "print:hidden"}`}
      />
      <div
        id="chat-preview-export-container"
        className={`pb-20 print:pb-0 ${isAcademic ? "space-y-4" : "space-y-6 print:space-y-6"}`}
      >
        {chat.map((msg, index) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, ease: "easeOut", duration: 0.4 }}
            key={index}
            className={`break-inside-avoid flex gap-4 rounded-2xl print:border-none print:shadow-none print:p-0 ${isAcademic ? "mb-4 border-none shadow-none bg-transparent p-0" : "p-5 md:p-6 mb-4 print:mb-6"} ${isAcademic ? "" : msg.role === "ai" ? "bg-white border border-gray-100 shadow-sm print:bg-transparent" : "bg-gray-50 border border-gray-200 print:bg-transparent"}`}
          >
            <div
              className={`shrink-0 mt-1 ${isAcademic ? "hidden" : "print:hidden"}`}
            >
              {msg.role === "user" ? (
                <div className="w-8 h-8 flex items-center justify-center bg-gray-200 text-gray-700 rounded-full">
                  <User size={16} strokeWidth={2.5} />
                </div>
              ) : (
                <div className="w-8 h-8 flex items-center justify-center bg-black text-white rounded-full shadow-sm">
                  <Sparkles size={16} strokeWidth={2.5} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div
                className={`font-semibold mb-2 ${isAcademic ? "text-sm capitalize text-black mb-1" : "text-xs text-gray-500 uppercase tracking-wider"}`}
              >
                {msg.role === "user" ? "You" : "AI"}
              </div>
              <div
                className={`text-gray-800 leading-relaxed break-words markdown-body prose prose-sm md:prose-base max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-img:rounded-xl prose-a:text-blue-600 hover:prose-a:text-blue-800 marker:text-gray-400 ${isAcademic ? "prose-sm text-black" : ""}`}
              >
                <Markdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    table(props) {
                      return (
                        <div className="overflow-x-auto w-full my-6 print:overflow-visible">
                          <table
                            className="min-w-full divide-y divide-gray-200 border border-gray-200 print:border-collapse"
                            {...props}
                          />
                        </div>
                      );
                    },
                    thead(props) {
                      return (
                        <thead
                          className="bg-gray-50 print:bg-transparent"
                          {...props}
                        />
                      );
                    },
                    th(props) {
                      return (
                        <th
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-900 border-b border-gray-200 print:border-gray-800"
                          {...props}
                        />
                      );
                    },
                    td(props) {
                      return (
                        <td
                          className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100 print:border-gray-800"
                          {...props}
                        />
                      );
                    },
                    code(props) {
                      const { children, className, node, ref, ...rest } = props;
                      const match = /language-(\w+)/.exec(className || "");
                      return match ? (
                        <SyntaxHighlighter
                          {...(rest as any)}
                          PreTag="div"
                          children={String(children).replace(/\n$/, "")}
                          language={match[1]}
                          style={{
                            ...vscDarkPlus,
                            'pre[class*="language-"]': {
                              ...vscDarkPlus['pre[class*="language-"]'],
                              margin: 0,
                              borderRadius: "0.5rem",
                            },
                          }}
                        />
                      ) : (
                        <code {...rest} ref={ref} className={className}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </Markdown>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
