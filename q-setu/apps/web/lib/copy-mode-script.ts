/** Shared by the root layout (server) and the client store: where the Simple / Technical choice lives. */
export const COPY_KEY = "qsetu:copy";

/** Runs in <head> before paint. Kept tiny and dependency-free. */
export const COPY_MODE_SCRIPT = `try{var m=localStorage.getItem("${COPY_KEY}");if(m==="technical")document.documentElement.dataset.copyMode=m}catch(e){}`;

/**
 * Runs in <head> before paint, on the homepage only: its sealed headlines stay blank until the
 * browser has their ciphertext (lib/client/trust). If that hasn't happened within 3.5 s (no script,
 * no network) the plain text shows. Without JavaScript this never runs and the text shows at once.
 */
export const SEAL_SCRIPT = `try{if(location.pathname==="/"){var d=document.documentElement;d.dataset.seal="pending";setTimeout(function(){if(d.dataset.seal==="pending")d.dataset.seal="plain"},3500)}}catch(e){}`;
