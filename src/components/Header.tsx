import { Link } from "@tanstack/react-router";

export default function Header() {
  return (
    <header className="p-4 bg-white shadow-sm border-b border-gray-200">
      <nav className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-800">
            <Link to="/" className="hover:text-blue-600">
              Code Review Tool
            </Link>
          </h1>
        </div>

        <div className="text-sm text-gray-600">Sync Engine Demo</div>
      </nav>
    </header>
  );
}
