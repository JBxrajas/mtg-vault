import { loginSchema, registerSchema } from "@mtg-vault/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { login, register } from "./auth";
import { useI18n } from "./i18n";
import { refreshSession } from "./session";

type Field = "username" | "password";
type FieldErrors = Partial<Record<Field, string>>;
type T = ReturnType<typeof useI18n>["t"];

/** Checks the whole form at once, so every wrong field is flagged and not just the first one. */
export function validateForm(mode: "login" | "register", input: { username: string; password: string }, t: T): FieldErrors {
  const errors: FieldErrors = {};
  if (input.username.includes("@")) errors.username = t("login.noEmail");
  const parsed = (mode === "register" ? registerSchema : loginSchema).safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field !== "username" && field !== "password") || errors[field]) continue;
      if (mode === "login") errors[field] = t(field === "username" ? "login.enterUsername" : "login.enterPassword");
      else if (field === "username")
        errors.username = t(
          issue.code === "too_small" ? "login.username.min" : issue.code === "too_big" ? "login.username.max" : "login.username.chars",
        );
      else errors.password = t(issue.code === "too_big" ? "login.password.max" : "login.password.min");
    }
  }
  return errors;
}

/** A taken username belongs to the username field; anything else is a general error. */
export const serverFieldError = (message: string): Field | null =>
  /username/i.test(message) && /taken|exists|already/i.test(message) ? "username" : null;

/** The server answers in English; the messages we know get translated, any other is shown as it came. */
export function serverMessage(message: string, t: T): string {
  if (/invalid username or password/i.test(message)) return t("login.error.invalid");
  if (serverFieldError(message)) return t("login.error.taken");
  return message;
}

export function LoginPage() {
  const { t } = useI18n();
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
    const errors = validateForm(mode, { username, password }, t);
    setFieldErrors(errors);
    if (errors.username || errors.password) return;
    const input = { username: username.trim(), password };
    setBusy(true);
    try {
      if (mode === "register") await register(input);
      else await login(input);
      await refreshSession(queryClient);
      await navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const field = mode === "register" ? serverFieldError(message) : null;
      if (field) setFieldErrors({ [field]: serverMessage(message, t) });
      else setError(message ? serverMessage(message, t) : t("login.error.generic"));
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
        <h1>{mode === "login" ? t("auth.signIn") : t("login.createTitle")}</h1>
        <p className="hint">{mode === "register" ? t("login.registerHint") : t("login.loginHint")}</p>
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="username">{t("login.username")}</label>
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
              {fieldErrors.username ?? t("login.usernameRules")}
            </span>
          </div>
          <div className="field">
            <label htmlFor="password">{t("login.password")}</label>
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
              {fieldErrors.password ?? (mode === "register" ? t("login.passwordRules") : "")}
            </span>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? t("login.wait") : mode === "login" ? t("auth.signIn") : t("login.createButton")}
          </button>
        </form>
        <p>
          <button type="button" className="link" onClick={switchMode}>
            {mode === "login" ? t("login.toRegister") : t("login.toLogin")}
          </button>
        </p>
        <p>
          <Link to="/">{t("login.back")}</Link>
        </p>
      </div>
    </main>
  );
}
