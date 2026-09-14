import { NavLink } from "react-router-dom";

export default function PartnerSidebar() {
  return (
    <aside className="partner-sidebar">
      <div className="partner-brand">Partner</div>
      <nav>
        <ul>
          <li>
            <NavLink to="/partner" end>
              Overview
            </NavLink>
          </li>
          <li>
            <NavLink to="/partner/pickups">Pickups</NavLink>
          </li>
          <li>
            <NavLink to="/partner/inventory">Inventory</NavLink>
          </li>
          <li>
            <NavLink to="/partner/routes">Routes</NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
