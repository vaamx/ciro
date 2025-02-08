/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_OAUTH_REDIRECT_URI: string;
  readonly VITE_OAUTH_CLIENT_ID: string;
  readonly VITE_HUBSPOT_CLIENT_ID: string;
  readonly VITE_HUBSPOT_CLIENT_SECRET: string;
  readonly VITE_SALESFORCE_CLIENT_ID: string;
  readonly VITE_ZOHO_CLIENT_ID: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
