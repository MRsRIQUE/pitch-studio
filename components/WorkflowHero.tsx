import { Workflow, ImageIcon, Film, ArrowRight } from "lucide-react";

export function WorkflowHero() {
  return (
    <section className="miora-workflow-hero">
      <div><span>Seu processo criativo</span><h2>Conecte ideias.<br />Crie possibilidades.</h2><p>Organize referências, prompts e modelos em um fluxo visual que acompanha seu jeito de criar.</p></div>
      <div className="miora-workflow-preview" aria-hidden="true">
        <div><ImageIcon size={24} /><span>Referência</span></div><ArrowRight size={20} />
        <div><Workflow size={24} /><span>Workflow</span></div><ArrowRight size={20} />
        <div><Film size={24} /><span>Criação</span></div>
      </div>
    </section>
  );
}
