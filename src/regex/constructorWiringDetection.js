import { extractClassBody } from './beanDetection.js';

// Detectar wiring por inyección de constructor (nombre exacto, soporta @Qualifier y validación estructural)
export function parseConstructorWirings(text, beans) {
  // Mapa de clase a beanName
  const classToBeanName = {};
  beans.forEach(bean => {
    classToBeanName[bean.className] = bean.beanName;
  });
  // Mapa de beanName a bean
  const beanNameToBean = {};
  beans.forEach(bean => {
    beanNameToBean[bean.beanName] = bean;
  });

  const constructorWirings = [];
  const missingConstructorTypes = [];

  // Parser robusto de parámetros: split solo en comas fuera de paréntesis
  function splitParams(paramString) {
    const params = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < paramString.length; i++) {
      const c = paramString[i];
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) {
        params.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    if (current.trim()) params.push(current.trim());
    return params.filter(Boolean);
  }

  // Parser manual para extraer la lista de parámetros de la firma del constructor (soporta paréntesis anidados correctamente)
  function extractParamsFromClassBody(classBody, ctorStart) {
    const openIdx = classBody.indexOf('(', ctorStart);
    if (openIdx === -1) return '';
    let depth = 1;
    let params = '';
    for (let i = openIdx + 1; i < classBody.length; i++) {
      const c = classBody[i];
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (depth === 0) break;
      params += c;
    }
    return params;
  }

  // Buscar clases
  const classRegex = /public\s+class\s+(\w+)\s*\{/g;
  let match;
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const classStart = match.index + match[0].length - 1;
    const classBody = extractClassBody(text, classStart);
    const sourceBeanName = classToBeanName[className];
    if (!sourceBeanName) continue;

    // Buscar constructores públicos (nombre exacto)
    const ctorRegex = new RegExp(`public\\s+${className}\\s*\\(`, 'g');
    let ctorMatch;
    while ((ctorMatch = ctorRegex.exec(classBody)) !== null) {
      const ctorStart = ctorMatch.index;
      const paramsString = extractParamsFromClassBody(classBody, ctorStart);
      console.log('DEBUG ctor paramsString', paramsString);
      const params = splitParams(paramsString);
      console.log('DEBUG ctor params', params);
      for (const param of params) {
        console.log('DEBUG ctor param raw', param);
        // Buscar @Qualifier
        const qualifierMatch = param.match(/@Qualifier\s*\(\s*"([^"]+)"\s*\)/);
        if (qualifierMatch) {
          const targetBeanName = qualifierMatch[1];
          // Extraer tipo y nombre al final del parámetro
          const trimmedParam = param.trim();
          const typeNameMatch = trimmedParam.match(/([\w<>]+)\s+(\w+)$/);
          let paramType, paramName;
          if (typeNameMatch) {
            paramType = typeNameMatch[1];
            paramName = typeNameMatch[2];
          }
          // Validar que exista un bean con ese nombre
          const targetBean = beanNameToBean[targetBeanName];
          if (targetBean && paramType) {
            // Buscar declaración de la clase destino (tolerante a saltos de línea y espacios)
            const classDeclPattern = new RegExp(`public class ${targetBean.className}[^\{]*\{`, 's');
            const classDeclMatch = text.match(classDeclPattern);
            let implementsType = false;
            let interfaces = [];
            if (classDeclMatch && classDeclMatch[0]) {
              const implementsMatch = classDeclMatch[0].match(/implements\s+([\s\S]*?)\{/);
              if (implementsMatch && implementsMatch[1]) {
                interfaces = implementsMatch[1].split(',').map(s => s.trim());
                if (interfaces.includes(paramType)) implementsType = true;
              }
            }
            if (targetBean.className === paramType || implementsType) {
              constructorWirings.push({
                from: sourceBeanName,
                to: targetBeanName,
                paramType,
                paramName
              });
            }
          }
        }
      }
    }
  }
  return {
    constructorWirings,
    missingConstructorTypes
  };
} 