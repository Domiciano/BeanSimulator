// Extrae el cuerpo de una clase a partir de la posición de la llave de apertura
export function extractClassBody(text, startIdx) {
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
export function parseBeans(text) {
  // Regex para encontrar clases anotadas
  const beanRegex = /@(Component|Service|Repository|Controller|RestController)\s*(\((?:\s*value\s*=)?\s*"([^"]+)"\s*\))?\s*public\s+class\s+(\w+)\s*\{/g;
  const configClassRegex = /@Configuration\s*public\s+class\s+(\w+)\s*\{/g;
  // Mejorar el regex para métodos @Bean: acepta cualquier visibilidad, cualquier tipo, cualquier contenido entre llaves
  // const beanMethodRegex = /@Bean\s*(\((?:\s*value\s*=)?\s*"([^"]+)"\s*\))?\s*(public|protected|private)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*\{[\s\S]*?return[\s\S]*?\}/g;

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