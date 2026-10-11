import RevealHeading from '../../../components/site/RevealHeading';

const MODEL_URL = 'https://sketchfab.com/models/4c7e5d3e964541e7a3c5eb719ab80dac/embed';

export default function SketchfabSection() {
  return (
    <section className="alt" id="model-3d">
      <div className="wrap">
        <RevealHeading eyebrow="MODÈLE 3D">Découvrez « Little Boy » en 3D.</RevealHeading>
        <div className="sketchfab-viewer">
          <iframe
            title="Little Boy — modèle 3D interactif sur Sketchfab"
            src={MODEL_URL}
            allow="autoplay; fullscreen; xr-spatial-tracking"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p className="sketchfab-credit">
          Modèle <a href="https://sketchfab.com/3d-models/little-boy-4c7e5d3e964541e7a3c5eb719ab80dac" target="_blank" rel="noopener noreferrer">Little Boy</a>
          {' '}créé par <a href="https://sketchfab.com/fcampos" target="_blank" rel="noopener noreferrer">Fabricio Campos</a>
          {' '}et hébergé sur <a href="https://sketchfab.com" target="_blank" rel="noopener noreferrer">Sketchfab</a>.
        </p>
      </div>
    </section>
  );
}
