interface OAuthConfig {
  clientId: string;
  responseType: string;
  scope: string;
  authUrl: string;
  additionalParams: Record<string, string>;
}

export const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  // Add OAuth configurations here as needed
  // Example:
  // 'crm-hubspot': {
  //   clientId: 'your-client-id',
  //   responseType: 'code',
  //   scope: 'contacts',
  //   authUrl: 'https://app.hubspot.com/oauth/authorize',
  //   additionalParams: {}
  // }
}; 