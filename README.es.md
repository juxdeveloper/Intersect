[English](README.md) | [Español](README.es.md)

# Intersect

[![Licencia: GPL-3.0-or-later](docs/badges/license.svg)](LICENSE)
![Versión: 1.0.0](docs/badges/release.svg)
![Ejecución: local en el navegador](docs/badges/architecture.svg)

Intersect es una aplicación educativa para explorar la intersección de dos superficies reales en tres dimensiones. Introduce ecuaciones en **x, y, z** para ver las superficies, una parametrización en forma exacta cuando sea compatible, su dominio real del parámetro y un procedimiento educativo.

Todos los cálculos, el renderizado y el almacenamiento del historial se ejecutan localmente en tu navegador. La distribución estática contiene JavaScript, fuentes, el entorno Python y los paquetes simbólicos; no utiliza un solucionador remoto, CDN, analítica ni una API remota de la aplicación. La carga inicial descarga los recursos desde el propio origen del sitio. Una vez preparada para funcionar sin conexión, la PWA instalada puede volver a cargarse y calcular sin acceso a la red.

## Funciones

- Ecuaciones de formato libre mediante MathLive, con teclado físico y teclado matemático táctil.
- Vistas previas de superficies en tiempo real y cálculo automático de la intersección tras una pausa de escritura de 400 ms.
- SymPy ejecutado en un trabajador dedicado de Pyodide WebAssembly, con cancelación y recuperación.
- Fórmula de la curva activa, dominio real del parámetro y procedimiento inicialmente contraído.
- Recorrido anverso/reverso, animación de la curva, repetición y colores personalizados.
- Escena interactiva de Three.js con **+Z hacia arriba**, ejes de colores, marcas numeradas, superficies translúcidas y rotación, desplazamiento y zoom con ratón o pantalla táctil.
- Detalle gráfico Bajo, Medio y Alto; Alto es el valor predeterminado.
- Español por defecto, cambio a inglés y temas persistentes Automático/Claro/Oscuro.
- Historial local de cálculos en IndexedDB, hasta 100 entradas, con almacenamiento alternativo en memoria cuando el almacenamiento persistente no está disponible.
- Diseño adaptable, controles de teclado, compatibilidad con movimiento reducido e instalación como PWA sin conexión en navegadores compatibles.

## Arquitectura

React y TypeScript coordinan las entradas, los resultados, las preferencias y el historial. MathLive y Compute Engine convierten las entradas matemáticas en árboles de expresiones validados. Un puente con una lista explícita de operaciones permitidas envía expresiones estructuradas a SymPy en un trabajador dedicado de Pyodide; las entradas del usuario nunca se evalúan como código fuente. Un trabajador de geometría independiente genera las mallas de superficies implícitas y muestrea las curvas parametrizadas, mientras Three.js dibuja la escena mediante un bucle que se activa cuando hace falta. IndexedDB almacena registros de cálculo con versiones, y un trabajador de servicio conserva en caché todo el entorno estático para su uso sin conexión.

Las principales divisiones son `src/contracts/`, `src/math/`, `src/runtime/`, `src/geometry/`, `src/rendering/`, `src/persistence/` y `src/components/`. Todos los recursos se distribuyen localmente; el navegador no necesita un servidor de cálculo.

## Principios matemáticos y límites

La intersección satisface las dos ecuaciones residuales:

$$F(x,y,z)=0,\qquad G(x,y,z)=0.$$

Una parametrización candidata es una función vectorial

$$\mathbf{r}(t)=(x(t),y(t),z(t)),\qquad t\in D.$$

El solucionador sustituye la candidata en ambas ecuaciones y comprueba el dominio real del parámetro, incluidas las restricciones de denominadores, raíces y logaritmos. Las estrategias compatibles incluyen intersecciones de planos afines, ciertas secciones de cuádricas, cortes de cilindros circulares/elípticos y parametrizaciones por coordenadas. Las curvas periódicas utilizan un intervalo fundamental cuando corresponde. Por ejemplo, la intersección de $x^2+y^2=4$ y $z=x+y$ es

$$\mathbf{r}(t)=(2\cos t,2\sin t,2\cos t+2\sin t),\qquad t\in[0,2\pi).$$

El solucionador actual también comprueba si se han omitido ramas y rechaza ciertos casos que requieren componentes desconectadas, como $x^2+y^2=4$ con $z^2=1$. Estas comprobaciones son estrategias implementadas, no una demostración universal de cobertura. Las intersecciones cuya ausencia se ha demostrado, los puntos aislados, las entradas no compatibles y las búsquedas no concluyentes tienen resultados distintos. No se afirma que cualquier ecuación tenga una solución exacta ni que la fórmula obtenida sea la más sencilla posible entre todas.

**Limitación de verificación:** la implementación actual incluye comprobaciones numéricas alternativas de identidad y puntos de prueba muestreados para la cobertura cuando la simplificación simbólica no es concluyente. No son demostraciones matemáticas para entradas arbitrarias. Si necesitas una demostración rigurosa, comprueba de forma independiente los resultados en forma exacta. Las mallas de superficies y las muestras de curvas son aproximaciones visuales de resolución finita.

Los límites de cálculo/navegación son $[-1000,1000]^3$; la región de referencia inicial es $[-50,50]^3$. Los límites describen la región de trabajo de la aplicación, no una demostración sobre todo el espacio real.

## Instalación y desarrollo

Utiliza Node.js 22.12+ y npm 10.5+. El repositorio fija Node.js 22.16.0 para Cloudflare Pages. La adquisición de dependencias ocurre durante la compilación; los cálculos de la aplicación permanecen locales.

```bash
git clone https://github.com/juxdeveloper/Intersect.git
cd Intersect
npm ci
npm run prepare:runtime
npm run dev
```

El servidor de desarrollo utiliza `http://localhost:5173`. Prepara los recursos del entorno antes de usar el servidor de desarrollo en una copia nueva:

```bash
npm run prepare:runtime
```

La preparación copia Pyodide y las fuentes desde las dependencias instaladas y descarga paquetes wheel de SymPy/mpmath con verificación de suma de comprobación si faltan. Una instalación nueva necesita conexión a internet; las compilaciones posteriores reutilizan los paquetes locales verificados.

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` prepara los recursos locales, comprueba TypeScript, compila `dist/` y genera el manifiesto de caché sin conexión. La vista previa de producción utiliza `http://localhost:4173`.

## Uso de la aplicación

1. Introduce una ecuación en cada campo de superficie. La vista previa se actualiza mientras escribes; los cambios válidos activan el cálculo automático.
2. Lee la fórmula y el dominio del parámetro, o el motivo indicado por el que no se pudo determinar un resultado.
3. Abre el procedimiento para revisar los pasos del cálculo. Cambia la orientación para invertir el recorrido.
4. Gira, desplaza y amplía el gráfico con ratón o pantalla táctil. Utiliza el control de detalle para ajustar la calidad gráfica.
5. Abre Historial para restaurar o eliminar cálculos. El historial pertenece al origen actual del navegador y el navegador puede borrarlo.
6. Cambia el idioma o el tema en la cabecera. Espera a que termine la preparación antes de depender del acceso sin conexión.

La vista 3D requiere WebGL. La instalación de la PWA y los trabajadores de servicio requieren HTTPS o localhost y un navegador compatible. Una primera visita no puede funcionar sin conexión antes de almacenar los recursos en caché. Si falla la inicialización del entorno, comprueba la disponibilidad de los recursos locales y utiliza el control para reintentar; un tiempo de espera agotado o una ecuación no compatible no demuestran que la intersección esté vacía.

