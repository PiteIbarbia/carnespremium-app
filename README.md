# 🥩 Carnes Premium — App & Gestión Integral (Juanito & Lucas)

> **App Móvil PWA + Google Sheets + GitHub + Tickets Térmicos / Digitales + WhatsApp**

Sistema integral de gestión, ventas minoristas, reparto y conciliación de cuentas entre socios (Juanito & Lucas) para **Carnes Premium**.

* **Repositorio GitHub:** [github.com/PiteIbarbia/carnespremium-app](https://github.com/PiteIbarbia/carnespremium-app)
* **App en Vivo (GitHub Pages):** [piteibarbia.github.io/carnespremium-app](https://piteibarbia.github.io/carnespremium-app/)
* **Google Sheet Oficial:** [Ver Planilla en Google Drive](https://docs.google.com/spreadsheets/d/1HKFo5onbdDSg_-8_sXxRDaHbBg7pQsMiuGRqYYWy-IE/edit) (ID: `1HKFo5onbdDSg_-8_sXxRDaHbBg7pQsMiuGRqYYWy-IE`)

---

## 🚀 Funcionalidades Principales

1. **PWA Móvil Táctil (Se instala como App en iPhone y Android)**:
   * Diseñada para usar con una sola mano en el reparto o balanza.
   * Carga rápida de ventas: seleccionas cliente y corte, ingresas kilos y calcula todo en tiempo real.
   * Desglose automático de márgenes: Costo carne (Lucas), Margen Bruto, **Neto Juanito (50%)**, **Neto Lucas (50%)**.
   * Detección de saldos: avisa al instante si el cliente pagó exacto, si dejó plata a favor (ej. +$600) o si quedó debiendo (ej. -$25).
2. **Generador de Tickets y WhatsApp en 1 Clic**:
   * Envía el comprobante detallado directamente al WhatsApp del cliente con formato profesional.
   * Ticket digital y térmico listo para imprimir en impresoras Bluetooth de 58mm/80mm o guardar en PDF.
3. **Google Sheets como Base de Datos Viva**:
   * Todo lo que cargas en la app impacta directamente en tu Google Sheet oficial.
4. **Respaldos Automáticos Diarios (GitHub Actions)**:
   * Cada noche a las 00:00 (hora Argentina), un bot de GitHub descarga la copia de seguridad de tu Google Sheet y guarda un commit histórico en la carpeta `backups/`.

---

## 📁 Estructura del Proyecto

```plaintext
C:\Users\Pite\Documents\Trabajo\Carne Premium-Vacío\carnespremium-app\
├── index.html                     <-- Pantalla principal de la App
├── styles.css                     <-- Diseño moderno (Slate & Emerald)
├── app.js                         <-- Lógica de negocio, cálculos 50-50, WhatsApp y Tickets
├── manifest.json                  <-- Configuración PWA para instalar en celular
├── sw.js                          <-- Service worker para funcionamiento offline
├── database/                      <-- Base de datos inicial limpia
│   ├── productos.csv / .json     <-- 15 Cortes con costos y precios
│   ├── clientes.csv / .json      <-- 55 Clientes con teléfonos y direcciones
│   ├── ventas.csv / .json        <-- 186 Ventas históricas limpias
│   └── lucas.csv / .json         <-- 28 Registros de conciliación con Lucas
├── google-apps-script/
│   └── Code.gs                    <-- Script para pegar en tu Google Sheet oficial
└── .github/
    └── workflows/
        └── backup-sheets.yml      <-- Respaldo automático diario en GitHub Actions
```

---

## 🛠️ GUÍA DE PUESTA EN MARCHA (Paso a Paso)

### PASO 1: Activar la App en tu Celular (GitHub Pages)

El código ya está subido a tu repositorio de GitHub. Ahora solo debes encender la página web:

1. Entra a tu repositorio: [github.com/PiteIbarbia/carnespremium-app](https://github.com/PiteIbarbia/carnespremium-app)
2. Haz clic en **Settings** (Ajustes, arriba a la derecha) > menú izquierdo **Pages**.
3. En **Build and deployment** > **Source**, selecciona: **Deploy from a branch**.
4. En Branch, selecciona: **`main`** y carpeta `/(root)`. Haz clic en **Save**.
5. Espera unos 60 segundos y tu app estará activa en:  
   👉 **`https://piteibarbia.github.io/carnespremium-app/`**
6. **Instalarla en tu celular:**
   * **En iPhone (Safari):** Abre el link anterior, presiona el botón "Compartir" (el cuadrado con la flecha hacia arriba) y toca **"Añadir a pantalla de inicio"**.
   * **En Android (Chrome):** Abre el link, toca los 3 puntos arriba a la derecha y selecciona **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.
   * ¡Listo! Te quedará el ícono de 🥩 en tu celular como una App nativa.

---

### PASO 2: Vincular tu Google Sheet Oficial con la App

Tu planilla de Google Sheets está en:  
`https://docs.google.com/spreadsheets/d/1HKFo5onbdDSg_-8_sXxRDaHbBg7pQsMiuGRqYYWy-IE/edit`

1. Abre ese enlace en tu navegador.
2. Asegúrate de tener las siguientes pestañas creadas con estos nombres exactos (en mayúsculas):
   * `PRODUCTOS`
   * `CLIENTES`
   * `VENTAS`
   * `LUCAS`
   *(Si necesitas cargar los datos iniciales limpios, puedes importar los archivos que están en la carpeta `database/` de este proyecto).*
3. **Instalar el script conector:**
   * En el menú superior de Google Sheets, ve a: **Extensiones** > **Apps Script**.
   * Borra cualquier código que aparezca.
   * Abre el archivo `google-apps-script/Code.gs` de este proyecto, copia todo su contenido y pégalo allí.
   * Haz clic en el ícono de **Guardar** (el disquete 💾).
   * Haz clic en el botón azul **Implementar** (arriba a la derecha) > **Nueva implementación**.
   * Elige tipo: **Aplicación web**.
   * Configura:
     * Descripción: `API Carnes Premium`
     * Ejecutar como: `Yo` (tu cuenta)
     * Quién tiene acceso: `Cualquier persona` (Anyone)
   * Haz clic en **Implementar**, autoriza los permisos de tu cuenta de Google y copia la **URL de la aplicación web** (la que termina en `/exec`).

---

### PASO 3: Conectar la App con tu Google Sheet

1. Abre tu App en el celular o computadora (`https://piteibarbia.github.io/carnespremium-app/`).
2. Toca la pestaña **Ajustes** (ícono de engranaje ⚙️ abajo a la derecha).
3. Pega la URL de la Web App que copiaste en el paso anterior.
4. Toca **"Guardar y Probar Conexión"**.
5. El indicador superior cambiará de *Modo Local* a **🟢 Conectado a Google Sheets**.

---

### PASO 4: Activar el Respaldo Nocturno Automático en GitHub

1. En tu repo [github.com/PiteIbarbia/carnespremium-app](https://github.com/PiteIbarbia/carnespremium-app), ve a **Settings** > **Secrets and variables** > **Actions**.
2. Haz clic en **New repository secret**.
3. Nombre: `SHEETS_API_URL`
4. Valor: La misma URL de Apps Script que termina en `/exec`.
5. Haz clic en **Add secret**.
6. A partir de hoy, todas las noches a las 00:00 (hora Argentina) se descargará un respaldo automático en la carpeta `backups/`.

---

## 📲 ¿Cómo registrar ventas y enviar WhatsApps?

1. En la pestaña **Vender (📝)**:
   * Escribe las primeras letras del cliente (ej. *Muncha*) y se autocompleta.
   * Elige el corte (ej. *Picaña*).
   * Ingresa los kilos pesados (ej. *1.34*).
   * Revisa el desglose de totales y ganancia compartida (50% Juanito, 50% Lucas).
2. Toca **"📲 Ticket x WhatsApp"**:
   * Se abre el WhatsApp del cliente con el mensaje detallado del pedido, monto cobrado y saldo.
3. Toca **"💾 Guardar Venta"**:
   * Queda registrada en tu teléfono y sincronizada en tiempo real con tu Google Sheet.
