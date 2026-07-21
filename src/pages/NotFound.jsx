import { Link } from "react-router-dom";

function NotFound() {
  return (
    <main>
      <h1>404</h1>
      <p>Page not found</p>
      <Link to="/">Go Home</Link>
    </main>
  );
}

export default NotFound;