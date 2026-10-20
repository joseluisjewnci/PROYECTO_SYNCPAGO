# SYNCPAGO

Aplicación web para el control de gastos personales, con registro de usuarios, seguimiento de gastos, recordatorios, historial y estadísticas financieras.

## Tecnologías utilizadas

### Lenguajes

- **Python**: lógica y API del backend.
- **TypeScript**: aplicación frontend y componentes React.
- **SQL (PostgreSQL)**: definición y consulta de la base de datos.
- **CSS**: estilos de la interfaz.
- **HTML**: documento base de la aplicación web.

### Frameworks y bibliotecas

- **React 18** y **React DOM**: interfaz de usuario.
- **React Router DOM 6**: navegación de la aplicación.
- **Vite 5**: servidor de desarrollo y empaquetado del frontend.
- **FastAPI**: API REST del backend.
- **SQLAlchemy 2**: acceso a la base de datos y mapeo objeto-relacional.
- **Pydantic 2**: esquemas y validación de datos de la API.
- **APScheduler 3**: tarea programada para marcar gastos vencidos.
- **psycopg2-binary**: controlador de conexión entre Python y PostgreSQL.
- **python-dotenv**: carga de configuración desde variables de entorno.

### Herramientas y servicios

- **Node.js y npm**: instalación de dependencias y comandos del frontend.
- **Python y pip**: entorno y dependencias del backend.
- **PostgreSQL**: almacenamiento de datos.
- **TypeScript Compiler (`tsc`)**: comprobación de tipos durante la compilación del frontend.
- **Git**: control de versiones.

## Estructura del proyecto

```text
.
├── Backend/       # API FastAPI, modelos, esquemas y lógica de negocio
├── Database/      # Scripts SQL de tablas, funciones, datos y consultas
├── Frontend/      # Aplicación React y TypeScript
└── README.md
```

## Requisitos

- Python 3
- Node.js y npm
- PostgreSQL

## Puesta en marcha

### 1. Configurar PostgreSQL

Crea una base de datos en PostgreSQL y configura su cadena de conexión en `Backend/.env`:

```env
DATABASE_URL=<URI de conexión a PostgreSQL>
```

Configura la URI con el usuario, contraseña, host, puerto y nombre de la base de datos correspondientes. Los scripts disponibles en `Database/` permiten crear tablas, funciones, disparadores y datos de prueba. La aplicación también crea las tablas declaradas en sus modelos al iniciar.

### 2. Iniciar el backend

Desde la carpeta `Backend/`, instala las dependencias y ejecuta la API:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

La documentación interactiva de FastAPI queda disponible en `http://localhost:8000/docs`.

### 3. Iniciar el frontend

En `Frontend/.env`, configura la URL base de la API:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Desde la carpeta `Frontend/`, instala las dependencias e inicia Vite:

```bash
npm install
npm run dev
```

Vite muestra en la terminal la dirección local para abrir la aplicación.

## Scripts SQL

La carpeta `Database/` contiene scripts numerados para crear la estructura y las funciones de la base de datos, insertar datos de ejemplo, ejecutar consultas y verificar resultados. Ejecútalos en PostgreSQL según su numeración cuando necesites preparar la base de datos manualmente.
