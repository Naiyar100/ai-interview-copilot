import { useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

const navLinks = [
  { name: "Home", to: "/", className: "active" },
  { name: "Login", to: "/login" },
  { name: "Sign up", to: "/signup", className: "signup" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar" aria-label="Main navigation">
      <Link className="brand" to="/">
        <span className="brand-mark" aria-hidden="true">AI</span>
        AI Interview Copilot
      </Link>

      <button
        className="menu-button"
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">☰</span>
      </button>

      <div className={`nav-links ${menuOpen ? "open" : ""}`}>
        {navLinks.map((link) => (
          <Link
            key={link.name}
            to={link.to}
            className={link.className || ""}
            onClick={() => setMenuOpen(false)}
          >
            {link.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}