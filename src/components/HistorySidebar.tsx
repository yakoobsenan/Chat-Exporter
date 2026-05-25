import { Clock, MessageSquare, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatHistoryItem } from "../types";

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: ChatHistoryItem[];
  onSelect: (item: ChatHistoryItem) => void;
  onClear: () => void;
}

export default function HistorySidebar({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear,
}: HistorySidebarProps) {
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40 lg:hidden print:hidden"
          />
        )}
      </AnimatePresence>

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-50 border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block print:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col pt-12 pb-6 px-4">
          <div className="flex items-center justify-between mb-8 px-2">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider flex items-center gap-2">
              <Clock size={16} />
              History
            </h2>
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-gray-500 hover:text-black rounded-md"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {history.length === 0 ? (
              <div className="text-sm text-gray-500 px-2 py-4 text-center">
                No recent conversations.
              </div>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="w-full text-left p-3 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all group flex items-start gap-3"
                >
                  <MessageSquare
                    size={16}
                    className="text-gray-400 mt-0.5 shrink-0"
                  />
                  <div className="overflow-hidden">
                    <p className="text-sm text-gray-800 font-medium truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(item.timestamp).toLocaleDateString()} •{" "}
                      {item.chatData.length} msgs
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {history.length > 0 && (
            <div className="pt-4 mt-4 border-t border-gray-200 px-2">
              <button
                onClick={onClear}
                className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                Clear History
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
