import BusinessSidebar from "./BusinessSidebar";

export default function BusinessShell({ children }) {
  return (
    <div className="business-shell">
      <BusinessSidebar />
      <main className="business-content">{children}</main>
    </div>
  );
}
