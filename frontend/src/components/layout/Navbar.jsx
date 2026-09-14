import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Button from "../ui/Button";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">↺</span>
          <span>Punarchakra</span>
        </Link>
        <nav className="nav-links">
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/auctions">Auctions</Link>
          <Link to="/scrap">Scrap Pickup</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/agent/demo">Agent Demo</Link>
        </nav>
        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              <span className="navbar-user">{user?.name || "Account"}</span>
              <Button variant="secondary" onClick={logout}>Logout</Button>
            </>
          ) : (
            <Button as={Link} variant="secondary" to="/auth">
              Account
            </Button>
          )}
          <Button as={Link} variant="primary" to="/sell">
            Sell Item
          </Button>
        </div>
      </div>
    </header>
  );
}
