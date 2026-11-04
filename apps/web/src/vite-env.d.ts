/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API. Defaults to localhost in dev and the production API otherwise. */
  readonly VITE_API_URL?: string;
}
