/** Shared by the root layout (server) and the client store: where the Simple / Technical choice lives. */
export const COPY_KEY = "qsetu:copy";

/** Runs in <head> before paint. Kept tiny and dependency-free. */
export const COPY_MODE_SCRIPT = `try{var m=localStorage.getItem("${COPY_KEY}");if(m==="technical")document.documentElement.dataset.copyMode=m}catch(e){}`;
