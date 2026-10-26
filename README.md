# 💰 Ahorrometro

**El tablero de tu fondo de ahorro, en un solo archivo HTML.**

Registra tus aportes y retiros, configura la tasa (y su historial), programá aportes mensuales automáticos y mirá **en cuántos días llegás a tu meta** — con meta ajustada por inflación, un motor día a día, gráfica y PWA instalable en el celular.

Sin servidor, sin cuenta, sin que ningún dato salga de tu máquina: todo vive en el `localStorage` de tu navegador.

---

## 🚀 Cómo usarlo

### Opción 1 — abrir el archivo
Doble clic en `ahorrometro.html` y listo. Funciona completo (solo necesita internet la primera vez, para cargar Chart.js y la tipografía; después lo guarda en caché).

### Opción 2 — servidor local (recomendada, para usar la PWA)
Los Service Workers solo funcionan por `http(s)` (o `localhost`):

```bash
npx serve .
# o: python -m http.server
```

Abrí `http://localhost:3000` y vas a ver la opción de **Instalar** (PWA): aparece en el inicio, funciona sin internet y tiene su propio ícono.

---

## ✨ Funciones

| | |
|---|---|
| 📈 **Motor día a día** | Calcula los intereses reales pagados: rachas de días hábiles, tasa por día y **historial de tasas** (cada época se calcula con la tasa que regía) |
| 🎯 **Meta con fecha** | "Llegás en N días · fecha X". Con **inflación (IPC)**: la meta crece al ritmo que la fijes, y si el rendimiento no la alcanza, te lo dice sin dar una fecha falsa |
| 📅 **Aportes programados** | "el día X de cada mes" o "el N° día hábil de cada mes". La proyección y la meta los incluyen, y la gráfica dibuja la curva futura (línea dorada discontinua) |
| 💸 **Retiros reales** | Un retiro en un día pasado baja el balance **más que su monto** (perdés los intereses que habría generado); el impacto exacto aparece antes de confirmarlo |
| ⏪ **Deshacer** | Cada acción destructiva (agregar/borrar aporte o retiro, borrar todo) tiene un toast *Deshacer* — nada se pierde por error |
| 📜 **Historial flexible** | Vista día a día, o **agrupado por mes** (clic en el mes para expandir/colapsar) |
| 📊 **Gráfica** | Balance histórico (área), proyección futura y línea de la meta |
| 💾 **Respaldos** | Exportar **JSON** (con fecha en el nombre) y **CSV** (aportes + retiros); *Restaurar* recupera un JSON en cualquier otra máquina/navegador |
| 📱 **PWA** | `manifest.webmanifest` + `sw.js` (network-first) + ícono: instalable y con uso offline |
| ⌨️ **Atajos** | `a` enfoca el monto del aporte · `r` enfoca el del retiro · `Enter` guarda el formulario activo · `Esc` cierra modales |

---

## ⚙️ Cómo calcula

- **Tasa diaria**: `TNA ÷ 365` o `TAE ÷ 365` (elegible en las pastillas TNA/TAE).
- **Rachas**: los fines de semana y feriados no pagan, pero la racha de días hábiles que los sigue los incluye: al pagar, se abona el **producto** de los días en conjunto (no un factor simple), lo que permite aplicar cambios de tasa a mitad de la racha.
- **Reinversión**: con *Reinvertir intereses* ON la base crece (interés compuesto); OFF la base es solo el capital (aportes − retiros).
- **Tasa histórica**: cambiaron la tasa? Agregá la fecha y la nueva tasa; todo lo anterior se sigue calculando con la que regía entonces.
- **Inflación**: la meta se ajusta como `meta × (1 + IPC)^(días/30,44)`, así la fecha refleja el poder adquisitivo real.

> 📅 El chip de la parte superior muestra la racha abierta de hoy: qué días van a pagarse juntos y cuánto.

---

## 🔒 Tu data

- Guarda **solo** en el navegador, bajo la clave `localStorage` `ahorrometro_v1`.
- No hay servidor, ni cookies, ni analytics. La app funciona 100% offline tras la primera carga.
- Hacé respaldos JSON con regularidad (hay un recordatorio amigable si pasa mucho tiempo) — así podés restaurar en otro dispositivo o recuperar tras limpiar datos del navegador.

---

## 🧪 Tests

```bash
node _test_ahorrometro.js
```

13 secciones / 42 verificaciones, sin dependencias: proyección == historial (ambos modos de reinversión), rachas abiertas, aportes mensuales en día hábil (regresión), retiros, historial de tasas (incluye cambio a mitad de racha), meta con IPC, puntos de proyección, agrupación por mes y smoke test de la UI.

---

## 📁 Estructura

```
ahorrometro.html        ← todo el app: UI, motor, estilos (un solo archivo)
manifest.webmanifest    ← manifiesto PWA
sw.js                   ← Service Worker (network-first, cache offline)
icon.svg                ← ícono de la PWA
_test_ahorrometro.js    ← suite de tests (Node, sin dependencias)
```
