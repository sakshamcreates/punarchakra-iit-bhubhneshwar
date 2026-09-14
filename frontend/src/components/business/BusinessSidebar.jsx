import { NavLink } from "react-router-dom";

export default function BusinessSidebar() {
  return (
    <aside className="business-sidebar">
      <div className="business-brand">Business</div>
      <nav>
        <ul>
          <li><NavLink to="/business" end>Overview</NavLink></li>
          <li><NavLink to="/business/assets">Asset Upload</NavLink></li>
          <li><NavLink to="/business/strategy">Selling Strategy</NavLink></li>
          <li><NavLink to="/business/csr">CSR Impact</NavLink></li>
          <li><NavLink to="/business/procurement">Procurement</NavLink></li>
        </ul>
      </nav>
    </aside>
  );
}
