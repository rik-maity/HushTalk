import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import FormField from "../components/auth/FormField";
import AuthSubmitButton from "../components/auth/AuthSubmitButton";
import Alert from "../components/ui/Alert";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../api/client";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await login(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in to HushTalk" subtitle="Enter your account details to continue."
      footer={<p className="text-center text-sm text-muted">New to HushTalk? <Link className="font-semibold text-brand" to="/register">Create an account</Link></p>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        <FormField label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Your password" />
        {error && <Alert>{error}</Alert>}
        <AuthSubmitButton busy={busy}>Sign in</AuthSubmitButton>
      </form>
    </AuthLayout>
  );
}