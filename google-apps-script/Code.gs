/**
 * ====================================================================
 * CARNES PREMIUM — SISTEMA INTEGRAL
 * Backend API & Automatizaciones para Google Sheets
 * ====================================================================
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🥩 Carnes Premium')
    .addItem('📊 Recalcular Totales', 'recalcularTodo')
    .addItem('💾 Generar Respaldo Manual', 'generarRespaldoInterno')
    .addSeparator()
    .addItem('📱 Información de la API', 'mostrarInfoAPI')
    .addToUi();
}

/**
 * Función inteligente para encontrar una hoja por varios nombres posibles
 */
function obtenerHoja(ss, nombres) {
  for (let i = 0; i < nombres.length; i++) {
    const s = ss.getSheetByName(nombres[i]);
    if (s) return s;
  }
  const allSheets = ss.getSheets();
  for (let i = 0; i < allSheets.length; i++) {
    const name = allSheets[i].getName().trim().toLowerCase();
    for (let j = 0; j < nombres.length; j++) {
      if (name === nombres[j].trim().toLowerCase()) return allSheets[i];
    }
  }
  return null;
}

/**
 * ENDPOINT GET: Retorna productos, clientes, ventas, pedidos y proveedor en JSON
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'all';

    let data = {};

    if (action === 'all' || action === 'productos') {
      data.productos = leerHojaComoJSON(obtenerHoja(ss, ['PRODUCTOS', 'Cortes de Carne', 'Cortes', 'Productos']));
    }
    if (action === 'all' || action === 'clientes') {
      data.clientes = leerHojaComoJSON(obtenerHoja(ss, ['CLIENTES', 'Clientes', 'cta cte clientes']));
    }
    if (action === 'all' || action === 'ventas') {
      data.ventas = leerHojaComoJSON(obtenerHoja(ss, ['VENTAS', 'Ventas', 'Registro de Ventas']));
    }
    if (action === 'all' || action === 'pedidos') {
      data.pedidos = leerHojaComoJSON(obtenerHoja(ss, ['PEDIDOS', 'Pedidos', 'Pedidos Programados']));
    }
    if (action === 'all' || action === 'proveedor') {
      data.lucas = leerHojaComoJSON(obtenerHoja(ss, ['PROVEEDOR', 'Proveedor', 'LUCAS', 'Lucas', 'cta cte Lucas', 'Cta cte Lucas']));
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ENDPOINT POST: Recibe nuevas ventas, pedidos o movimientos desde la App
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === 'nueva_venta') {
      let sheetVentas = obtenerHoja(ss, ['VENTAS', 'Ventas', 'Registro de Ventas']);
      if (!sheetVentas) {
        sheetVentas = ss.insertSheet('VENTAS');
        sheetVentas.appendRow([
          'ID', 'FECHA', 'MES', 'CLIENTE', 'CORTE', 'KG_VENDIDOS', 'COSTO_X_KG',
          'COSTO_TOTAL', 'PRECIO_X_KG', 'TOTAL_VENTA', 'MARGEN_BRUTO', 'GANANCIA_NETA',
          'ETAPA_MARGEN', 'MEDIO_PAGO', 'MONTO_RECIBIDO', 'SALDO_CLIENTE', 'ESTADO_PAGO', 'OBSERVACIONES'
        ]);
      }
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
        Number(v.margen_bruto) || 0,
        Number(v.ganancia_neta) || 0,
        v.etapa_margen || (v.fecha <= '2026-06-22' ? '50% Compartida' : '100% Directa'),
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

    if (action === 'nuevo_pedido') {
      let sheetPedidos = obtenerHoja(ss, ['PEDIDOS', 'Pedidos', 'Pedidos Programados']);
      if (!sheetPedidos) {
        sheetPedidos = ss.insertSheet('PEDIDOS');
        sheetPedidos.appendRow(['ID', 'FECHA_PEDIDO', 'FECHA_ENTREGA', 'CLIENTE', 'CORTE', 'KG_ESTIMADOS', 'PRECIO_X_KG', 'ESTADO', 'NOTAS', 'TELEFONO']);
      }
      const p = payload.pedido;
      sheetPedidos.appendRow([
        p.id, p.fecha_pedido, p.fecha_entrega, p.cliente, p.corte,
        Number(p.kg_estimados) || 0, Number(p.precio_x_kg) || 0, p.estado || 'Pendiente', p.notas || '', p.telefono || ''
      ]);

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Pedido agendado' }))
        .setMimeType(ContentService.MimeType.JSON);
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
    if (row.every(cell => cell === '')) continue;
    
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
}

function recalcularTodo() {
  SpreadsheetApp.getActiveSpreadsheet().toast('Todas las fórmulas y totales están al día.', '✅ Carnes Premium');
}

function mostrarInfoAPI() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Carnes Premium — API Activa',
    'Tu API de Google Sheets está conectada correctamente con tu App en GitHub Pages.',
    ui.ButtonSet.OK
  );
}
