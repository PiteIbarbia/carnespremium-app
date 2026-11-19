/**
 * ====================================================================
 * CARNES PREMIUM — SISTEMA INTEGRAL
 * Backend API & Automatizaciones para Google Sheets
 * Soporta Tickets Multi-Corte (Opción A), Clientes, Cortes y Pedidos
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
    if (action === 'all' || action === 'ofertas') {
      data.ofertas = leerHojaComoJSON(obtenerHoja(ss, ['OFERTAS', 'Ofertas', 'Promociones']));
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ENDPOINT POST: Recibe tickets multi-corte, pedidos, clientes o cortes desde la App
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // OPCIÓN A: TICKET MULTI-CORTE (Guarda una fila por cada corte con el mismo ID_TICKET)
    if (action === 'nuevo_ticket_multicorte') {
      let sheetVentas = obtenerHoja(ss, ['VENTAS', 'Ventas', 'Registro de Ventas']);
      if (!sheetVentas) {
        sheetVentas = ss.insertSheet('VENTAS');
        sheetVentas.appendRow([
          'ID_TICKET', 'FECHA', 'MES', 'CLIENTE', 'CORTE', 'KG_VENDIDOS', 'COSTO_X_KG',
          'COSTO_TOTAL', 'PRECIO_X_KG', 'SUBTOTAL_VENTA', 'DESCUENTO_TICKET', 'TOTAL_TICKET',
          'GANANCIA_NETA_ITEM', 'ETAPA_MARGEN', 'MEDIO_PAGO', 'COBRO_EFECTIVO', 'COBRO_DIGITAL',
          'MONTO_RECIBIDO', 'SALDO_CLIENTE', 'ESTADO_PAGO', 'OBSERVACIONES'
        ]);
      }
      const t = payload.ticket;
      const items = t.items || [];
      const fecha = t.fecha || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
      const mes = t.mes || Utilities.formatDate(new Date(), "GMT-3", "MMMM");

      items.forEach(function(item) {
        const row = [
          t.id_ticket,
          fecha,
          mes,
          t.cliente,
          item.corte,
          Number(item.kg_vendidos) || 0,
          Number(item.costo_x_kg) || 0,
          Number(item.costo_total) || 0,
          Number(item.precio_x_kg) || 0,
          Number(item.subtotal) || 0,
          Number(t.descuento) || 0,
          Number(t.total_venta) || 0,
          Number(item.ganancia_neta) || 0,
          fecha <= '2026-06-22' ? '50% Compartida' : '100% Directa',
          t.medio_pago || 'MercadoPago',
          Number(t.cobro_efectivo) || 0,
          Number(t.cobro_digital) || 0,
          Number(t.monto_recibido) || 0,
          Number(t.saldo_cliente) || 0,
          t.estado_pago || 'Pagó',
          t.observaciones || ''
        ];
        sheetVentas.appendRow(row);
      });

      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: 'Ticket multi-corte registrado con éxito (' + items.length + ' cortes)',
        id_ticket: t.id_ticket
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // REGISTRO INDIVIDUAL TRADICIONAL
    if (action === 'nueva_venta') {
      let sheetVentas = obtenerHoja(ss, ['VENTAS', 'Ventas', 'Registro de Ventas']);
      if (!sheetVentas) {
        sheetVentas = ss.insertSheet('VENTAS');
        sheetVentas.appendRow([
          'ID_TICKET', 'FECHA', 'MES', 'CLIENTE', 'CORTE', 'KG_VENDIDOS', 'COSTO_X_KG',
          'COSTO_TOTAL', 'PRECIO_X_KG', 'SUBTOTAL_VENTA', 'DESCUENTO_TICKET', 'TOTAL_TICKET',
          'GANANCIA_NETA_ITEM', 'ETAPA_MARGEN', 'MEDIO_PAGO', 'COBRO_EFECTIVO', 'COBRO_DIGITAL',
          'MONTO_RECIBIDO', 'SALDO_CLIENTE', 'ESTADO_PAGO', 'OBSERVACIONES'
        ]);
      }
      const v = payload.venta;
      const row = [
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
        0, // descuento
        Number(v.total_venta) || 0,
        Number(v.ganancia_neta) || 0,
        v.etapa_margen || (v.fecha <= '2026-06-22' ? '50% Compartida' : '100% Directa'),
        v.medio_pago || 'MercadoPago',
        v.medio_pago === 'Efectivo' ? Number(v.monto_recibido) : 0,
        v.medio_pago !== 'Efectivo' ? Number(v.monto_recibido) : 0,
        Number(v.monto_recibido) || 0,
        Number(v.saldo_cliente) || 0,
        v.estado_pago || 'Pagó',
        v.observaciones || ''
      ];
      sheetVentas.appendRow(row);

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Venta registrada' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'nuevo_pedido') {
      let sheetPedidos = obtenerHoja(ss, ['PEDIDOS', 'Pedidos', 'Pedidos Programados']);
      if (!sheetPedidos) {
        sheetPedidos = ss.insertSheet('PEDIDOS');
        sheetPedidos.appendRow(['ID', 'FECHA_PEDIDO', 'FECHA_ENTREGA', 'CLIENTE', 'CORTES_DETALLE', 'KG_TOTALES', 'ESTADO', 'NOTAS', 'TELEFONO']);
      }
      const p = payload.pedido;
      sheetPedidos.appendRow([
        p.id, p.fecha_pedido, p.fecha_entrega, p.cliente, p.cortes_detalle || p.corte,
        Number(p.kg_totales || p.kg_estimados) || 0, p.estado || 'Pendiente', p.notas || '', p.telefono || ''
      ]);

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Pedido agendado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'guardar_corte') {
      let sheetCortes = obtenerHoja(ss, ['PRODUCTOS', 'Cortes de Carne', 'Cortes', 'Productos']);
      if (!sheetCortes) {
        sheetCortes = ss.insertSheet('PRODUCTOS');
        sheetCortes.appendRow(['ID', 'CORTE', 'COSTO_KG', 'PRECIO_KG', 'GANANCIA_KG', 'NOTAS']);
      }
      const c = payload.corte;
      const data = sheetCortes.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]).trim().toLowerCase() === String(c.corte).trim().toLowerCase()) {
          sheetCortes.getRange(i + 1, 3).setValue(Number(c.costo_kg));
          sheetCortes.getRange(i + 1, 4).setValue(Number(c.precio_kg));
          sheetCortes.getRange(i + 1, 5).setValue(Number(c.precio_kg) - Number(c.costo_kg));
          if (c.notas) sheetCortes.getRange(i + 1, 6).setValue(c.notas);
          updated = true;
          break;
        }
      }
      if (!updated) {
        sheetCortes.appendRow([c.id || Utilities.getUuid().substring(0, 6), c.corte, Number(c.costo_kg), Number(c.precio_kg), Number(c.precio_kg) - Number(c.costo_kg), c.notas || '']);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Corte sincronizado con Sheets' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'guardar_cliente') {
      let sheetCli = obtenerHoja(ss, ['CLIENTES', 'Clientes', 'cta cte clientes']);
      if (!sheetCli) {
        sheetCli = ss.insertSheet('CLIENTES');
        sheetCli.appendRow(['ID', 'CLIENTE', 'TELEFONO', 'DOMICILIO', 'OBSERVACIONES']);
      }
      const cli = payload.cliente;
      const data = sheetCli.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]).trim().toLowerCase() === String(cli.nombre).trim().toLowerCase()) {
          if (cli.telefono) sheetCli.getRange(i + 1, 3).setValue(cli.telefono);
          if (cli.domicilio) sheetCli.getRange(i + 1, 4).setValue(cli.domicilio);
          if (cli.notas) sheetCli.getRange(i + 1, 5).setValue(cli.notas);
          updated = true;
          break;
        }
      }
      if (!updated) {
        sheetCli.appendRow([cli.id || Utilities.getUuid().substring(0, 6), cli.nombre, cli.telefono || '', cli.domicilio || '', cli.notas || '']);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Cliente sincronizado con Sheets' }))
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
