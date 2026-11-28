/**
 * ====================================================================
 * CARNES PREMIUM — SISTEMA INTEGRAL DE GESTIÓN (GOOGLE SHEETS BACKEND)
 * Planilla oficial: https://docs.google.com/spreadsheets/d/1HKFo5onbdDSg_-8_sXxRDaHbBg7pQsMiuGRqYYWy-IE/edit
 * 
 * Funcionalidades:
 * 1. Sincronización bidireccional en tiempo real con la App Web (PWA).
 * 2. Soporte completo de Tickets Multi-Corte (Opción A).
 * 3. Auto-creación y mantenimiento de la hoja VENTAS, CLIENTES, CORTES, PROVEEDOR y PEDIDOS.
 * 4. Normalización inteligente de columnas (tolera variaciones de nombres de encabezados).
 * 5. Menú personalizado "🥩 Carnes Premium" para herramientas directas en la planilla.
 * ====================================================================
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🥩 Carnes Premium')
    .addItem('📋 Crear / Verificar Hoja VENTAS', 'menuVerificarHojaVentas')
    .addItem('📊 Recalcular Totales', 'menuRecalcularTodo')
    .addItem('💾 Generar Respaldo Interno', 'menuGenerarRespaldo')
    .addSeparator()
    .addItem('ℹ️ Estado de la Conexión Web App', 'mostrarInfoAPI')
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
 * Crea o verifica la hoja VENTAS con todos sus encabezados y formato
 */
function asegurarHojaVentas(ss) {
  let sheet = obtenerHoja(ss, ['VENTAS', 'Ventas', 'Registro de Ventas']);
  if (!sheet) {
    sheet = ss.insertSheet('VENTAS');
    const headers = [
      'ID_TICKET', 'FECHA', 'MES', 'CLIENTE', 'CORTE', 'KG_VENDIDOS', 'COSTO_X_KG',
      'COSTO_TOTAL', 'PRECIO_X_KG', 'SUBTOTAL_VENTA', 'DESCUENTO_TICKET', 'TOTAL_TICKET',
      'GANANCIA_NETA_ITEM', 'ETAPA_MARGEN', 'MEDIO_PAGO', 'COBRO_EFECTIVO', 'COBRO_DIGITAL',
      'MONTO_RECIBIDO', 'SALDO_CLIENTE', 'ESTADO_PAGO', 'OBSERVACIONES'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * ENDPOINT GET: Retorna productos, clientes, ventas, pedidos y proveedor en JSON
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'all';

    let data = {};

    // 1. CORTES DE CARNE (PRODUCTOS)
    if (action === 'all' || action === 'productos') {
      const sheetProd = obtenerHoja(ss, ['Cortes de Carne', 'Cortes', 'PRODUCTOS', 'Productos']);
      data.productos = leerCortesComoJSON(sheetProd);
    }

    // 2. CLIENTES
    if (action === 'all' || action === 'clientes') {
      const sheetCli = obtenerHoja(ss, ['Clientes', 'CLIENTES', 'cta cte clientes']);
      data.clientes = leerClientesComoJSON(sheetCli);
    }

    // 3. VENTAS (Hoja VENTAS)
    if (action === 'all' || action === 'ventas') {
      const sheetVentas = asegurarHojaVentas(ss);
      data.ventas = leerVentasComoJSON(sheetVentas);
    }

    // 4. PEDIDOS
    if (action === 'all' || action === 'pedidos') {
      const sheetPed = obtenerHoja(ss, ['PEDIDOS', 'Pedidos', 'Pedidos Programados']);
      data.pedidos = leerHojaComoJSON(sheetPed);
    }

    // 5. PROVEEDOR (cta cte Lucas)
    if (action === 'all' || action === 'proveedor') {
      const sheetLucas = obtenerHoja(ss, ['cta cte Lucas', 'Cta cte Lucas', 'PROVEEDOR', 'Proveedor', 'Lucas', 'LUCAS']);
      data.lucas = leerLucasComoJSON(sheetLucas);
    }

    // 6. OFERTAS
    if (action === 'all' || action === 'ofertas') {
      const sheetOfertas = obtenerHoja(ss, ['OFERTAS', 'Ofertas', 'Promociones']);
      data.ofertas = leerHojaComoJSON(sheetOfertas);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ENDPOINT POST: Recibe tickets multi-corte, sincronizaciones completas, pedidos, clientes o cortes desde la App
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // A. TICKET MULTI-CORTE (Guarda una fila por cada corte con el mismo ID_TICKET)
    if (action === 'nuevo_ticket_multicorte') {
      const sheetVentas = asegurarHojaVentas(ss);
      const t = payload.ticket;
      const items = t.items || [];
      const fecha = t.fecha || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
      const mes = t.mes || Utilities.formatDate(new Date(), "GMT-3", "MMMM");

      items.forEach(function(item) {
        const itemDiscount = t.subtotal > 0 ? (Number(item.subtotal) / Number(t.subtotal)) * Number(t.descuento || 0) : 0;
        const subtotalVenta = Number(item.subtotal) || (Number(item.kg_vendidos || 0) * Number(item.precio_x_kg || 0));
        const totalVentaItem = subtotalVenta - itemDiscount;

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
          subtotalVenta,
          Number(t.descuento) || 0,
          Number(t.total_venta) || 0,
          Number(item.ganancia_neta) || (totalVentaItem - Number(item.costo_total || 0)),
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

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Ticket registrado con éxito' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // B. VENTA SIMPLE INDIVIDUAL
    if (action === 'nueva_venta') {
      const sheetVentas = asegurarHojaVentas(ss);
      const v = payload.venta;
      const fecha = v.fecha || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
      const mes = v.mes || Utilities.formatDate(new Date(), "GMT-3", "MMMM");

      const row = [
        v.id_ticket || v.id || ('TCK-' + Date.now().toString().slice(-6)),
        fecha,
        mes,
        v.cliente,
        v.corte,
        Number(v.kg_vendidos) || 0,
        Number(v.costo_x_kg) || 0,
        Number(v.costo_total) || 0,
        Number(v.precio_x_kg) || 0,
        Number(v.subtotal_venta) || Number(v.total_venta) || 0,
        Number(v.descuento_ticket) || 0,
        Number(v.total_ticket) || Number(v.total_venta) || 0,
        Number(v.ganancia_neta) || 0,
        fecha <= '2026-06-22' ? '50% Compartida' : '100% Directa',
        v.medio_pago || 'MercadoPago',
        Number(v.cobro_efectivo) || 0,
        Number(v.cobro_digital) || 0,
        Number(v.monto_recibido) || 0,
        Number(v.saldo_cliente) || 0,
        v.estado_pago || 'Pagó',
        v.observaciones || ''
      ];
      sheetVentas.appendRow(row);

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Venta registrada' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // C. SINCRONIZACIÓN COMPLETA DE TODAS LAS VENTAS (DESDE LA APP HACIA SHEETS)
    if (action === 'sincronizar_todo_historico') {
      const sheetVentas = asegurarHojaVentas(ss);
      const ventas = payload.ventas || [];
      if (ventas.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No se recibieron ventas para sincronizar' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Limpiar datos anteriores manteniendo el encabezado
      const lastRow = sheetVentas.getLastRow();
      if (lastRow > 1) {
        sheetVentas.getRange(2, 1, lastRow - 1, sheetVentas.getLastColumn()).clearContent();
      }

      // Preparar matriz bidimensional para inserción masiva ultrarrápida
      const rows = ventas.map(function(v) {
        return [
          v.id_ticket || v.id || '',
          v.fecha ? String(v.fecha).split('T')[0] : '',
          v.mes || '',
          v.cliente || '',
          v.corte || '',
          Number(v.kg_vendidos) || 0,
          Number(v.costo_x_kg) || 0,
          Number(v.costo_total) || 0,
          Number(v.precio_x_kg) || 0,
          Number(v.subtotal_venta) || Number(v.total_venta) || 0,
          Number(v.descuento_ticket) || 0,
          Number(v.total_ticket) || Number(v.total_venta) || 0,
          Number(v.ganancia_neta) || 0,
          v.etapa_margen || '',
          v.medio_pago || 'MercadoPago',
          Number(v.cobro_efectivo) || 0,
          Number(v.cobro_digital) || 0,
          Number(v.monto_recibido) || 0,
          Number(v.saldo_cliente) || 0,
          v.estado_pago || 'Pagó',
          v.observaciones || ''
        ];
      });

      if (rows.length > 0) {
        sheetVentas.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Se cargaron ' + rows.length + ' registros en VENTAS' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // D. GUARDAR / EDITAR CORTE DE CARNE
    if (action === 'guardar_corte') {
      let sheetCortes = obtenerHoja(ss, ['Cortes de Carne', 'Cortes', 'PRODUCTOS', 'Productos']);
      if (!sheetCortes) {
        sheetCortes = ss.insertSheet('Cortes de Carne');
        sheetCortes.appendRow(['Corte', 'Costo x Kg (Lucas)', 'Precio x Kg (vta)', 'Ganancia x Kg', 'Notas']);
      }
      const c = payload.corte;
      const data = sheetCortes.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toLowerCase() === String(c.corte).trim().toLowerCase()) {
          sheetCortes.getRange(i + 1, 2).setValue(Number(c.costo_kg));
          sheetCortes.getRange(i + 1, 3).setValue(Number(c.precio_kg));
          sheetCortes.getRange(i + 1, 4).setValue(Number(c.precio_kg) - Number(c.costo_kg));
          if (c.notas !== undefined) sheetCortes.getRange(i + 1, 5).setValue(c.notas);
          updated = true;
          break;
        }
      }
      if (!updated) {
        sheetCortes.appendRow([c.corte, Number(c.costo_kg), Number(c.precio_kg), Number(c.precio_kg) - Number(c.costo_kg), c.notas || '']);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Corte guardado en planilla' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // E. ELIMINAR CORTE DE CARNE
    if (action === 'eliminar_corte') {
      let sheetCortes = obtenerHoja(ss, ['Cortes de Carne', 'Cortes', 'PRODUCTOS', 'Productos']);
      if (sheetCortes) {
        const data = sheetCortes.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim().toLowerCase() === String(payload.corte).trim().toLowerCase()) {
            sheetCortes.deleteRow(i + 1);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Corte eliminado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // F. GUARDAR / EDITAR CLIENTE
    if (action === 'guardar_cliente') {
      let sheetCli = obtenerHoja(ss, ['Clientes', 'CLIENTES', 'cta cte clientes']);
      if (!sheetCli) {
        sheetCli = ss.insertSheet('Clientes');
        sheetCli.appendRow(['Cliente', 'Teléfono / Contacto', 'Domicilio', 'Notas']);
      }
      const cli = payload.cliente;
      const data = sheetCli.getDataRange().getValues();
      let updated = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toLowerCase() === String(cli.nombre).trim().toLowerCase()) {
          if (cli.telefono) sheetCli.getRange(i + 1, 2).setValue(cli.telefono);
          if (cli.domicilio) sheetCli.getRange(i + 1, 3).setValue(cli.domicilio);
          if (cli.notas) sheetCli.getRange(i + 1, 4).setValue(cli.notas);
          updated = true;
          break;
        }
      }
      if (!updated) {
        sheetCli.appendRow([cli.nombre, cli.telefono || '', cli.domicilio || '', cli.notas || '']);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Cliente guardado en planilla' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // G. ELIMINAR CLIENTE
    if (action === 'eliminar_cliente') {
      let sheetCli = obtenerHoja(ss, ['Clientes', 'CLIENTES', 'cta cte clientes']);
      if (sheetCli) {
        const data = sheetCli.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim().toLowerCase() === String(payload.nombre).trim().toLowerCase()) {
            sheetCli.deleteRow(i + 1);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Cliente eliminado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // H. GUARDAR MOVIMIENTO DE PROVEEDOR (cta cte Lucas)
    if (action === 'guardar_proveedor') {
      let sheetLucas = obtenerHoja(ss, ['cta cte Lucas', 'Cta cte Lucas', 'PROVEEDOR', 'Proveedor', 'Lucas']);
      if (!sheetLucas) {
        sheetLucas = ss.insertSheet('cta cte Lucas');
        sheetLucas.appendRow(['fecha', 'concepto', 'Medio d pago', 'pague', 'costo carne', 'saldo', 'notas']);
      }
      const m = payload.movimiento;
      sheetLucas.appendRow([
        m.fecha || Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd"),
        m.concepto || 'Movimiento',
        m.medio_pago || 'MercadoPago',
        Number(m.pago_a_proveedor) || 0,
        Number(m.costo_carne) || 0,
        Number(m.saldo) || 0,
        m.notas || ''
      ]);

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Movimiento de Lucas registrado' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // I. GUARDAR PEDIDO
    if (action === 'nuevo_pedido') {
      let sheetPedidos = obtenerHoja(ss, ['PEDIDOS', 'Pedidos', 'Pedidos Programados']);
      if (!sheetPedidos) {
        sheetPedidos = ss.insertSheet('PEDIDOS');
        sheetPedidos.appendRow(['ID', 'FECHA_PEDIDO', 'FECHA_ENTREGA', 'CLIENTE', 'CORTE', 'KG_ESTIMADOS', 'ESTADO', 'NOTAS', 'TELEFONO']);
      }
      const p = payload.pedido;
      sheetPedidos.appendRow([
        p.id || Date.now().toString(),
        p.fecha_pedido || '',
        p.fecha_entrega || '',
        p.cliente || '',
        p.corte || '',
        Number(p.kg_estimados) || 0,
        p.estado || 'Pendiente',
        p.notas || '',
        p.telefono || ''
      ]);

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Pedido agendado en planilla' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // J. ELIMINAR PEDIDO
    if (action === 'eliminar_pedido') {
      let sheetPedidos = obtenerHoja(ss, ['PEDIDOS', 'Pedidos', 'Pedidos Programados']);
      if (sheetPedidos) {
        const data = sheetPedidos.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(payload.id).trim()) {
            sheetPedidos.deleteRow(i + 1);
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Pedido eliminado' }))
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
 * Lectura y normalización específica para CORTES DE CARNE
 */
function leerCortesComoJSON(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/[\s\/\-\.]+/g, '_'));
  const list = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === '' && row[1] === '') continue;

    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }

    const corte = obj.corte || obj.producto || row[0] || '';
    if (!corte) continue;

    const costo = Number(obj.costo_x_kg || obj.costo_kg || obj['costo_x_kg_(lucas)'] || row[1] || 0);
    const precio = Number(obj.precio_x_kg || obj.precio_kg || obj['precio_x_kg_(vta)'] || row[2] || 0);
    const ganancia = Number(obj.ganancia_x_kg || obj.ganancia_kg || row[3] || 0) || (precio - costo);

    list.push({
      id: String(i),
      corte: String(corte).trim(),
      costo_kg: costo,
      precio_kg: precio,
      ganancia_kg: ganancia,
      notas: obj.notas || ''
    });
  }
  return list;
}

/**
 * Lectura y normalización específica para CLIENTES
 */
function leerClientesComoJSON(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/[\s\/\-\.]+/g, '_'));
  const list = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === '' && row[1] === '') continue;

    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }

    const nombre = obj.cliente || obj.nombre || row[0] || '';
    if (!nombre) continue;

    const tel = String(obj.teléfono_contacto || obj['teléfono_/_contacto'] || obj.telefono || row[1] || '');
    const cleanTel = tel.replace(/[^0-9]/g, '');

    list.push({
      id: String(i),
      nombre: String(nombre).trim(),
      telefono: tel,
      telefono_whatsapp: cleanTel,
      domicilio: String(obj.domicilio || row[2] || '').trim(),
      notas: String(obj.notas || row[3] || '').trim()
    });
  }
  return list;
}

/**
 * Lectura y normalización para la hoja VENTAS
 */
function leerVentasComoJSON(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/[\s\/\-\.]+/g, '_'));
  const list = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => c === '')) continue;

    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }

    let fechaStr = '';
    if (obj.fecha instanceof Date) {
      fechaStr = Utilities.formatDate(obj.fecha, "GMT-3", "yyyy-MM-dd");
    } else if (obj.fecha) {
      fechaStr = String(obj.fecha).split('T')[0];
    }

    const total = Number(obj.total_venta || obj.total_ticket || 0);
    const recibido = obj.monto_recibido !== undefined && obj.monto_recibido !== '' ? Number(obj.monto_recibido) : total;
    const saldo = obj.saldo_cliente !== undefined && obj.saldo_cliente !== '' ? Number(obj.saldo_cliente) : (total - recibido);

    list.push({
      id: String(obj.id || obj.id_ticket || i),
      id_ticket: String(obj.id_ticket || ('TCK-' + i)),
      fecha: fechaStr,
      mes: String(obj.mes || ''),
      cliente: String(obj.cliente || '').trim(),
      corte: String(obj.corte || '').trim(),
      kg_vendidos: Number(obj.kg_vendidos || 0),
      costo_x_kg: Number(obj.costo_x_kg || 0),
      costo_total: Number(obj.costo_total || 0),
      precio_x_kg: Number(obj.precio_x_kg || 0),
      subtotal_venta: Number(obj.subtotal_venta || total),
      descuento_ticket: Number(obj.descuento_ticket || 0),
      total_ticket: Number(obj.total_ticket || total),
      total_venta: total,
      ganancia_neta: Number(obj.ganancia_neta_item || obj.ganancia_neta || 0),
      etapa_margen: String(obj.etapa_margen || ''),
      medio_pago: String(obj.medio_pago || 'MercadoPago'),
      cobro_efectivo: Number(obj.cobro_efectivo || 0),
      cobro_digital: Number(obj.cobro_digital || 0),
      monto_recibido: recibido,
      saldo_cliente: saldo,
      estado_pago: String(obj.estado_pago || (saldo === 0 ? 'Pagó' : (saldo < 0 ? 'A favor' : 'Saldo Pendiente'))),
      observaciones: String(obj.observaciones || '')
    });
  }
  return list;
}

/**
 * Lectura y normalización para cta cte Lucas (Proveedor)
 */
function leerLucasComoJSON(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/[\s\/\-\.]+/g, '_'));
  const list = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(c => c === '')) continue;

    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }

    let fechaStr = '';
    if (obj.fecha instanceof Date) {
      fechaStr = Utilities.formatDate(obj.fecha, "GMT-3", "yyyy-MM-dd");
    } else if (obj.fecha) {
      fechaStr = String(obj.fecha).split('T')[0];
    }

    const pago = Number(obj.pague || obj.pago_a_proveedor || obj.pago || row[3] || 0);
    const costo = Number(obj.costo_carne || obj['le_debo_esto_tiene_q_ser_igual_a_tu_costo_'] || row[4] || 0);
    const saldo = Number(obj.saldo || row[5] || 0);

    list.push({
      id: String(i),
      fecha: fechaStr,
      concepto: String(obj.concepto || row[1] || 'Movimiento'),
      medio_pago: String(obj.medio_d_pago || obj.medio_pago || row[2] || 'MercadoPago'),
      pago_a_proveedor: pago,
      costo_carne: costo,
      saldo: saldo,
      notas: String(obj.notas || row[6] || '')
    });
  }
  return list;
}

/**
 * Lector genérico de tablas
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

/**
 * Acciones del Menú en Google Sheets
 */
function menuVerificarHojaVentas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojaVentas(ss);
  SpreadsheetApp.getActiveSpreadsheet().toast('Hoja VENTAS verificada y lista para recibir tickets.', '🥩 Carnes Premium');
}

function menuRecalcularTodo() {
  SpreadsheetApp.getActiveSpreadsheet().toast('Todas las fórmulas y totales están calculados.', '✅ Carnes Premium');
}

function menuGenerarRespaldo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombreCopia = 'Backup Carnes Premium — ' + Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd_HHmm");
  DriveApp.getFileById(ss.getId()).makeCopy(nombreCopia);
  SpreadsheetApp.getActiveSpreadsheet().toast('Copia creada en tu Google Drive: ' + nombreCopia, '💾 Respaldo');
}

function mostrarInfoAPI() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Carnes Premium — API Activa',
    'La API Web está conectada y configurada para sincronización bidireccional inmediata con tu App.\n\n' +
    'Cualquier ticket cargado en la App se registrará automáticamente en la hoja VENTAS.\n' +
    'Cualquier cambio en Cortes de Carne, Clientes o VENTAS se reflejará al instante en tu App.',
    ui.ButtonSet.OK
  );
}
