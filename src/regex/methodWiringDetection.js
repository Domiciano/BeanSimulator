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
    
    console.log(`Analizando clase: ${className}, beanName: ${sourceBeanName}`);
    console.log(`Cuerpo de la clase: ${classBody}`);
    
    if (!sourceBeanName) continue;

    // Buscar métodos anotados con @Autowired (más flexible)
    const methodRegex = /@Autowired\s+public\s+void\s+(\w+)\s*\(\s*(\w+)\s+(\w+)\s*\)\s*\{([\s\S]*?)\}/g;
    let methodMatch;
    
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      const paramType = methodMatch[2];
      const paramName = methodMatch[3];
      const methodBody = methodMatch[4];
      
      console.log(`Método encontrado: ${methodName}(${paramType} ${paramName})`);
      console.log(`Cuerpo del método: ${methodBody}`);
      
      // Buscar bean destino por tipo del parámetro
      const targetBeanName = classToBeanName[paramType];
      
      if (!targetBeanName) {
        missingAutowiredMethodTypes.push(`${className}.${methodName}(${paramType} ${paramName})`);
        continue;
      }
      
      // Verificar que la propiedad que se asigna esté declarada en la clase
      const propertyAssignment = methodBody.match(/this\.(\w+)\s*=\s*\w+/);
      console.log(`Asignación encontrada:`, propertyAssignment);
      
      if (propertyAssignment) {
        const propertyName = propertyAssignment[1];
        console.log(`Propiedad a verificar: ${propertyName}`);
        
        // Buscar la declaración de la propiedad en la clase (más flexible)
        const propertyDeclaration = classBody.match(new RegExp(`\\s*(private|protected|public)?\\s*(static|final)?\\s*\\w+\\s+${propertyName}\\s*;`));
        console.log(`Declaración encontrada:`, propertyDeclaration);
        
        if (!propertyDeclaration) {
          console.log(`ERROR: Propiedad '${propertyName}' no declarada en ${className}`);
          missingAutowiredMethodTypes.push(`${className}.${methodName} - propiedad '${propertyName}' no está declarada`);
          continue;
        }
      }
      
      // En Spring, cualquier método anotado con @Autowired es válido
      // No importa el nombre del método, solo que el tipo del parámetro sea un bean
      methodWirings.push({ 
        from: sourceBeanName, 
        to: targetBeanName,
        method: methodName,
        paramType: paramType,
        paramName: paramName
      });
    }
  }

  return { 
    methodWirings, 
    missingAutowiredMethodTypes 
  };
} 