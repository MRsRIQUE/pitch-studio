"use client";

/* ============================================================
   A GALERIA NA TELA DE PROJETO

   O encaixe do painel do BoardUI em `/workflow/<id>`, que é a posição que ele
   tem na referência: ao lado da conversa. Este arquivo é a costura — busca as
   peças, guarda a gaveta e desenha o botão que reabre. O painel em si é o
   `GaleriaLateral`; a geometria da montagem está em `galeria-projeto.css`.

   O painel NÃO desmonta ao fechar: ele fica no DOM com `data-recolhido` e
   desliza para fora. É o mesmo desenho do painel de chat — sem isso não há
   transição, só um sumiço.

   As peças são as gerações da conta, do mesmo `/api/gallery` que o Acervo lê,
   com `source=generation`: o que foi só enviado não tem prompt, e sem prompt
   não há legenda nem remix.
   ============================================================ */

import * as React from "react";
import { useRouter } from "next/navigation";
import { PanelRightOpen } from "lucide-react";
import { getToken, type GalleryItem } from "@/lib/galleryUtils";
import { remixToComposer } from "@/lib/remixHandoff";
import { useGaleriaSessao } from "@/lib/galeriaSessao";
import { GaleriaLateral } from "@/components/inspiracao/GaleriaLateral";
import { InspiracaoPreview } from "@/components/inspiracao/InspiracaoPreview";
import "@/components/inspiracao/inspiracao.css";
import "./galeria-projeto.css";

export function GaleriaProjeto() {
  const router = useRouter();

  const aberta = useGaleriaSessao((e) => e.aberta);
  const largura = useGaleriaSessao((e) => e.largura);
  const abrir = useGaleriaSessao((e) => e.abrir);
  const fechar = useGaleriaSessao((e) => e.fechar);
  const definirLargura = useGaleriaSessao((e) => e.definirLargura);

  const [itens, setItens] = React.useState<GalleryItem[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [previa, setPrevia] = React.useState<GalleryItem | null>(null);

  /* A busca só acontece quando a gaveta abre pela primeira vez: quem trabalha
     no canvas com a galeria fechada não paga duas requisições por isso. */
  const jaBuscou = React.useRef(false);
  React.useEffect(() => {
    if (!aberta || jaBuscou.current) return;
    jaBuscou.current = true;
    let vivo = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const [imagem, video] = await Promise.all([
          fetch("/api/gallery?type=image&page=0&source=generation", { headers }),
          fetch("/api/gallery?type=video&page=0&source=generation", { headers }),
        ]);
        const ler = async (res: Response) =>
          res.ok ? (await res.json() as { items: GalleryItem[] }).items : [];
        const todos = [...await ler(imagem), ...await ler(video)]
          .filter((entrada) => entrada.url)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (vivo) setItens(todos);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [aberta]);

  const remixar = React.useCallback((item: GalleryItem) => {
    const destino = remixToComposer({
      prompt: item.prompt,
      model: item.model,
      aspectRatio: item.aspect_ratio,
      quality: item.quality,
      azureResolution: item.azure_resolution,
      referenceImageUrls: item.referenceImageUrls,
      mediaType: item.mediaType,
    });
    if (destino) router.push(destino);
  }, [router]);

  return (
    <>
      <GaleriaLateral
        className="gal--sobre-grafo"
        recolhido={!aberta}
        itens={itens}
        carregando={carregando}
        largura={largura}
        onLargura={definirLargura}
        onAmpliar={setPrevia}
        onRemixar={remixar}
        onNovaGeracao={() => router.push("/gallery?tab=images&view=create")}
        onRecolher={fechar}
      />

      {!aberta && (
        <button type="button" className="gal-abrir" aria-label="Abrir a galeria" onClick={abrir}>
          <span>
            <PanelRightOpen size={18} strokeWidth={1.75} />
          </span>
        </button>
      )}

      {previa && (
        <InspiracaoPreview
          item={previa}
          onClose={() => setPrevia(null)}
          onRemix={(item) => { setPrevia(null); remixar(item); }}
        />
      )}
    </>
  );
}
