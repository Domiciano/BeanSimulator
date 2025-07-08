import React from "react";

export default function Alert({
  errors = [],
  bracketWarning,
  returnWarning,
  multiNameWarning,
  missingClassWarnings = [],
  autowiredInvalids = [],
  missingAutowiredTypes = [],
  missingAutowiredMethodTypes = [],
  cycleWarnings = []
}) {
  if (
    errors.length === 0 &&
    !bracketWarning &&
    !returnWarning &&
    !multiNameWarning &&
    missingClassWarnings.length === 0 &&
    autowiredInvalids.length === 0 &&
    missingAutowiredTypes.length === 0 &&
    missingAutowiredMethodTypes.length === 0 &&
    cycleWarnings.length === 0
  ) {
    return null;
  }
  return (
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
        {errors.map((err, idx) => (
          <div key={idx} style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{err}</div>
        ))}
        {bracketWarning && <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{bracketWarning}</div>}
        {returnWarning && <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{returnWarning}</div>}
        {multiNameWarning && <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{multiNameWarning}</div>}
        {missingClassWarnings.map((w, idx) => (
          <div key={"missingclass"+idx} style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>{w}</div>
        ))}
        {autowiredInvalids.length > 0 && (
          <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>
            Advertencia: @Autowired no es válido en campos static o final: {autowiredInvalids.join(', ')}
          </div>
        )}
                    {missingAutowiredTypes.length > 0 && (
              <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>
                Advertencia: @Autowired apunta a un tipo/clase que no existe: {missingAutowiredTypes.join(', ')}
              </div>
            )}

            {missingAutowiredMethodTypes.length > 0 && (
              <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line'}}>
                Advertencia: @Autowired en métodos apunta a un tipo/clase que no existe: {missingAutowiredMethodTypes.join(', ')}
              </div>
            )}
            {cycleWarnings.length > 0 && (
          <div style={{width: '100%', display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-line', color: '#b30000'}}>
            Advertencia: ¡Referencia circular detectada! Ciclos: {cycleWarnings.map(c => c.join(' → ')).join(' | ')}
          </div>
        )}
      </div>
    </div>
  );
} 