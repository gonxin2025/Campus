# CORPADEIN · muestra local

Prototipo para ver el recorrido de estudiante, docente, asesor, contable y administrativo en el navegador. No usa Docker, PostgreSQL ni una pasarela real. Los datos viven en el proceso de Next.js y se reinician al volver a arrancar.

## GitHub

Sube el contenido de esta carpeta, no el archivo zip. `.gitignore` deja fuera `node_modules` y `.next`.

## Arranque

Hace falta Node.js 20 o superior. Desde la carpeta `web`:

```
npm install
npm run dev
```

Abre http://localhost:3000

## Estructura

| Carpeta | Qué es |
| --- | --- |
| `web/` | La aplicación (Next.js 14, TypeScript, Tailwind). Es lo único que se publica. |
| `web/app/v1/[...ruta]/route.ts` + `web/lib/demo.ts` | API de muestra dentro de la misma aplicación: sesión, prematrícula, aula, docente, pagos y cartera. |
| `web/lib`, `web/components` | Cliente de la API, roles y menús, identidad; menú lateral, avatar y calendario. |
| `api/`, `db/` | Referencia de una versión con Go y PostgreSQL. La muestra no los usa. |

Lo que cambia cada visitante (prematrícula, entregas, asistencia, notas y pagos) se guarda en una cookie de su navegador durante 12 horas. Por eso funciona igual en Vercel: cada persona tiene su propia muestra, y en el mismo navegador Ana puede pagar, salir y entrar como María (contable) para ver la cuenta pagada. Para volver al estado inicial basta borrar las cookies del sitio o abrir una ventana privada.

## Vercel

La interfaz es la carpeta `web`.

1. Importa el repositorio.
2. En Root Directory elige `web`.
3. Framework: Next.js. El comando de build es `npm run build`.

No hace falta `API_URL`. La muestra responde en las rutas `/v1` de la misma aplicación.

## Cuentas de demostración

La clave de todas es `campus`. Estas personas no existen en CORPADEIN.

| Correo | Rol |
| --- | --- |
| ana.ruiz@demo.local | Estudiante |
| carlos.mendez@demo.local | Docente |
| maria.roncallo@demo.local | Asesor |
| maria.lopez@demo.local | Contable |
| helena.vargas@demo.local | Administrativo |

Ana está inscrita en Ingeniería de Sistemas, convenio FUAC, SNIES 1775. La prematrícula de muestra trae Inglés A, Inglés C y el diplomado de IA generativa para la educación. Inglés B cruza el martes con Inglés A. La referencia 2026 es $13.199.940, el valor publicado por Corpy, repartido en 24 cuotas sin intereses porque no hay una tasa publicada.

## Qué sale de los sitios y qué es muestra

De [corpadein.com.co](https://corpadein.com.co/): nombre CORPADEIN, sedes de Bogotá, Chía y Cartagena, y los programas usados aquí (Ingeniería de Sistemas, Inglés A, B y C de Edusoft, diplomados de IA publicados por la corporación).

De [Corpy](https://brilliant-pie-1ef0b1.netlify.app/): el valor 2026 de referencia de Ingeniería de Sistemas.

La muestra agrega personas, horarios y el pago simulado. No hay OIDC, MFA real ni cobro con tarjeta.
