/**
 * Test stub for `server-only`.
 *
 * The real package throws unless it is resolved under Next's `react-server`
 * condition, which we can't turn on in a plain `node --test` process without
 * dragging React's experimental server build in with it. Server modules import
 * it purely as a build-time guard, so an empty module is a faithful stand-in.
 */
export {};
