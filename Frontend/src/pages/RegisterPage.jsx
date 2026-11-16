import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import FormField from "../components/auth/FormField";
import AuthSubmitButton from "../components/auth/AuthSubmitButton";
import Alert from "../components/ui/Alert";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../api/client";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout eyebrow="Get started" title="Create your account" subtitle="Register and start chatting right away."
      footer={<p className="text-center text-sm text-muted">Already have an account? <Link className="font-semibold text-brand" to="/login">Sign in</Link></p>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Username" autoComplete="username" minLength={3} maxLength={50} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Choose a username" />
        <FormField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        <FormField label="Password" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
        {error && <Alert>{error}</Alert>}
        <AuthSubmitButton busy={busy}>Create account</AuthSubmitButton>
      </form>
    </AuthLayout>
  );
}