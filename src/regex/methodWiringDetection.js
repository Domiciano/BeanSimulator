import { extractClassBody } from './beanDetection.js';

// Detectar wiring por métodos (setters) con @Autowired
export function parseMethodWirings(text, beans) {
  // Mapa de clase a beanName
  const classToBeanName = {};
  beans.forEach(bean => {
    classToBeanName[bean.className] = bean.beanName;
  });

  const methodWirings = [];
  const missingAutowiredMethodTypes = [];

  // Buscar clases y sus métodos
  const classRegex = /public\s+class\s+(\w+)\s*\{/g;
  let match;
  
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const classStart = match.index + match[0].length - 1;
    const classBody = extractClassBody(text, classStart);
    const sourceBeanName = classToBeanName[className];
    
    if (!sourceBeanName) continue;

    // Regex para métodos @Autowired con múltiples parámetros
    const methodRegex = /@Autowired\s+public\s+void\s+(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g;
    let methodMatch;
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      const paramsString = methodMatch[2];
      const methodBody = methodMatch[3];
      // Separar parámetros
      const params = paramsString.split(',').map(p => p.trim()).filter(Boolean);
      for (const param of params) {
        // Param puede ser: "Tipo nombre"
        const paramMatch = param.match(/(\w+)\s+(\w+)/);
        if (!paramMatch) continue;
        const paramType = paramMatch[1];
        const paramName = paramMatch[2];
        // Buscar bean destino por tipo del parámetro
        const targetBeanName = classToBeanName[paramType];
        if (!targetBeanName) {
          missingAutowiredMethodTypes.push(`${className}.${methodName}(${paramType} ${paramName})`);
          continue;
        }
        // Verificar que la propiedad que se asigna esté declarada en la clase
        const propertyAssignment = methodBody.match(new RegExp(`this\\.(${paramName})\\s*=\\s*${paramName}`));
        if (propertyAssignment) {
          const propertyName = propertyAssignment[1];
          // Buscar la declaración de la propiedad en la clase
          const propertyDeclaration = classBody.match(new RegExp(`\\s*(private|protected|public)?\\s*(static|final)?\\s*\\w+\\s+${propertyName}\\s*;`));
          if (!propertyDeclaration) {
            missingAutowiredMethodTypes.push(`${className}.${methodName} - propiedad '${propertyName}' no está declarada`);
            continue;
          }
        }
        // Wiring válido
        methodWirings.push({
          from: sourceBeanName,
          to: targetBeanName,
          method: methodName,
          paramType: paramType,
          paramName: paramName
        });
      }
    }
  }
  return {
    methodWirings,
    missingAutowiredMethodTypes
  };
} 