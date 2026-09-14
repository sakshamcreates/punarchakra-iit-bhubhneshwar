import PartnerSidebar from "./PartnerSidebar";

export default function PartnerShell({ children }) {
  return (
    <div className="partner-shell">
      <PartnerSidebar />
      <main className="partner-content">{children}</main>
    </div>
  );
}
