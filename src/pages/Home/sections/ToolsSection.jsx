import { TOOL_GROUPS } from '../../../data/tools';
import { useTilt } from '../../../hooks/useTilt';

function ToolChip({ tool }) {
  const ref = useTilt();
  return (
    <div className="tool-chip" ref={ref}>
      <span className="tool-avatar">{tool.avatar}</span>
      {tool.name}
    </div>
  );
}

export default function ToolsSection() {
  return (
    <section className="alt" id="tools">
      <div className="wrap">
        <div className="sec-head">
          <div className="sec-eyebrow">OUTILS</div>
          <h2 className="sec-title">Un savoir-faire technique, augmenté par l'IA.</h2>
        </div>

        {TOOL_GROUPS.map((group) => (
          <div className="tool-group" key={group.label}>
            <span className="tool-group-label">{group.label}</span>
            <div className="tool-grid">
              {group.tools.map((tool) => (
                <ToolChip tool={tool} key={tool.name} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
