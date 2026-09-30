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

