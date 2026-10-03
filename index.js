/**
 * Host half of dsh-plugin-sidebar-polish.
 *
 * This plugin is browser-only: everything it does is a stylesheet on the Web
 * surface. The host half exists because every profile row needs a Node-side
 * module; a no-op is legitimate (the shipped `dsh-client-ui-sidebar` does the
 * same).
 */

/** @type {string[]} No Cordis services are required. */
export const inject = [];

/**
 * Host plugin body.
 * @param ctx - Cordis context (unused).
 */
export function apply(ctx) {}
