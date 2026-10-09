import { TOOL_GROUPS } from '../../../data/tools';
import { useTilt } from '../../../hooks/useTilt';
import { useReveal } from '../../../hooks/useReveal';
import RevealHeading from '../../../components/site/RevealHeading';

function ToolChip({ tool }) {
  const ref = useTilt();
  return (
    <div className="tool-chip" ref={ref}>
      <span className="tool-avatar">{tool.avatar}</span>
      {tool.name}
    </div>
  );
}

function ToolGroup({ group, index }) {
  const [ref, visible] = useReveal();
  return (
    <div className={`tool-group reveal${visible ? ' in' : ''}`} ref={ref}
      style={{ transitionDelay: `${Math.min(index * 100, 300)}ms` }}>
      <span className="tool-group-label">{group.label}</span>
      <div className="tool-grid">
        {group.tools.map((tool) => (
          <ToolChip tool={tool} key={tool.name} />
        ))}
      </div>
    </div>
  );
}

export default function ToolsSection() {
  return (
    <section className="alt" id="tools">
      <div className="wrap">
        <RevealHeading eyebrow="OUTILS">Un savoir-faire technique, augmenté par l'IA.</RevealHeading>
        {TOOL_GROUPS.map((group, index) => (
          <ToolGroup group={group} index={index} key={group.label} />
        ))}
      </div>
    </section>
  );
}
