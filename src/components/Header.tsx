import { FileText } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center space-x-3 print:hidden">
      <div className="bg-black text-white p-2 flex items-center justify-center rounded-lg shadow-sm">
        <FileText size={24} />
      </div>
      <div>
        <h1 className="text-xl font-medium tracking-tight text-gray-900">
          Chat Exporter
        </h1>
        <p className="text-sm text-gray-500 font-medium">
          Convert AI conversations to PDF or Word
        </p>
      </div>
    </header>
  );
}
