import { useRef, useState } from 'react';
import { parseSTL } from '../parsers/stl.js';
import { parseOBJ  } from '../parsers/obj.js';
import { parseSTEP } from '../parsers/step.js';
import { PART_PALETTE, DEFAULTS } from '../utils/constants.js';
import { generateBoxGeometry } from '../utils/three-helpers.js';

const ACCEPT = '.step,.stp,.iges,.igs,.stl,.obj';

export default function FileDropZone({ onBodiesLoaded }) {
  const [dragging, setDragging]   = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [status,   setStatus]     = useState('');
  const [error,    setError]      = useState('');
  const inputRef = useRef(null);

  async function processFiles(files) {
    setLoading(true);
    setError('');
    setStatus('Reading files…');

    const all = [];
    let colorIdx = 0;

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      try {
        const buffer = await file.arrayBuffer();
        let bodies = [];

        if (ext === 'stl') {
          setStatus(`Parsing STL: ${file.name}`);
          bodies = await parseSTL(buffer);
        } else if (ext === 'obj') {
          setStatus(`Parsing OBJ: ${file.name}`);
          bodies = await parseOBJ(new TextDecoder().decode(buffer));
        } else if (['step', 'stp', 'iges', 'igs'].includes(ext)) {
          bodies = await parseSTEP(buffer, ext === 'iges' || ext === 'igs', setStatus);
        } else {
          continue;
        }

        for (const body of bodies) {
          body.id      = `${file.name}::${all.length}`;
          body.isSheet = body.thickness <= DEFAULTS.thicknessThreshold;
          body.checked = body.isSheet;
          body.color   = PART_PALETTE[colorIdx % PART_PALETTE.length];
          colorIdx++;
          all.push(body);
        }
      } catch (e) {
        setError(`Error in ${file.name}: ${e.message}`);
        console.error(e);
      }
    }

    setLoading(false);
    setStatus('');
    if (all.length > 0) onBodiesLoaded(all);
  }

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles([...e.dataTransfer.files]);
  };

  return (
    <div
      className={`drop-zone${dragging ? ' dragging' : ''}`}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => { processFiles([...e.target.files]); e.target.value = ''; }}
      />

      {loading ? (
        <div className="drop-loading">
          <div className="spinner" />
          <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>{status || 'Processing…'}</p>
        </div>
      ) : (
        <>
          <div className="drop-icon" style={{ fontSize: 52, color: 'var(--text-dim)' }}>
            ⬇
          </div>
          <p>Drop 3D files here or click to browse</p>
          <p className="drop-hint">.step &nbsp;.stp &nbsp;.iges &nbsp;.igs &nbsp;.stl &nbsp;.obj</p>
          {error && <p className="drop-error">{error}</p>}
        </>
      )}
    </div>
  );
}

/**
 * Build demo bodies from the constant list — used in App "Demo" button.
 */
export function buildDemoBodies(rawList, thicknessThreshold = DEFAULTS.thicknessThreshold) {
  return rawList.map((raw, i) => {
    const dims = [raw.w, raw.h, raw.t].sort((a, b) => b - a);
    const { positions, normals } = generateBoxGeometry(raw.w, raw.h, raw.t);
    return {
      id:        `demo::${i}`,
      name:      raw.name,
      positions,
      normals,
      indices:   null,
      w:         dims[0],
      h:         dims[1],
      thickness: dims[2],
      isSheet:   raw.t <= thicknessThreshold,
      checked:   raw.t <= thicknessThreshold,
      color:     PART_PALETTE[i % PART_PALETTE.length],
      demo:      true,
    };
  });
}
