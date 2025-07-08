import React, { useRef, useEffect, useState } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-java";
import "prismjs/themes/prism-tomorrow.css";

// Colores por tipo de bean
const BEAN_COLORS = {
  component: "#27ae60",   // verde
  service:   "#e67e22",   // naranja
  repository: "#2980b9", // azul
  controller: "#8e44ad",  // violeta
  bean:      "#00bcd4"    // celeste para beans de configuración
};

// Extrae el cuerpo de una clase a partir de la posición de la llave de apertura
function extractClassBody(text, startIdx) {
  let open = 0;
  let body = '';
  let started = false;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '{') {
      open++;
      started = true;
    } else if (text[i] === '}') {
      open--;
    }
    if (started) body += text[i];
    if (started && open === 0) break;
  }
  return body;
}

// Parser mejorado para beans con tags y métodos @Bean
function parseBeans(text) {
  // Regex para encontrar clases anotadas
  const beanRegex = /@(Component|Service|Repository|Controller|RestController)\s*(\((?:\s*value\s*=)?\s*"([^"]+)"\s*\))?\s*public\s+class\s+(\w+)\s*\{/g;
  const configClassRegex = /@Configuration\s*public\s+class\s+(\w+)\s*\{/g;
  // Mejorar el regex para métodos @Bean: acepta cualquier visibilidad, cualquier tipo, cualquier contenido entre llaves
  const beanMethodRegex = /@Bean\s*(\((?:\s*value\s*=)?\s*"([^"]+)"\s*\))?\s*(public|protected|private)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*\{[\s\S]*?return[\s\S]*?\}/g;

  const beans = [];
  let match;
  // Beans por anotación de clase
  while ((match = beanRegex.exec(text)) !== null) {
    let typeRaw = match[1];
    const explicitName = match[3];
    const className = match[4];
    let type = typeRaw.toLowerCase();
    if (type === "restcontroller") type = "controller";
    let beanName = explicitName;
    if (!beanName) {
      beanName = className.charAt(0).toLowerCase() + className.slice(1);
    }
    beans.push({ className, beanName, type });
  }
  // Beans por métodos @Bean en clases @Configuration
  while ((match = configClassRegex.exec(text)) !== null) {
    const classStart = match.index + match[0].length - 1;
    const configBody = extractClassBody(text, classStart);
    // Solo considerar clases válidas las que tengan llaves de apertura y cierre
    const declaredClasses = Array.from(text.matchAll(/public\s+class\s+(\w+)\s*\{[\s\S]*?\}/g)).map(m => m[1]);
    for (const m of configBody.matchAll(/@Bean[\s\S]*?(public|protected|private)?[\s\S]*?\w+\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g)) {
      const methodName = m[2];
      const body = m[3];
      // Solo agregar el bean si hay return ...; en el cuerpo
      const returnMatch = body.match(/return\s+new\s+(\w+)\s*\(/);
      const hasValidReturn = /return[\s\S]*?;/g.test(body);
      if (hasValidReturn && returnMatch && declaredClasses.includes(returnMatch[1])) {
        // Buscar nombre explícito
        const beanTagMatch = m[0].match(/@Bean\s*\((?:\s*value\s*=)?\s*"([^"]+)"\s*\)/);
        let beanName = beanTagMatch ? beanTagMatch[1] : methodName;
        beans.push({ className: methodName, beanName, type: "bean" });
      }
    }
  }
  return beans;
}

const CANVAS_HEIGHT = 600;
const BEAN_RADIUS = 40;
const BEAN_GAP = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

function getGridLayout(n) {
  if (n === 0) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

export default function BeanVisualizer() {
  const [code, setCode] = useState(`@Component\npublic class BeanA{}\n\n@Component\npublic class BeanB{}`);
  const [beans, setBeans] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [canvasWidth, setCanvasWidth] = useState(600);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const parsed = parseBeans(code);
    console.log('BEANS DETECTADOS', parsed);
    setBeans(parsed);
    // Advertencia por desbalance de llaves
    const open = (code.match(/\{/g) || []).length;
    const close = (code.match(/\}/g) || []).length;
    setBracketWarning(open !== close ? `Advertencia: El número de llaves de apertura ({) y cierre (}) no coincide (${open} vs ${close}).` : null);
    // Advertencia por falta de punto y coma en return de métodos @Bean
    const beanMethodBlocks = [];
    const configClassRegex = /@Configuration\s*public\s+class\s+\w+\s*\{/g;
    let match;
    while ((match = configClassRegex.exec(code)) !== null) {
      const classStart = match.index + match[0].length - 1;
      const configBody = extractClassBody(code, classStart);
      const beanMethodRegex = /@Bean[\s\S]*?(public|protected|private)?[\s\S]*?\w+\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g;
      let m;
      while ((m = beanMethodRegex.exec(configBody)) !== null) {
        beanMethodBlocks.push({
          methodName: m[2],
          body: m[3]
        });
      }
    }
    let missingSemicolon = false;
    let missingReturn = false;
    let missingReturnMethods = [];
    let missingSemicolonMethods = [];
    for (const block of beanMethodBlocks) {
      // Buscar línea return ... ;
      const returnLines = block.body.match(/return[\s\S]*?;/g);
      const hasReturn = /return[\s\S]*?/.test(block.body);
      if (!hasReturn) {
        missingReturn = true;
        missingReturnMethods.push(block.methodName);
      } else if (!returnLines) {
        missingSemicolon = true;
        missingSemicolonMethods.push(block.methodName);
      }
    }
    setReturnWarning(
      missingReturn
        ? `Advertencia: El método @Bean${missingReturnMethods.length > 1 ? 's' : ''} '${missingReturnMethods.join(", ")}' no tiene${missingReturnMethods.length > 1 ? 'n' : ''} una sentencia return.`
        : missingSemicolon
        ? `Advertencia: El método @Bean${missingSemicolonMethods.length > 1 ? 's' : ''} '${missingSemicolonMethods.join(", ")}' no tiene${missingSemicolonMethods.length > 1 ? 'n' : ''} punto y coma (;) al final de la línea return.`
        : null
    );
    // Advertencia: misma clase, diferentes nombres de bean
    const classToNames = {};
    parsed.forEach(bean => {
      if (!classToNames[bean.className]) classToNames[bean.className] = new Set();
      classToNames[bean.className].add(bean.beanName);
    });
    let multiNameWarning = null;
    Object.entries(classToNames).forEach(([className, names]) => {
      if (names.size > 1) {
        multiNameWarning = `Advertencia: La clase "${className}" está registrada como más de un bean con nombres distintos: ${Array.from(names).join(", ")}.`;
      }
    });
    setMultiNameWarning(multiNameWarning);
    // Advertencia: return de método @Bean con clase no declarada
    const declaredClasses = Array.from(code.matchAll(/public\s+class\s+(\w+)/g)).map(m => m[1]);
    let missingClassWarnings = [];
    for (const block of beanMethodBlocks) {
      const returnNew = block.body.match(/return\s+new\s+(\w+)\s*\(/);
      if (returnNew && !declaredClasses.includes(returnNew[1])) {
        missingClassWarnings.push(`Advertencia: El método @Bean '${block.methodName}' retorna un objeto de tipo '${returnNew[1]}', pero no existe ninguna clase declarada con ese nombre.`);
      }
    }
    setMissingClassWarnings(missingClassWarnings);
  }, [code]);

  // ResizeObserver para el ancho del contenedor
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.offsetWidth);
      }
    };
    handleResize();
    const observer = new window.ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calcular cuadrícula y espacio virtual
  const { cols, rows } = getGridLayout(beans.length);
  const virtualWidth = cols * (BEAN_RADIUS * 2 + BEAN_GAP) + BEAN_GAP;
  const virtualHeight = rows * (BEAN_RADIUS * 2 + BEAN_GAP) + BEAN_GAP;

  // Centrar la cámara al inicio o cuando cambian los beans o el ancho
  useEffect(() => {
    setCamera({
      x: (virtualWidth - canvasWidth / zoom) / 2,
      y: (virtualHeight - CANVAS_HEIGHT / zoom) / 2
    });
  }, [beans.length, zoom, canvasWidth]);

  // Dibujo
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x, -camera.y);
    const PADDING = 24;
    beans.forEach((bean, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = PADDING + BEAN_GAP + BEAN_RADIUS + col * (BEAN_RADIUS * 2 + BEAN_GAP);
      const y = PADDING + BEAN_GAP + BEAN_RADIUS + row * (BEAN_RADIUS * 2 + BEAN_GAP);
      ctx.beginPath();
      ctx.arc(x, y, BEAN_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = BEAN_COLORS[bean.type] || BEAN_COLORS.component;
      ctx.fill();
      ctx.fillStyle = "#f8f7ff";
      ctx.font = `bold 16px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bean.beanName, x, y);
    });
    ctx.restore();
  }, [beans, camera, zoom, cols, rows, canvasWidth]);

  // Detección de errores: beans o clases con el mismo nombre
  const [errors, setErrors] = useState([]);
  const [bracketWarning, setBracketWarning] = useState(null);
  const [returnWarning, setReturnWarning] = useState(null);
  const [multiNameWarning, setMultiNameWarning] = useState(null);
  const [missingClassWarnings, setMissingClassWarnings] = useState([]);
  useEffect(() => {
    const nameCount = {};
    const classCount = {};
    beans.forEach(bean => {
      nameCount[bean.beanName] = (nameCount[bean.beanName] || 0) + 1;
      classCount[bean.className] = (classCount[bean.className] || 0) + 1;
    });
    const errs = [];
    Object.entries(nameCount).forEach(([name, count]) => {
      if (count > 1) errs.push(`Hay ${count} beans con el nombre "${name}".`);
    });
    Object.entries(classCount).forEach(([name, count]) => {
      if (count > 1) errs.push(`Hay ${count} clases con el nombre "${name}".`);
    });
    setErrors(errs);
  }, [beans]);

  // Drag para mover la cámara
  function handleMouseDown(e) {
    setDragging(true);
    setLastMouse({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  }
  function handleMouseUp() {
    setDragging(false);
  }
  function handleMouseMove(e) {
    if (!dragging) return;
    const dx = (e.nativeEvent.offsetX - lastMouse.x) / zoom;
    const dy = (e.nativeEvent.offsetY - lastMouse.y) / zoom;
    setCamera(cam => ({
      x: Math.max(0, Math.min(virtualWidth - canvasWidth / zoom, cam.x - dx)),
      y: Math.max(0, Math.min(virtualHeight - CANVAS_HEIGHT / zoom, cam.y - dy))
    }));
    setLastMouse({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  }

  // Wheel handler para zoom, usado en addEventListener
  function wheelHandler(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom(z => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta));
      return newZoom;
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', wheelHandler, { passive: false });
    };
  }, [canvasRef]);

  return (
    <div ref={containerRef} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: 'center' }}>
      {/* Bloque 1: Editor de código */}
      <div style={{ width: "100%", boxSizing: "border-box", marginBottom: 16 }}>
        <Editor
          value={code}
          onValueChange={setCode}
          highlight={code => Prism.highlight(code, Prism.languages.java, "java")}
          padding={24}
          textareaId="bean-code-editor"
          style={{
            fontFamily: "monospace",
            fontSize: 16,
            background: "#2a2a40",
            color: "#f8f7ff",
            border: "none",
            borderRadius: 8,
            outline: "none",
            boxShadow: "none",
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            resize: "vertical",
            boxSizing: "border-box",
            minHeight: 200,
            caretColor: "#27ae60"
          }}
          preClassName="language-java"
          spellCheck={false}
        />
        <style>{`
          #bean-code-editor, #bean-code-editor:focus {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
          }
          .npm__react-simple-code-editor__textarea:focus {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
          }
        `}</style>
      </div>
      {/* Bloque 2: Advertencias */}
      {((errors.length > 0) || bracketWarning || returnWarning || multiNameWarning || (missingClassWarnings.length > 0)) && (
        <div style={{
          background: "#fff3cd",
          color: "#856404",
          border: "1px solid #ffeeba",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          fontSize: 15,
          fontFamily: 'monospace',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-line',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          textAlign: 'left',
          height: 'auto',
          minHeight: 0
        }}>
          <span style={{fontSize: 22, fontWeight: 'bold', flexShrink: 0, lineHeight: 1.2}}>⚠️</span>
          <div style={{width: '100%', maxWidth: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>
            {errors.map((err, i) => (
              <div key={i} style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{err}</div>
            ))}
            {bracketWarning && <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{bracketWarning}</div>}
            {returnWarning && <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{returnWarning}</div>}
            {multiNameWarning && <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{multiNameWarning}</div>}
            {missingClassWarnings.map((w, i) => (
              <div key={"missingclass"+i} style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{w}</div>
            ))}
          </div>
        </div>
      )}
      {/* Bloque 3: Canvas y slider */}
      <div style={{ width: "100%", marginTop: 0, marginBottom: 16 }}>
        <div style={{ position: "relative", width: "100%", maxWidth: "100%", boxSizing: "border-box", display: 'block' }}>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={CANVAS_HEIGHT}
            style={{
              border: "none",
              background: "#22223b",
              borderRadius: 12,
              boxShadow: "0 2px 12px #0004",
              width: "100%",
              minWidth: 0,
              maxWidth: "100%",
              height: CANVAS_HEIGHT,
              cursor: dragging ? "grabbing" : "grab",
              display: "block",
              boxSizing: "border-box"
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseMove={handleMouseMove}
            tabIndex={0}
          />
          {/* Slider de zoom flotante */}
          <div style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 2,
            background: "rgba(34,34,59,0.7)",
            borderRadius: 10,
            padding: "8px 4px",
            boxShadow: "0 1px 4px #0004"
          }}>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              orient="vertical"
              style={{
                writingMode: "bt-lr",
                WebkitAppearance: "slider-vertical",
                width: 6,
                height: 80,
                background: "#444",
                borderRadius: 6,
                outline: "none",
                accentColor: "#27ae60",
                margin: 0,
                cursor: "pointer"
              }}
              aria-label="Zoom"
            />
            <span style={{ color: "#f8f7ff", fontSize: 12, marginTop: 4, fontFamily: 'monospace', opacity: 0.8 }}>{zoom.toFixed(2)}x</span>
          </div>
        </div>
      </div>
    </div>
  );
} 