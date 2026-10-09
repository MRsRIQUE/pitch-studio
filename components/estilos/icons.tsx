/* ============================================================
   ÍCONES DO BLOCO 06

   Os `path` são copiados letra por letra de
   `miora/sections/06-skills/preview.html` (que por sua vez os tirou de
   `_fonte/js/iconfont-CIBMpbr_.js`). Não são lucide: o desenho é outro — a lupa
   tem `stroke-width .8`, o brilho tem quatro pontas e um satélite, os três
   pontos são preenchidos E contornados. Trocar por lucide muda a silhueta, e
   silhueta não está entre as três licenças.

   Os que a referência já desenha com lucide (`send`, `download`, `plus`)
   continuam vindo de `lucide-react`, que é o que temos.
   ============================================================ */

export function IconBusca({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M11.2259 11.3L13.5 13.5M12.7667 7.63333C12.7667 10.4684 10.4684 12.7667 7.63333 12.7667C4.79827 12.7667 2.5 10.4684 2.5 7.63333C2.5 4.79827 4.79827 2.5 7.63333 2.5C10.4684 2.5 12.7667 4.79827 12.7667 7.63333Z"
        stroke="currentColor"
        strokeWidth=".8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconEnviar({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 9.95801V12.2119C2.5 12.5534 2.64487 12.881 2.90273 13.1226C3.16059 13.3641 3.51033 13.4998 3.875 13.4998H12.125C12.4897 13.4998 12.8394 13.3641 13.0973 13.1226C13.3551 12.881 13.5 12.5534 13.5 12.2119V9.95801"
        stroke="currentColor"
        strokeOpacity=".9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.00052 9.79819L8.00052 2.5M8.00052 2.5L4.85767 5.28861M8.00052 2.5L11.1434 5.28861"
        stroke="currentColor"
        strokeOpacity=".9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconConversa({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.26259 2.11034C8.29473 1.9383 8.38602 1.7829 8.52067 1.67108C8.65531 1.55926 8.82482 1.49805 8.99984 1.49805C9.17487 1.49805 9.34438 1.55926 9.47902 1.67108C9.61366 1.7829 9.70496 1.9383 9.73709 2.11034L10.5253 6.27884C10.5813 6.5752 10.7253 6.84781 10.9386 7.06107C11.1519 7.27434 11.4245 7.41836 11.7208 7.47434L15.8893 8.26259C16.0614 8.29473 16.2168 8.38602 16.3286 8.52067C16.4404 8.65531 16.5016 8.82482 16.5016 8.99984C16.5016 9.17487 16.4404 9.34438 16.3286 9.47902C16.2168 9.61366 16.0614 9.70496 15.8893 9.73709L11.7208 10.5253C11.4245 10.5813 11.1519 10.7253 10.9386 10.9386C10.7253 11.1519 10.5813 11.4245 10.5253 11.7208L9.73709 15.8893C9.70496 16.0614 9.61366 16.2168 9.47902 16.3286C9.34438 16.4404 9.17487 16.5016 8.99984 16.5016C8.82482 16.5016 8.65531 16.4404 8.52067 16.3286C8.38602 16.2168 8.29473 16.0614 8.26259 15.8893L7.47434 11.7208C7.41836 11.4245 7.27434 11.1519 7.06107 10.9386C6.84781 10.7253 6.5752 10.5813 6.27884 10.5253L2.11034 9.73709C1.9383 9.70496 1.7829 9.61366 1.67108 9.47902C1.55926 9.34438 1.49805 9.17487 1.49805 8.99984C1.49805 8.82482 1.55926 8.65531 1.67108 8.52067C1.7829 8.38602 1.9383 8.29473 2.11034 8.26259L6.27884 7.47434C6.5752 7.41836 6.84781 7.27434 7.06107 7.06107C7.27434 6.84781 7.41836 6.5752 7.47434 6.27884L8.26259 2.11034Z" />
        <path d="M15 1.5V4.5" />
        <path d="M16.5 3H13.5" />
        <path d="M3 16.5C3.82843 16.5 4.5 15.8284 4.5 15C4.5 14.1716 3.82843 13.5 3 13.5C2.17157 13.5 1.5 14.1716 1.5 15C1.5 15.8284 2.17157 16.5 3 16.5Z" />
      </g>
    </svg>
  );
}

export function IconMais({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <g fill="currentColor" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" />
        <path d="M19 13C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11C18.4477 11 18 11.4477 18 12C18 12.5523 18.4477 13 19 13Z" />
        <path d="M5 13C5.55228 13 6 12.5523 6 12C6 11.4477 5.55228 11 5 11C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13Z" />
      </g>
    </svg>
  );
}
