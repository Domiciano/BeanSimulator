import { extractClassBody } from './beanDetection.js';

// Validaciones y advertencias del sistema
export function validateCode(code, beans) {
  const warnings = {
    bracketWarning: null,
    returnWarning: null,
    multiNameWarning: null,
    missingClassWarnings: [],
    errors: []
  };

  // Advertencia por desbalance de llaves
  const open = (code.match(/\{/g) || []).length;
  const close = (code.match(/\}/g) || []).length;
  warnings.bracketWarning = open !== close ? `Advertencia: El número de llaves de apertura ({) y cierre (}) no coincide (${open} vs ${close}).` : null;

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
  warnings.returnWarning = missingReturn
    ? `Advertencia: El método @Bean${missingReturnMethods.length > 1 ? 's' : ''} '${missingReturnMethods.join(", ")}' no tiene${missingReturnMethods.length > 1 ? 'n' : ''} una sentencia return.`
    : missingSemicolon
    ? `Advertencia: El método @Bean${missingSemicolonMethods.length > 1 ? 's' : ''} '${missingSemicolonMethods.join(", ")}' no tiene${missingSemicolonMethods.length > 1 ? 'n' : ''} punto y coma (;) al final de la línea return.`
    : null;

  // Advertencia: misma clase, diferentes nombres de bean
  const classToNames = {};
  beans.forEach(bean => {
    if (!classToNames[bean.className]) classToNames[bean.className] = new Set();
    classToNames[bean.className].add(bean.beanName);
  });
  Object.entries(classToNames).forEach(([className, names]) => {
    if (names.size > 1) {
      warnings.multiNameWarning = `Advertencia: La clase "${className}" está registrada como más de un bean con nombres distintos: ${Array.from(names).join(", ")}.`;
    }
  });

  // Advertencia: return de método @Bean con clase no declarada
  const declaredClasses = Array.from(code.matchAll(/public\s+class\s+(\w+)/g)).map(m => m[1]);
  for (const block of beanMethodBlocks) {
    const returnNew = block.body.match(/return\s+new\s+(\w+)\s*\(/);
    if (returnNew && !declaredClasses.includes(returnNew[1])) {
      warnings.missingClassWarnings.push(`Advertencia: El método @Bean '${block.methodName}' retorna un objeto de tipo '${returnNew[1]}', pero no existe ninguna clase declarada con ese nombre.`);
    }
  }

  // Detección de errores: beans o clases con el mismo nombre
  const nameCount = {};
  const classCount = {};
  beans.forEach(bean => {
    nameCount[bean.beanName] = (nameCount[bean.beanName] || 0) + 1;
    classCount[bean.className] = (classCount[bean.className] || 0) + 1;
  });
  Object.entries(nameCount).forEach(([name, count]) => {
    if (count > 1) warnings.errors.push(`Hay ${count} beans con el nombre "${name}".`);
  });
  Object.entries(classCount).forEach(([name, count]) => {
    if (count > 1) warnings.errors.push(`Hay ${count} clases con el nombre "${name}".`);
  });

  return warnings;
} 