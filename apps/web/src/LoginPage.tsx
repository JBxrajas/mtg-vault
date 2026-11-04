import { loginSchema, registerSchema } from "@mtg-vault/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { login, register } from "./auth";

type Field = "username" | "password";
type FieldErrors = Partial<Record<Field, string>>;

const NO_EMAIL = "Use a username, not an email: emails are not used here";

/** Checks the whole form at once, so every wrong field is flagged and not just the first one. */
export function validateForm(mode: "login" | "register", input: { username: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (input.username.includes("@")) errors.username = NO_EMAIL;
  const parsed = (mode === "register" ? registerSchema : loginSchema).safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "username" || field === "password") && !errors[field]) {
        errors[field] =
          mode === "login" ? `Enter your ${field}` : issue.message;
      }
    }
  }
  return errors;
}

/** A taken username belongs to the username field; anything else is a general error. */
export const serverFieldError = (message: string): Field | null =>
  /username/i.test(message) && /taken|exists|already/i.test(message) ? "username" : null;

export function LoginPage() {
  const search = useSearch({ strict: false }) as { mode?: string };
  const [mode, setMode] = useState<"login" | "register">(search.mode === "register" ? "register" : "login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const clear = (field: Field) => {
    setFieldErrors((cur) => ({ ...cur, [field]: undefined }));
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validateForm(mode, { username, password });
    setFieldErrors(errors);
    if (errors.username || errors.password) return;
    const input = { username: username.trim(), password };
    setBusy(true);
    try {
      if (mode === "register") await register(input);
      else await login(input);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      const field = mode === "register" ? serverFieldError(message) : null;
      if (field) setFieldErrors({ [field]: message });
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setFieldErrors({});
    setError(null);
  };

  return (
    <main className="page">
      <div className="auth-card">
        <h1>{mode === "login" ? "Sign in" : "Create your account"}</h1>
        <p className="hint">
          {mode === "register"
            ? "Free. No email needed: just pick a username and a password."
            : "Use your username, not an email."}
        </p>
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                clear("username");
              }}
              autoComplete="username"
              autoCapitalize="none"
              aria-invalid={!!fieldErrors.username}
              aria-describedby="username-help"
            />
            <span id="username-help" className={fieldErrors.username ? "field-error" : "field-help"} role={fieldErrors.username ? "alert" : undefined}>
              {fieldErrors.username ?? "3–30 characters: letters, digits, underscore or dot."}
            </span>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clear("password");
              }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              aria-invalid={!!fieldErrors.password}
              aria-describedby="password-help"
            />
            <span id="password-help" className={fieldErrors.password ? "field-error" : "field-help"} role={fieldErrors.password ? "alert" : undefined}>
              {fieldErrors.password ?? (mode === "register" ? "At least 8 characters." : "")}
            </span>
          </div>
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
          <button type="button" className="link" onClick={switchMode}>
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
