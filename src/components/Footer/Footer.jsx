import { Link } from "react-router-dom";
import "./Footer.css";

const footerLinks = [
  { name: "Home", to: "/" },
  { name: "Login", to: "/login" },
  { name: "Signup", to: "/signup" },
];

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-main">
          <div className="footer-brand-area">
            <Link className="footer-brand" to="/">
              <span className="footer-logo" aria-hidden="true">AI</span>
              AI Interview Copilot
            </Link>
            <p>Practice smarter. Interview better.</p>
          </div>

          <nav className="footer-links" aria-label="Footer navigation">
            {footerLinks.map((link) => (
                <Link
                    key={link.name}
                    to={link.to}
                >
                    {link.name}
                </Link>
            ))}
          </nav>
        </div>

        <div className="footer-bottom">
          <p>
            Built by <strong>Naiyar Alam</strong>
          </p>
          <p>© 2026 AI Interview Copilot. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;