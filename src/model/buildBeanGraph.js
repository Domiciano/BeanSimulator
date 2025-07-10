import { parseBeans } from '../regex/beanDetection.js';
import { parseWirings } from '../regex/wiringDetection.js';
import { parseMethodWirings } from '../regex/methodWiringDetection.js';
import { parseConstructorWirings } from '../regex/constructorWiringDetection.js';
import { parseConfigWirings } from '../regex/configWiringDetection.js';
import { parseXmlBeans } from '../regex/xmlBeanDetection.js';
import { parseXmlWirings } from '../regex/xmlWiringDetection.js';
import { validateCode } from '../regex/validations.js';
import { validateXmlStructure } from '../regex/xmlValidation.js';

export function buildBeanGraph(code) {
  // Detectar si es XML o Java
  const isXml = code.trim().startsWith('<?xml') || code.includes('<beans') || code.includes('<bean');
  
  let beans, wirings, methodWirings, constructorWirings, configWirings;
  let warnings;
  
  if (isXml) {
    warnings = validateXmlStructure(code);
    // Si hay errores críticos en la estructura XML, no procesar beans
    const hasCriticalErrors = warnings.xmlTagWarning || warnings.xmlClosingWarning || warnings.beanUnclosedWarning;
    if (hasCriticalErrors) {
      beans = [];
      wirings = [];
      methodWirings = [];
      constructorWirings = [];
      configWirings = [];
    } else {
      // Obtener clases declaradas en el código Java
      const declaredClasses = Array.from(code.matchAll(/public\s+class\s+(\w+)/g)).map(m => m[1]);
      // Analizar todos los wirings definidos en el XML (aunque apunten a beans inexistentes)
      const allXmlBeans = parseXmlBeans(code);
      const filteredBeans = allXmlBeans.filter(bean => declaredClasses.includes(bean.className));
      const allWirings = parseXmlWirings(code, allXmlBeans); // todos los wirings posibles
      const validBeanNames = filteredBeans.map(b => b.beanName);
      // Advertencias para wirings rotos
      const brokenWirings = allWirings.filter(w => !validBeanNames.includes(w.to));
      if (brokenWirings.length > 0) {
        warnings.brokenXmlWirings = brokenWirings.map(w => `El wiring XML desde '${w.from}' apunta a un bean inexistente: '${w.to}'.`);
      }
      // Solo agregar al grafo los wirings válidos
      const xmlWirings = allWirings.filter(w => validBeanNames.includes(w.to));
      beans = filteredBeans;
      wirings = xmlWirings;
      methodWirings = [];
      constructorWirings = [];
      configWirings = [];
    }
  } else {
    // Parsear Java
    beans = parseBeans(code);
    // Obtener clases declaradas
    const declaredClasses = Array.from(code.matchAll(/public\s+class\s+(\w+)/g)).map(m => m[1]);
    // Filtrar beans de métodos @Bean cuyo tipo no existe
    const filteredBeans = beans.filter(bean => {
      if (bean.type === 'bean') {
        return declaredClasses.includes(bean.className);
      }
      return true;
    });
    wirings = parseWirings(code, filteredBeans).wirings;
    methodWirings = parseMethodWirings(code, filteredBeans).methodWirings;
    constructorWirings = parseConstructorWirings(code, filteredBeans).constructorWirings;
    configWirings = parseConfigWirings(code, filteredBeans).configWirings;
    beans = filteredBeans;
    warnings = validateCode(code, beans);
  }
  
  return {
    beans,
    wirings: [
      ...wirings,
      ...methodWirings,
      ...constructorWirings,
      ...configWirings
    ],
    warnings
  };
} 