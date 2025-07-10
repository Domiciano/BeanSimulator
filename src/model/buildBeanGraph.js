import { parseBeans } from '../regex/beanDetection.js';
import { parseWirings } from '../regex/wiringDetection.js';
import { parseMethodWirings } from '../regex/methodWiringDetection.js';
import { parseConstructorWirings } from '../regex/constructorWiringDetection.js';
import { parseConfigWirings } from '../regex/configWiringDetection.js';
import { validateCode } from '../regex/validations.js';

export function buildBeanGraph(code) {
  const beans = parseBeans(code);
  // Obtener clases declaradas
  const declaredClasses = Array.from(code.matchAll(/public\s+class\s+(\w+)/g)).map(m => m[1]);
  // Filtrar beans de métodos @Bean cuyo tipo no existe
  const filteredBeans = beans.filter(bean => {
    if (bean.type === 'bean') {
      return declaredClasses.includes(bean.className);
    }
    return true;
  });
  const wirings = parseWirings(code, filteredBeans).wirings;
  const methodWirings = parseMethodWirings(code, filteredBeans).methodWirings;
  const constructorWirings = parseConstructorWirings(code, filteredBeans).constructorWirings;
  const configWirings = parseConfigWirings(code, filteredBeans).configWirings;
  const warnings = validateCode(code, beans);
  return {
    beans: filteredBeans,
    wirings: [
      ...wirings,
      ...methodWirings,
      ...constructorWirings,
      ...configWirings
    ],
    warnings
  };
} 