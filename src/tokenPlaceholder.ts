/**
 * Admin commands are shared across charge points, but the token to authorize
 * with differs per station and is configured per env file as TOKEN. To avoid
 * editing the commands for every station, they send this placeholder as the
 * token and the matching `beforeSend` hook substitutes TOKEN before sending.
 *
 * A token other than the placeholder is always sent as-is, so a command that
 * spells out a real token keeps working. The placeholder is also left as-is
 * when TOKEN is not set - the CSMS then rejects a recognisable value rather
 * than the command silently authorizing as someone else.
 */
export const TOKEN_PLACEHOLDER = "__TOKEN__";

export const resolveTokenPlaceholder = (token: string): string => {
  if (token !== TOKEN_PLACEHOLDER) {
    return token;
  }
  return process.env.TOKEN ?? token;
};
