import { extractClassBody } from './beanDetection.js';

// Detectar wiring por métodos @Autowired y por @Qualifier con validación estructural
export function parseMethodWirings(text, beans) {
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

    // DEBUG: imprimir el cuerpo de la clase para todos los casos
    console.log('DEBUG classBody', classBody);
    // Parser robusto de parámetros: split solo en comas fuera de paréntesis y termina cuando el balance vuelve a cero
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
    // Parser manual para extraer la lista de parámetros de la firma del método (soporta paréntesis anidados correctamente)
    function extractParamsFromClassBody(classBody, methodStart) {
      const openIdx = classBody.indexOf('(', methodStart);
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
    // Probar un regex más simple para detectar métodos públicos y capturar nombre y firma completa
    const methodRegex = /public\s+\w+\s+(\w+)\s*\(/g;
    let methodMatch;
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      const methodStart = methodMatch.index;
      const paramsString = extractParamsFromClassBody(classBody, methodStart);
      const params = splitParams(paramsString);
      // DEBUG: imprimir paramsString y params
      console.log('DEBUG paramsString', paramsString);
      console.log('DEBUG params', params);
      for (const param of params) {
        // DEBUG: imprimir todos los parámetros
        console.log('DEBUG param raw', param);
        // Buscar @Qualifier
        const qualifierMatch = param.match(/@Qualifier\s*\(\s*"([^"]+)"\s*\)/);
        if (qualifierMatch) {
          const targetBeanName = qualifierMatch[1];
          // Extraer tipo del parámetro
          // Puede haber espacios, tags, etc. Buscar el último "palabra palabra" después del tag
          // Imprimir el string del parámetro entre delimitadores
          const trimmedParam = param.trim();
          console.log('DEBUG param delimiters', `>${trimmedParam}<`);
          // Extraer tipo y nombre al final del parámetro
          const typeNameMatch = trimmedParam.match(/([\w<>]+)\s+(\w+)$/);
          let paramType, paramName;
          // DEBUG: imprimir el valor de param y el match
          console.log('DEBUG param', {param: trimmedParam, typeNameMatch});
          if (typeNameMatch) {
            paramType = typeNameMatch[1];
            paramName = typeNameMatch[2];
          }
          // Validar que exista un bean con ese nombre
          const targetBean = beanNameToBean[targetBeanName];
          if (targetBean && paramType) {
            // Validar que la clase del bean destino implemente o sea del tipo del parámetro
            // Buscar declaración de la clase destino (tolerante a saltos de línea y espacios)
            const classDeclRegex = new RegExp(`public\\s+class\\s+${targetBean.className}\\s*(?:extends\\s+\\w+)?(?:\\s+implements\\s+([\\w\\s,<>,]+))?`, 's');
            const declMatch = text.match(classDeclRegex);
            let implementsType = false;
            let interfaces = [];
            // Extraer interfaces implementadas de la declaración de la clase
            if (declMatch && declMatch[1]) {
              interfaces = declMatch[1].split(',').map(s => s.trim());
              if (interfaces.includes(paramType)) implementsType = true;
            }
            // DEBUG: imprimir valores relevantes
            console.log('DEBUG wiring', {paramType, targetClass: targetBean.className, interfaces, implementsType});
            // DEBUG: imprimir la declaración de la clase destino
            const classDeclPattern = new RegExp(`public class ${targetBean.className}[^\{]*{`, 's');
            const classDeclMatch = text.match(classDeclPattern);
            console.log('DEBUG classDecl', classDeclMatch ? classDeclMatch[0] : 'NO MATCH');
            if (classDeclMatch && classDeclMatch[0]) {
              console.log('DEBUG classDeclMatch[0]', JSON.stringify(classDeclMatch[0]));
              const implementsMatch = classDeclMatch[0].match(/implements\s+([\s\S]*?)\{/);
              if (implementsMatch && implementsMatch[1]) {
                interfaces = implementsMatch[1].split(',').map(s => s.trim());
                if (interfaces.includes(paramType)) implementsType = true;
              }
            }
            // También permitir wiring si el tipo es exactamente igual al className
            if (targetBean.className === paramType || implementsType) {
              methodWirings.push({
                from: sourceBeanName,
                to: targetBeanName,
                method: methodName,
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
    methodWirings,
    missingAutowiredMethodTypes
  };
} 