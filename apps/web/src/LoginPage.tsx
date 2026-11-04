import { loginSchema, registerSchema } from "@mtg-vault/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { login, register } from "./auth";

export function LoginPage() {
  const search = useSearch({ strict: false }) as { mode?: string };
  const [mode, setMode] = useState<"login" | "register">(search.mode === "register" ? "register" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { username, password };
    const parsed = (mode === "register" ? registerSchema : loginSchema).safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") await register(parsed.data as { username: string; password: string });
      else await login(parsed.data);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="auth-card">
      <h1>{mode === "login" ? "Sign in" : "Create your account"}</h1>
      {mode === "register" && (
        <p className="hint">Free. No email needed: just pick a username and a password.</p>
      )}
      <form className="auth-form" onSubmit={submit}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
        </label>
        {mode === "register" && (
          <p className="hint">3–30 characters: letters, digits, underscore or dot. Password: at least 8 characters.</p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "No account? Create one" : "Already have an account? Sign in"}
        </button>
      </p>
      <p>
        <Link to="/">Back to search</Link>
      </p>
      </div>
    </main>
  );
}
