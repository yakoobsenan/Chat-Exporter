import { useState, useRef, useEffect, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import Header from "./components/Header";
import ChatPreview from "./components/ChatPreview";
import HistorySidebar from "./components/HistorySidebar";
import AuthModal from "./components/AuthModal";
import { exportToPDF, exportToDocx, exportToMarkdown } from "./lib/exportUtils";
import { supabase } from "./lib/supabase";
import { ChatMessage, ChatHistoryItem, ExportStyle } from "./types";
import { FileDown, Link as LinkIcon, Loader as Loader2, CloudUpload as UploadCloud, Trash2, Copy, Check, Printer, Menu, Sparkles, LogIn, LogOut, User } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [input, setInput] = useState(() => localStorage.getItem("chatInput") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [exportStyle, setExportStyle] = useState<ExportStyle>(
    () => (localStorage.getItem("exportStyle") as ExportStyle) || "modern"
  );
  const [chatData, setChatData] = useState<ChatMessage[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("chatData") || "[]");
    } catch {
      return [];
    }
  });
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load history from Supabase when signed in, else from localStorage
  const loadHistory = useCallback(async (userId: string | null) => {
    if (!userId) {
      try {
        setHistory(JSON.parse(localStorage.getItem("chatHistory") || "[]"));
      } catch {
        setHistory([]);
      }
      return;
    }
    const { data, error } = await supabase
      .from("chat_history")
      .select("id, name, chat_data, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      setHistory(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          chatData: row.chat_data as ChatMessage[],
          timestamp: new Date(row.created_at).getTime(),
        }))
      );
    }
  }, []);

  useEffect(() => {
    loadHistory(session?.user?.id ?? null);
  }, [session, loadHistory]);

  useEffect(() => { localStorage.setItem("chatInput", input); }, [input]);
  useEffect(() => { localStorage.setItem("exportStyle", exportStyle); }, [exportStyle]);
  useEffect(() => { localStorage.setItem("chatData", JSON.stringify(chatData)); }, [chatData]);

  const saveHistoryItem = async (name: string, parsedData: ChatMessage[]) => {
    if (session?.user) {
      const { data, error } = await supabase
        .from("chat_history")
        .insert({ user_id: session.user.id, name, chat_data: parsedData })
        .select("id, name, chat_data, created_at")
        .single();
      if (!error && data) {
        setHistory((prev) =>
          [
            {
              id: data.id,
              name: data.name,
              chatData: data.chat_data as ChatMessage[],
              timestamp: new Date(data.created_at).getTime(),
            },
            ...prev,
          ].slice(0, 20)
        );
      }
    } else {
      const item: ChatHistoryItem = {
        id: Date.now().toString(),
        name,
        chatData: parsedData,
        timestamp: Date.now(),
      };
      setHistory((prev) => {
        const updated = [item, ...prev].slice(0, 5);
        localStorage.setItem("chatHistory", JSON.stringify(updated));
        return updated;
      });
    }
  };

  const clearHistory = async () => {
    if (session?.user) {
      await supabase.from("chat_history").delete().eq("user_id", session.user.id);
    } else {
      localStorage.removeItem("chatHistory");
    }
    setHistory([]);
  };

  const handleCopy = () => {
    const textToCopy = chatData
      .map((msg) => `${msg.role === "user" ? "You" : "AI"}:\n${msg.content}`)
      .join("\n\n");
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleParse = async () => {
    if (!input.trim() && !selectedFile) return;

    setIsLoading(true);
    setStatusMessage("Preparing process...");
    setError(null);
    setChatData([]);

    try {
      let requestBody: any = { input: input.trim() };

      if (selectedFile) {
        setStatusMessage("Reading file...");
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(selectedFile);
        const base64Data = await base64Promise;
        requestBody.file = {
          data: base64Data,
          mimeType: selectedFile.type || "application/octet-stream",
        };
      }

      setStatusMessage("Analyzing conversation using Gemini API...");
      const response = await fetch("/api/parse-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      let data;
      try {
        data = JSON.parse(await response.text());
      } catch {
        throw new Error(
          !response.ok
            ? `Server error: ${response.status} ${response.statusText}`
            : "Invalid JSON response from server"
        );
      }

      if (!response.ok) throw new Error(data.error || "Failed to parse chat.");

      const parsedData: ChatMessage[] = data.data || [];
      setChatData(parsedData);

      if (parsedData.length > 0) {
        const name = selectedFile
          ? selectedFile.name
          : input.trim().slice(0, 30) + (input.trim().length > 30 ? "..." : "");
        await saveHistoryItem(name, parsedData);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setInput("");
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setSelectedFile(file); setInput(""); }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadHistoryItem = (item: ChatHistoryItem) => {
    setChatData(item.chatData);
    setInput("");
    clearFile();
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-gray-200 print:min-h-0 print:bg-white flex">
      <AnimatePresence>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      </AnimatePresence>

      <HistorySidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        history={history}
        onSelect={loadHistoryItem}
        onClear={clearHistory}
      />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 md:py-24 print:p-0 print:max-w-none print:mx-0 w-full">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100 print:hidden">
          <Header />
          <div className="flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
                  <User size={14} />
                  {session.user.email}
                </span>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <LogIn size={14} />
                Sign in
              </button>
            )}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>

        <div className="space-y-4 print:hidden">
          <label htmlFor="chat-input" className="block text-sm font-medium text-gray-700">
            Paste an AI chat link, raw text, or upload a downloaded chat (HTML, PDF, TXT)
          </label>

          <div
            className={`flex flex-col gap-4 p-4 -m-4 rounded-3xl transition-all border-2 ${isDragging ? "border-gray-800 bg-gray-50 drop-shadow-sm" : "border-transparent"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center shrink-0">
                    <FileDown size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={clearFile}
                  className="text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
                  <LinkIcon size={20} />
                </div>
                <textarea
                  id="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={"https://chatgpt.com/share/...\nOr paste raw conversation..."}
                  className="w-full text-base bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-sm resize-none h-32"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".txt,.html,.htm,.pdf,.json,.mht,.mhtml,.csv,.doc,.docx,.rtf,.markdown,.md"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 px-6 py-3 rounded-xl font-medium tracking-wide flex items-center justify-center transition-colors shadow-sm"
              >
                <UploadCloud className="mr-2" size={20} />
                Upload File
              </button>
              <button
                onClick={handleParse}
                disabled={isLoading || (!input.trim() && !selectedFile)}
                className="flex-1 bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium tracking-wide flex items-center justify-center transition-colors shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    {statusMessage || "Analyzing Content..."}
                  </>
                ) : (
                  "Extract Conversation"
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100 flex flex-col gap-3"
              >
                <div>{error}</div>
                {input.startsWith("http") && (
                  <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-gray-700 flex-1">
                      If the site is blocking bots or requires you to sign in, open the link
                      manually, sign in if needed, then Select All, Copy, and Paste the raw text
                      into the box above.
                    </span>
                    <a
                      href={input}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap transition-colors"
                    >
                      Open Link in New Tab
                    </a>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-12 space-y-6"
            >
              <div className="bg-gray-50 border border-gray-100 p-8 rounded-2xl flex flex-col items-center justify-center space-y-5 mb-8 print:hidden shadow-sm">
                <Loader2 className="animate-spin text-gray-500" size={36} />
                <p className="text-gray-700 font-medium text-center">{statusMessage}</p>
                <div className="w-full max-w-sm h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                  <motion.div
                    className="absolute top-0 bottom-0 left-0 bg-black rounded-full"
                    initial={{ width: "20%", left: "-20%" }}
                    animate={{ left: "100%" }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              </div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex gap-4 p-5 md:p-6 mb-4 rounded-2xl ${i % 2 === 0 ? "bg-white border border-gray-100 shadow-sm" : "bg-gray-50 border border-gray-200"} animate-pulse`}
                >
                  <div className="shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-gray-200" />
                  </div>
                  <div className="flex-1 w-full space-y-4 mt-1">
                    <div className="w-16 h-4 bg-gray-200 rounded" />
                    <div className="space-y-2.5">
                      <div className="h-4 bg-gray-200 rounded w-5/6" />
                      <div className="h-4 bg-gray-200 rounded w-4/6" />
                      <div className="h-4 bg-gray-200 rounded w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : chatData.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 space-y-8 print:mt-0 print:space-y-0"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 bg-gray-50 border border-gray-100 rounded-2xl print:hidden">
                <div className="text-sm font-medium text-gray-600 flex items-center gap-3 w-full lg:w-auto">
                  <span>
                    <span className="text-black font-semibold">{chatData.length}</span> msgs
                  </span>
                  <div className="h-4 w-px bg-gray-300 hidden lg:block" />
                  <button
                    onClick={() => { setChatData([]); setInput(""); clearFile(); setError(null); }}
                    className="text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-lg ml-auto lg:ml-0"
                  >
                    <Trash2 size={16} />
                    <span>Clear</span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                  <select
                    value={exportStyle}
                    onChange={(e) => setExportStyle(e.target.value as ExportStyle)}
                    className="flex-1 sm:flex-none bg-white border border-gray-200 hover:border-gray-300 text-gray-800 px-3 py-2.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black shadow-sm cursor-pointer"
                  >
                    <option value="modern">Modern Minimalist</option>
                    <option value="academic">Classic Academic</option>
                  </select>
                  <button
                    onClick={handleCopy}
                    className="flex-1 sm:flex-none flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 text-gray-800 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow"
                  >
                    {isCopied ? <Check size={18} className="mr-2 text-green-600" /> : <Copy size={18} className="mr-2" />}
                    {isCopied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-none flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 text-gray-800 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow"
                  >
                    <Printer size={18} className="mr-2" />
                    Print
                  </button>
                  <button
                    onClick={async () => {
                      setIsExporting(true);
                      setStatusMessage("Generating PDF... Please wait.");
                      try { await exportToPDF(chatData); } catch (err) { console.error(err); } finally { setIsExporting(false); }
                    }}
                    disabled={isExporting}
                    className="flex-1 sm:flex-none flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 text-gray-800 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting && statusMessage.includes("PDF") ? <Loader2 size={18} className="mr-2 animate-spin text-gray-500" /> : <FileDown size={18} className="mr-2" />}
                    {isExporting && statusMessage.includes("PDF") ? "Exporting..." : "Export PDF"}
                  </button>
                  <button
                    onClick={async () => {
                      setIsExporting(true);
                      setStatusMessage("Generating Markdown...");
                      try { await exportToMarkdown(chatData); } catch (err) { console.error(err); } finally { setIsExporting(false); }
                    }}
                    disabled={isExporting}
                    className="flex-1 sm:flex-none flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 text-gray-800 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting && statusMessage.includes("Markdown") ? <Loader2 size={18} className="mr-2 animate-spin text-gray-500" /> : <FileDown size={18} className="mr-2" />}
                    {isExporting && statusMessage.includes("Markdown") ? "Exporting..." : "Export MD"}
                  </button>
                  <button
                    onClick={async () => {
                      setIsExporting(true);
                      setStatusMessage("Generating Word Document...");
                      try { await exportToDocx(chatData); } catch (err) { console.error(err); } finally { setIsExporting(false); }
                    }}
                    disabled={isExporting}
                    className="flex-1 sm:flex-none flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white border border-transparent px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isExporting && statusMessage.includes("Word") ? <Loader2 size={18} className="mr-2 animate-spin text-white" /> : <FileDown size={18} className="mr-2" />}
                    {isExporting && statusMessage.includes("Word") ? "Exporting..." : "Export Word"}
                  </button>
                </div>
              </div>

              <ChatPreview chat={chatData} exportStyle={exportStyle} />
            </motion.div>
          ) : (
            !isLoading && !error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-16 text-center print:hidden border-2 border-dashed border-gray-100 rounded-2xl p-12 bg-gray-50/50"
              >
                <div className="w-16 h-16 bg-white border border-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Sparkles className="text-gray-400" size={28} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Extract</h3>
                <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Paste a URL to a shared AI chat or upload a document/JSON file above. We'll
                  automatically parse and structure the conversation for you.
                </p>
                {!session && (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <LogIn size={14} />
                    Sign in to save history across devices
                  </button>
                )}
              </motion.div>
            )
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
