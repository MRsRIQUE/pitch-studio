/** Cookie do tema do Studio, lido pelo layout (servidor) e gravado pelo toggle. */
export const TEMA_COOKIE = "ss_tema";

/**
 * Roda antes da pintura quando ainda não há escolha salva: segue o tema do
 * sistema. Com cookie, quem decide é o layout no servidor.
 */
export const TEMA_SCRIPT_INICIAL = `try{if(!document.cookie.split("; ").some(function(c){return c.indexOf("${"ss_tema"}=")===0})&&matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark")}}catch(e){}`;
