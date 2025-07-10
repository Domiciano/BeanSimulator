import { parseBeans } from '../regex/beanDetection.js';
import { parseWirings } from '../regex/wiringDetection.js';
import { parseMethodWirings } from '../regex/methodWiringDetection.js';
import { parseConstructorWirings } from '../regex/constructorWiringDetection.js';
import { parseConfigWirings } from '../regex/configWiringDetection.js';
import { validateCode } from '../regex/validations.js';

export function buildBeanGraph(code) {
  const beans = parseBeans(code);
  const wirings = parseWirings(code, beans).wirings;
  const methodWirings = parseMethodWirings(code, beans).methodWirings;
  const constructorWirings = parseConstructorWirings(code, beans).constructorWirings;
  const configWirings = parseConfigWirings(code, beans).configWirings;
  const warnings = validateCode(code, beans);
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