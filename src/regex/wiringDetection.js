// Detectar wiring por propiedad con @Autowired
export function parseWirings(text, beans) {
  // Mapa de nombre de bean a clase
  const beanNameToClass = {};
  beans.forEach(bean => {
    beanNameToClass[bean.beanName] = bean.className;
  });
  // Mapa de clase a beanName
  const classToBeanName = {};
  beans.forEach(bean => {
    classToBeanName[bean.className] = bean.beanName;
  });
  // Buscar wiring en cada clase
  const wirings = [];
  const autowiredInvalids = [];
  const missingAutowiredTypes = [];
  const classRegex = /public\s+class\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let match;
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const classBody = match[2];
    // Buscar propiedades @Autowired
    const propRegex = /@Autowired[\s\n\r]*((private|protected|public)?\s*)?((static|final)\s+)?(\w+)\s+(\w+)\s*;/g;
    let m;
    while ((m = propRegex.exec(classBody)) !== null) {
      const modifiers = m[3] || '';
      const type = m[5];
      // Buscar bean destino por tipo
      const targetBeanName = classToBeanName[type];
      const sourceBeanName = classToBeanName[className];
      if (modifiers.includes('static') || modifiers.includes('final')) {
        autowiredInvalids.push(`${className}.${m[6]}`);
        continue;
      }
      if (!targetBeanName) {
        missingAutowiredTypes.push(`${className}.${m[6]} → ${type}`);
        continue;
      }
      if (targetBeanName && sourceBeanName) {
        wirings.push({ from: sourceBeanName, to: targetBeanName });
      }
    }
  }
  return { wirings, autowiredInvalids, missingAutowiredTypes };
} 