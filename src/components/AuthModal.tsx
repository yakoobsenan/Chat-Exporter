import { useState } from "react";
import { supabase } from "../lib/supabase";
import { X, Loader as Loader2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AuthModalProps {
  onClose: () => void;
}

type AuthMode = "login" | "register";

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-black text-white p-1.5 rounded-lg">
              <FileText size={18} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === "login" ? "Sign in" : "Create account"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-5">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="text-black font-medium hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </motion.div>
  );
}
