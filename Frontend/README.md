# SYNCPAGO — Frontend

Frontend de SYNCPAGO (gestión de gastos personales): **React 18 + TypeScript + Vite 5 + React Router 6**.
Se conecta al backend FastAPI existente (`Backend/`) mediante la variable `VITE_API_URL`.

Esta versión integra, sobre el proyecto original, las siguientes mejoras:

- Menú lateral con **botón hamburguesa** (contraer/expandir en escritorio, abrir/cerrar en móvil).
- **Estadísticas**: sección "Evolución de gastos" (barras por mes con presupuesto, cambios frente al mes
  anterior por clase/servicio con minigráficas), **gráfica de torta** en la distribución del mes y
  **resumen de presupuesto vs. pagado** de los últimos 3, 6, 9 o 12 meses con detalle por mes.
- **Buscador global** de la barra superior (páginas, filtros rápidos, categorías principales y gastos).
- **Mis Gastos**: orden del más reciente al más antiguo y filtro por uno o varios meses.

> No se agregó ninguna dependencia nueva: las gráficas están hechas con SVG propio.

## Requisitos

- Node.js 18 o superior (recomendado 20 LTS) y npm.
- El backend FastAPI en ejecución (ver el `README.md` principal del proyecto).

## Instalación y ejecución

```bash
# 1) Instalar dependencias (usa el package-lock.json incluido)
npm install

# 2) Crear el archivo de variables de entorno a partir del ejemplo
#    Windows (PowerShell):  copy .env.example .env
#    macOS / Linux:         cp .env.example .env

# 3) Iniciar el servidor de desarrollo
npm run dev
```

Vite muestra la dirección local, normalmente `http://localhost:5173`.

### Variables de entorno (`.env`)

| Variable | Descripción | Valor de ejemplo |
|---|---|---|
| `VITE_API_URL` | URL base de la API del backend, **incluyendo** el prefijo `/api/v1` | `http://127.0.0.1:8000/api/v1` |

El backend solo acepta CORS desde `http://localhost:5173` y `http://127.0.0.1:5173`, así que abre el
frontend en una de esas dos direcciones (puerto 5173).

### Otros comandos

```bash
npm run build     # comprueba tipos (tsc -b) y genera la versión de producción en dist/
npm run preview   # sirve localmente la versión generada en dist/
```

## Estructura (solo lo relevante)

```
src/
├── components/
│   ├── charts/          BarChartMensual, LineChart, Sparkline, PieChart (SVG, sin librerías)
│   ├── BuscadorGlobal   buscador de la barra superior
│   ├── EvolucionGastos  sección "Evolución de gastos"
│   ├── ResumenMeses     resumen presupuesto vs. pagado (3/6/9/12 meses)
│   ├── FiltroMeses      selector de uno o varios meses
│   └── Layout / Sidebar / Topbar
├── hooks/               useElementWidth, useMediaQuery (+ los hooks originales)
├── pages/               Dashboard, Gastos, Recordatorios, Estadisticas, Historial, Login, ...
├── services/            acceso a la API (sin cambios)
├── utils/               format, estadisticas (cálculos de las gráficas), navegacion
└── index.css            estilos globales
```

## Cómo probar lo nuevo

1. Inicia sesión y abre **Estadísticas**: barras por mes, panel de cambios (toca una fila para ver su
   gráfica), resumen de 3/6/9/12 meses (con scroll en el detalle) y la torta en "Distribución".
2. Pulsa el botón **☰** de la barra superior: el menú se contrae a solo iconos y el contenido se
   reajusta. En una ventana angosta (≤ 768 px) el mismo botón abre y cierra el menú.
3. En la barra superior pulsa `/` o haz clic en el buscador: elige un filtro rápido o una categoría.
4. En **Mis Gastos** comprueba el orden (más reciente primero) y el botón "📅 Todos los meses".