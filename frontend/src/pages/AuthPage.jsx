import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "consumer", location: "Delhi" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await register({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          location: form.location
        });
      } else {
        await login({ email: form.email, password: form.password });
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container section" style={{ maxWidth: 560 }}>
      <div className="page-intro">
        <div className="eyebrow">Account</div>
        <h1>{mode === "login" ? "Sign in to Punarchakra" : "Create your Punarchakra account"}</h1>
        <p>Use the live auth backend for the demo flow while keeping the existing experience intact.</p>
      </div>

      <Card className="wizard-panel">
        <div className="wizard-actions" style={{ marginBottom: 16 }}>
          <Button variant={mode === "login" ? "primary" : "secondary"} onClick={() => setMode("login")}>Log in</Button>
          <Button variant={mode === "register" ? "primary" : "secondary"} onClick={() => setMode("register")}>Register</Button>
        </div>

        <form onSubmit={handleSubmit} className="question-stack">
          {mode === "register" ? (
            <div className="form-field">
              <label>Name</label>
              <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
            </div>
          ) : null}
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required />
          </div>
          {mode === "register" ? (
            <>
              <div className="form-field">
                <label>Role</label>
                <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
                  <option value="consumer">Consumer</option>
                  <option value="kabadiwala">Kabadiwala</option>
                  <option value="business">Business</option>
                  <option value="repair_shop">Repair Shop</option>
                  <option value="recycler">Recycler</option>
                </select>
              </div>
              <div className="form-field">
                <label>Location</label>
                <input value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} required />
              </div>
            </>
          ) : null}

          {error ? <p className="page-intro__description">{error}</p> : null}

          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
