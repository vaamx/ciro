/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUBSPOT_CLIENT_ID: string;
  readonly VITE_HUBSPOT_CLIENT_SECRET: string;
  readonly VITE_API_URL: string;
  readonly VITE_HUBSPOT_SCOPES: string;
  readonly VITE_HUBSPOT_REDIRECT_URI: string;
  readonly VITE_SALESFORCE_CLIENT_ID: string;
  readonly VITE_ZOHO_CLIENT_ID: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_OAUTH_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Ensure Vite includes ImportMetaEnv
declare module '@env' {
  export interface ImportMetaEnv extends ImportMetaEnv {}
} 