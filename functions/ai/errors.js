// A failed AI run (message: refused | too-long | bad-output | empty). The
// run is released, so it costs the user nothing.
export class AiError extends Error {}
