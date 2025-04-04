/**
 * @deprecated This file is kept as a placeholder to prevent build errors.
 * Form-based authentication has replaced OAuth for Snowflake connections.
 */

export const initiateSnowflakeOAuth = (account: string): void => {
  console.warn(`Snowflake OAuth has been deprecated for account "${account}". Please use the form-based authentication instead.`);
};

export const handleSnowflakeOAuthCallback = (): void => {
  console.warn('Snowflake OAuth has been deprecated. Please use the form-based authentication instead.');
}; 