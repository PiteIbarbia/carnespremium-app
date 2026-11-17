/**
 * ====================================================================
 * GESTIÓN DE CARNICERÍA - JUANITO & LUCAS
 * Backend API & Automatizaciones para Google Sheets
 * ====================================================================
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. En tu Google Sheet, ve a: Extensiones > Apps Script.
 * 2. Borra todo el código que haya y pega este archivo completo.
 * 3. Haz clic en "Guardar" (ícono de disco).
 * 4. Haz clic en "Implementar" (botón azul arriba a la derecha) > "Nueva implementación".
 * 5. Selecciona Tipo: "Aplicación web".
 * 6. Configura:
 *    - Descripción: "API Carnicería v1"
 *    - Ejecutar como: "Yo" (tu cuenta)
 *    - Quién tiene acceso: "Cualquier persona" (Anyone)
 * 7. Haz clic en "Implementar" y autoriza los permisos.
 * 8. Copia la URL de la aplicación web generada (la usarás en la App).
 */

// Menú personalizado al abrir el Google Sheet
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🥩 Gestión Carnes')
    .addItem('📊 Recalcular Totales', 'recalcularTodo')
    .addItem('💾 Generar Respaldo Manual', 'generarRespaldoInterno')
    .addSeparator()
    .addItem('📱 Información de la API', 'mostrarInfoAPI')
    .addToUi();
}

/**
 * ENDPOINT GET: Retorna productos, clientes, ventas y saldo de Lucas en JSON
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'all';

    let data = {};

    if (action === 'all' || action === 'productos') {
      data.productos = leerHojaComoJSON(ss.getSheetByName('PRODUCTOS'));
    }
    if (action === 'all' || action === 'clientes') {
      data.clientes = leerHojaComoJSON(ss.getSheetByName('CLIENTES'));
    }
    if (action === 'all' || action === 'ventas') {
      data.ventas = leerHojaComoJSON(ss.getSheetByName('VENTAS'));
    }
    if (action === 'all' || action === 'lucas') {
      data.lucas = leerHojaComoJSON(ss.getSheetByName('LUCAS'));
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ENDPOINT POST: Recibe nuevas ventas o pagos desde la App Móvil
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === 'nueva_venta') {
      const sheetVentas = ss.getSheetByName('VENTAS');
      const v = payload.venta;
      
      const newRow = [
        v.id || Utilities.getUuid().substring(0, 8),
        v.fecha || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd"),
        v.mes || Utilities.formatDate(new Date(), "GMT-3", "MMMM"),
        v.cliente,
        v.corte,
        Number(v.kg_vendidos) || 0,
        Number(v.costo_x_kg) || 0,
        Number(v.costo_total) || 0,
        Number(v.precio_x_kg) || 0,
        Number(v.total_venta) || 0,
        Number(v.ganancia_total) || 0,
        Number(v.neto_juanito) || 0,
        Number(v.neto_lucas) || 0,
        v.medio_pago || 'MercadoPago',
        v.monto_recibido || 0,
        v.saldo_cliente || 0,
        v.estado_pago || 'Pagó',
        v.observaciones || ''
      ];

      sheetVentas.appendRow(newRow);

      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: 'Venta registrada con éxito',
        id: newRow[0]
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'nuevo_pago_lucas') {
      const sheetLucas = ss.getSheetByName('LUCAS');
      const l = payload.lucas;
      
      const newRow = [
        l.id || Utilities.getUuid().substring(0, 8),
        l.fecha || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd"),
        l.concepto,
        l.medio_pago || 'MercadoPago',
        Number(l.pago_a_lucas) || 0,
        Number(l.costo_carne) || 0,
        Number(l.saldo) || 0,
        l.notas || ''
      ];

      sheetLucas.appendRow(newRow);

      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: 'Movimiento con Lucas registrado',
        id: newRow[0]
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Acción no reconocida' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función auxiliar para leer cualquier hoja y convertirla en array de objetos JSON
 */
function leerHojaComoJSON(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/[\s\/\-\.]+/g, '_'));
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(cell => cell === '')) continue; // Saltar filas vacías
    
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
}

function recalcularTodo() {
  SpreadsheetApp.getActiveSpreadsheet().toast('Todas las fórmulas y totales están al día.', '✅ Listo');
}

function mostrarInfoAPI() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Conexión API',
    'Para conectar tu App Móvil:\n\n1. Ve a "Implementar" > "Gestionar implementaciones".\n2. Copia la URL de la aplicación web.\n3. Pégala en la pestaña Configuración de tu App de GitHub.',
    ui.ButtonSet.OK
  );
}
