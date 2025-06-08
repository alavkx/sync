import { Link } from "@tanstack/react-router";

export default function Header() {
  return (
    <header
      style={{
        padding: "1rem",
        borderBottom: "1px solid #eee",
        marginBottom: "1rem",
      }}
    >
      <nav>
        <Link to="/" style={{ textDecoration: "none", fontWeight: "bold" }}>
          Code Review Tool
        </Link>
      </nav>
    </header>
  );
}
