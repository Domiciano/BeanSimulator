import { extractClassBody } from './beanDetection.js';

// Detectar wiring por inyección de constructor (nombre exacto)
export function parseConstructorWirings(text, beans) {
  // Mapa de clase a beanName
  const classToBeanName = {};
  beans.forEach(bean => {
    classToBeanName[bean.className] = bean.beanName;
  });

  const constructorWirings = [];
  const missingConstructorTypes = [];

  // Buscar clases
  const classRegex = /public\s+class\s+(\w+)\s*\{/g;
  let match;
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const classStart = match.index + match[0].length - 1;
    const classBody = extractClassBody(text, classStart);
    const sourceBeanName = classToBeanName[className];
    if (!sourceBeanName) continue;

    // 1. Constructor público con o sin @Autowired (nombre exacto)
    const ctorRegex = /(@Autowired\s*)?public\s+(\w+)\s*\(([^)]*)\)/g;
    let ctorMatch;
    while ((ctorMatch = ctorRegex.exec(classBody)) !== null) {
      const ctorName = ctorMatch[2];
      if (ctorName !== className) continue; // Solo wiring si el nombre coincide exactamente
      const paramsString = ctorMatch[3];
      const params = paramsString.split(',').map(p => p.trim()).filter(Boolean);
      for (const param of params) {
        const paramMatch = param.match(/(\w+)\s+(\w+)/);
        if (!paramMatch) continue;
        const paramType = paramMatch[1];
        const paramName = paramMatch[2];
        const targetBeanName = classToBeanName[paramType];
        if (!targetBeanName) {
          missingConstructorTypes.push(`${className}(constructor)(${paramType} ${paramName})`);
          continue;
        }
        constructorWirings.push({
          from: sourceBeanName,
          to: targetBeanName,
          paramType,
          paramName
        });
      }
    }
  }
  return {
    constructorWirings,
    missingConstructorTypes
  };
} 