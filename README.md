# 🥩 Sistema de Gestión de Carnicería — Juanito & Lucas

> **App Móvil (PWA) + Google Sheets + GitHub + Tickets Térmicos / Digitales + WhatsApp**

Sistema integral diseñado para la administración, venta minorista, reparto y conciliación de cuentas entre socios (Juanito & Lucas). Con respaldo automático en la nube y funcionamiento en tiempo real.

---

## 🚀 Características Principales

1. **PWA Móvil Táctil (Se instala como App en tu celular)**:
   * Carga rápida de ventas al momento de pesar la carne.
   * Cálculo en vivo: Costo, Precio Venta, Margen Total, 50% Juanito, 50% Lucas.
   * Detección instantánea de saldos a favor o deudas del cliente (ej: \$600 a favor, \$25 de deuda).
2. **Generador de Tickets y WhatsApp con 1 Clic**:
   * Envía el comprobante detallado directamente al WhatsApp del cliente con formato elegante.
   * Ticket digital y térmico listo para imprimir en impresoras Bluetooth de 58mm/80mm o guardar en PDF.
3. **Google Sheets como Base de Datos Viva**:
   * Podés abrir y editar las ventas desde Excel o Google Sheets desde tu computadora en cualquier momento.
4. **Respaldos Automáticos Diarios (GitHub Actions)**:
   * Un bot en GitHub se ejecuta todas las noches, descarga los datos de Google Sheets y crea una copia de seguridad histórica versionada.

---

## 📁 Estructura del Proyecto

```plaintext
carniceria-app/
├── index.html                     <-- Pantalla principal de la App
├── styles.css                     <-- Diseño moderno (Slate & Emerald)
├── app.js                         <-- Lógica, cálculos 50-50, WhatsApp y Tickets
├── manifest.json                  <-- Configuración PWA para instalar en celular
├── sw.js                          <-- Service worker para funcionamiento offline
├── database/                      <-- Base de datos inicial y limpia
│   ├── productos.csv / .json     <-- 15 Cortes con costos y precios
│   ├── clientes.csv / .json      <-- 55 Clientes con teléfonos y direcciones
│   ├── ventas.csv / .json        <-- 186 Ventas históricas limpias
│   └── lucas.csv / .json         <-- 28 Registros de conciliación con Lucas
├── google-apps-script/
│   └── Code.gs                    <-- Script para pegar en Google Sheets (API Web)
└── .github/
    └── workflows/
        └── backup-sheets.yml      <-- Respaldo automático diario en GitHub
```

---

## 🛠️ GUÍA PASO A PASO: Puesta en Marcha

### PASO 1: Subir el Proyecto a tu GitHub

1. Entra a [github.com](https://github.com) e inicia sesión con tu cuenta.
2. Haz clic en el botón verde **"New"** (Nuevo repositorio).
3. Ponle de nombre: `carniceria-app`.
4. Elige que sea **Público** (o Privado si tienes GitHub Pro para Pages) y **no marques** inicializar con README (ya lo tenemos acá).
5. Abre la terminal en esta carpeta (`carniceria-app`) y ejecuta los siguientes comandos:

```bash
git init
git add .
git commit -m "feat: lanzamiento sistema carnicería Juanito y Lucas"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/carniceria-app.git
git push -u origin main
```
*(Reemplaza `TU_USUARIO` por tu nombre de usuario de GitHub).*

---

### PASO 2: Activar la App en tu Celular (GitHub Pages)

Para tener la App funcionando en tu celular **completamente gratis**:

1. En tu repositorio de GitHub, ve a **Settings** (Ajustes) > sección izquierda **Pages**.
2. En **Build and deployment** > **Source**, selecciona: **Deploy from a branch**.
3. En Branch selecciona: **`main`** y carpeta `/(root)`. Haz clic en **Save**.
4. En 1 minuto tendrás un enlace público seguro como:  
   👉 `https://TU_USUARIO.github.io/carniceria-app/`
5. **Instalar en el celular:**
   * **En iPhone (Safari):** Abre el enlace, toca el botón de compartir (cuadrado con flecha hacia arriba) y elige **"Añadir a pantalla de inicio"**.
   * **En Android (Chrome):** Abre el enlace, toca los 3 puntitos arriba a la derecha y elige **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.
   * ¡Listo! Ahora tienes un ícono con 🥩 en tu pantalla de inicio que abre la App a pantalla completa.

---

### PASO 3: Configurar Google Sheets

1. Abre la hoja de cálculo que creaste en tu **Google Drive**.
2. Crea 4 pestañas con estos nombres exactos (en mayúsculas):
   * `PRODUCTOS`
   * `CLIENTES`
   * `VENTAS`
   * `LUCAS`
3. Puedes importar los archivos correspondientes desde la carpeta `database/` de este proyecto:
   * En Google Sheets: **Archivo** > **Importar** > Subir el archivo `.csv` a su pestaña correspondiente.
4. **Instalar la API de sincronización:**
   * En el menú superior de Google Sheets, ve a: **Extensiones** > **Apps Script**.
   * Borra cualquier código que aparezca.
   * Abre el archivo `google-apps-script/Code.gs` de este repositorio, copia todo su contenido y pégalo allí.
   * Haz clic en el ícono de **Guardar** (el disco).
   * Haz clic en el botón azul **Implementar** (arriba a la derecha) > **Nueva implementación**.
   * Tipo: **Aplicación web**.
   * Descripción: `API Carniceria`.
   * Ejecutar como: `Yo`.
   * Quién tiene acceso: `Cualquier persona` (Anyone).
   * Haz clic en **Implementar**, acepta los permisos de tu cuenta de Google y copia la **URL de la aplicación web** (termina en `/exec`).

---

### PASO 4: Conectar la App con tu Google Sheets

1. Abre tu App (en el celular o en la computadora).
2. Ve a la pestaña **Ajustes** (ícono de engranaje ⚙️).
3. Pega la URL de la aplicación web que copiaste en el paso anterior.
4. Toca **"Guardar y Probar Conexión"**.
5. El indicador superior cambiará de *Modo Local* a **🟢 Conectado a Google Sheets**.

¡A partir de este momento, cada venta que cargues en la app impactará automáticamente en tu Google Sheet!

---

### PASO 5: Activar el Respaldo Automático Diario

Para que GitHub haga un respaldo nocturno automático de tu hoja de Google Drive:

1. En tu repositorio de GitHub, ve a **Settings** > **Secrets and variables** > **Actions**.
2. Haz clic en **New repository secret**.
3. Nombre: `SHEETS_API_URL`.
4. Valor: La URL de tu Google Apps Script (la misma que termina en `/exec`).
5. Haz clic en **Add secret**.
6. ¡Listo! Todas las noches a las 00:00 (hora Argentina), el flujo `.github/workflows/backup-sheets.yml` descargará una copia completa en la carpeta `backups/` con fecha y hora.

---

## 📲 ¿Cómo usar la App en el día a día?

1. **Al momento de realizar una venta:**
   * Escribe el nombre del cliente (se autocompleta).
   * Selecciona el corte (el precio y costo se cargan solos).
   * Ingresa los kilos que pesaste en la balanza.
   * Revisa el total y el desglose de ganancia 50/50.
   * Toca **"📲 Ticket x WhatsApp"**: se abre WhatsApp con el mensaje armado para enviarle al cliente.
   * Toca **"💾 Guardar Venta"**: queda registrada en el teléfono y en Google Sheets.
2. **Para ver ganancias y control de Lucas:**
   * Entra a la pestaña **Dashboard** para ver kilos totales y la ganancia acumulada de Juanito.
   * Entra a la pestaña **Lucas** para ver si Lucas te debe plata o si estás debiendo costo de mercadería.
