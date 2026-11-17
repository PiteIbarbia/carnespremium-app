/**
 * ====================================================================
 * APLICACIÓN DE GESTIÓN DE CARNICERÍA - JUANITO & LUCAS
 * Frontend Controller & Sincronización Google Sheets / WhatsApp
 * ====================================================================
 */

// Estado global de la aplicación
const AppState = {
  productos: [],
  clientes: [],
  ventas: [],
  lucas: [],
  sheetsApiUrl: localStorage.getItem('sheets_api_url') || '',
  selectedClient: null
};

// Formateador de moneda en pesos argentinos
const formatMoney = (val) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(val || 0);
};

// Inicialización de la App al cargar el DOM
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initDateDisplay();
  await loadInitialData();
  setupEventListeners();
  renderDashboard();
  renderClientes();
  renderLucas();
  checkConnectionStatus();

  // Registro del Service Worker para funcionamiento como PWA Offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
  }
});

/**
 * 1. NAVEGACIÓN POR PESTAÑAS
 */
function initTabs() {
  const navButtons = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');

      navButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = document.getElementById(targetTabId);
      if (targetTab) targetTab.classList.add('active');

      if (targetTabId === 'tab-dashboard') renderDashboard();
      if (targetTabId === 'tab-clientes') renderClientes();
      if (targetTabId === 'tab-lucas') renderLucas();
    });
  });
}

function initDateDisplay() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const display = document.getElementById('currentDateDisplay');
  if (display) display.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}

/**
 * 2. CARGA DE DATOS LOCALES O REMOTOS
 */
async function loadInitialData() {
  try {
    // Si tenemos datos en localStorage, los usamos primero para velocidad
    const localVentas = localStorage.getItem('carniceria_ventas');
    const localClientes = localStorage.getItem('carniceria_clientes');
    const localProductos = localStorage.getItem('carniceria_productos');
    const localLucas = localStorage.getItem('carniceria_lucas');

    if (localVentas && localClientes && localProductos && localLucas) {
      AppState.ventas = JSON.parse(localVentas);
      AppState.clientes = JSON.parse(localClientes);
      AppState.productos = JSON.parse(localProductos);
      AppState.lucas = JSON.parse(localLucas);
    } else {
      // Cargar archivos JSON iniciales
      const [prodRes, cliRes, vtaRes, lucRes] = await Promise.all([
        fetch('./database/productos.json').then(r => r.json()),
        fetch('./database/clientes.json').then(r => r.json()),
        fetch('./database/ventas.json').then(r => r.json()),
        fetch('./database/lucas.json').then(r => r.json())
      ]);

      AppState.productos = prodRes;
      AppState.clientes = cliRes;
      AppState.ventas = vtaRes;
      AppState.lucas = lucRes;

      saveLocalData();
    }

    populateProductSelect();
    populateClientDatalist();
  } catch (error) {
    console.error('Error cargando datos locales:', error);
  }
}

function saveLocalData() {
  localStorage.setItem('carniceria_ventas', JSON.stringify(AppState.ventas));
  localStorage.setItem('carniceria_clientes', JSON.stringify(AppState.clientes));
  localStorage.setItem('carniceria_productos', JSON.stringify(AppState.productos));
  localStorage.setItem('carniceria_lucas', JSON.stringify(AppState.lucas));
}

/**
 * 3. CONFIGURACIÓN DE SELECTORES
 */
function populateProductSelect() {
  const select = document.getElementById('posCorte');
  if (!select) return;

  select.innerHTML = '<option value="">Seleccionar corte...</option>';
  AppState.productos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.corte;
    opt.textContent = `${p.corte} ($ ${Number(p.precio_kg).toLocaleString('es-AR')}/Kg)`;
    select.appendChild(opt);
  });
}

function populateClientDatalist() {
  const datalist = document.getElementById('clientesDatalist');
  if (!datalist) return;

  datalist.innerHTML = '';
  AppState.clientes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.nombre;
    datalist.appendChild(opt);
  });
}

/**
 * 4. EVENTOS Y REACTIVIDAD EN EL FORMULARIO DE VENTA
 */
function setupEventListeners() {
  const clienteInput = document.getElementById('posCliente');
  const corteSelect = document.getElementById('posCorte');
  const kilosInput = document.getElementById('posKilos');
  const costoKgInput = document.getElementById('posCostoKg');
  const precioKgInput = document.getElementById('posPrecioKg');
  const montoRecibidoInput = document.getElementById('posMontoRecibido');
  const form = document.getElementById('posForm');

  // Autocompletar precios al cambiar corte
  corteSelect.addEventListener('change', () => {
    const corteSeleccionado = AppState.productos.find(p => p.corte === corteSelect.value);
    if (corteSeleccionado) {
      costoKgInput.value = corteSeleccionado.costo_kg;
      precioKgInput.value = corteSeleccionado.precio_kg;
      calculatePosTotals();
    }
  });

  // Mostrar info del cliente seleccionado (teléfono / dirección)
  clienteInput.addEventListener('input', () => {
    const match = AppState.clientes.find(c => c.nombre.toLowerCase() === clienteInput.value.trim().toLowerCase());
    const badge = document.getElementById('clienteInfoBadge');
    if (match) {
      AppState.selectedClient = match;
      badge.style.display = 'block';
      badge.innerHTML = `📞 ${match.telefono || 'Sin teléfono'} | 📍 ${match.domicilio || 'Sin dirección'}`;
    } else {
      AppState.selectedClient = null;
      badge.style.display = 'none';
    }
  });

  // Recalcular en vivo al teclear kilos, costos o precios
  [kilosInput, costoKgInput, precioKgInput, montoRecibidoInput].forEach(inp => {
    inp.addEventListener('input', calculatePosTotals);
  });

  // Guardar venta
  form.addEventListener('submit', handleGuardarVenta);

  // Botón WhatsApp Ticket
  document.getElementById('btnWhatsAppTicket').addEventListener('click', handleEnviarWhatsApp);

  // Botón Ver Ticket
  document.getElementById('btnVerTicket').addEventListener('click', () => {
    renderTicketModal();
    document.getElementById('ticketModal').classList.add('active');
  });

  document.getElementById('btnCloseTicket').addEventListener('click', () => {
    document.getElementById('ticketModal').classList.remove('active');
  });

  document.getElementById('btnPrintTicket').addEventListener('click', () => {
    window.print();
  });

  // Filtro de Mes en Dashboard
  document.getElementById('dashMonthFilter').addEventListener('change', renderDashboard);

  // Buscador de Clientes
  document.getElementById('searchClienteInput').addEventListener('input', (e) => {
    renderClientes(e.target.value);
  });

  // Configuración de API
  const apiInput = document.getElementById('sheetsApiUrlInput');
  if (apiInput) apiInput.value = AppState.sheetsApiUrl;

  document.getElementById('btnGuardarApiUrl').addEventListener('click', () => {
    const val = apiInput.value.trim();
    localStorage.setItem('sheets_api_url', val);
    AppState.sheetsApiUrl = val;
    checkConnectionStatus();
    alert('URL guardada correctamente.');
  });

  document.getElementById('btnSyncFromSheets').addEventListener('click', syncFromSheets);

  document.getElementById('btnExportJson').addEventListener('click', exportarBackupJSON);
}

/**
 * 5. CÁLCULO DE TOTALES EN VIVO
 */
function calculatePosTotals() {
  const kilos = parseFloat(document.getElementById('posKilos').value) || 0;
  const costoKg = parseFloat(document.getElementById('posCostoKg').value) || 0;
  const precioKg = parseFloat(document.getElementById('posPrecioKg').value) || 0;
  const montoRecibido = parseFloat(document.getElementById('posMontoRecibido').value);

  const costoTotal = kilos * costoKg;
  const totalVenta = kilos * precioKg;
  const margenTotal = totalVenta - costoTotal;
  const netoJuanito = margenTotal / 2;
  const netoLucas = margenTotal / 2;

  document.getElementById('liveCostoTotal').textContent = formatMoney(costoTotal);
  document.getElementById('liveTotalVenta').textContent = formatMoney(totalVenta);
  document.getElementById('liveMargenTotal').textContent = formatMoney(margenTotal);
  document.getElementById('liveNetoJuanito').textContent = formatMoney(netoJuanito);
  document.getElementById('liveNetoLucas').textContent = formatMoney(netoLucas);

  // Calcular diferencia con lo recibido
  const saldoBox = document.getElementById('saldoDiferenciaBox');
  if (!isNaN(montoRecibido)) {
    const dif = montoRecibido - totalVenta;
    if (dif === 0) {
      saldoBox.innerHTML = '<span style="color: var(--accent-green);">✅ Pagó monto exacto.</span>';
    } else if (dif > 0) {
      saldoBox.innerHTML = `<span style="color: var(--accent-green);">🟢 Saldo a favor del cliente: +${formatMoney(dif)}</span>`;
    } else {
      saldoBox.innerHTML = `<span style="color: var(--accent-rose);">🔴 Saldo adeudado por cliente: ${formatMoney(dif)}</span>`;
    }
  } else {
    saldoBox.innerHTML = '';
  }

  return { kilos, costoKg, costoTotal, precioKg, totalVenta, margenTotal, netoJuanito, netoLucas, montoRecibido };
}

/**
 * 6. GUARDAR VENTA (LOCAL + GOOGLE SHEETS)
 */
async function handleGuardarVenta(e) {
  e.preventDefault();

  const c = calculatePosTotals();
  if (c.kilos <= 0 || c.totalVenta <= 0) {
    alert('Por favor completa los kilos y precio válidos.');
    return;
  }

  const clienteNombre = document.getElementById('posCliente').value.trim();
  const corte = document.getElementById('posCorte').value;
  const medioPago = document.getElementById('posMedioPago').value;
  const recibido = isNaN(c.montoRecibido) ? c.totalVenta : c.montoRecibido;
  const saldoCliente = recibido - c.totalVenta;

  const now = new Date();
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const nuevaVenta = {
    id: Date.now().toString().slice(-6),
    fecha: now.toISOString().split('T')[0],
    mes: meses[now.getMonth()],
    cliente: clienteNombre,
    corte: corte,
    kg_vendidos: c.kilos,
    costo_x_kg: c.costoKg,
    costo_total: c.costoTotal,
    precio_x_kg: c.precioKg,
    total_venta: c.totalVenta,
    ganancia_total: c.margenTotal,
    neto_juanito: c.netoJuanito,
    neto_lucas: c.netoLucas,
    medio_pago: medioPago,
    monto_recibido: recibido,
    saldo_cliente: saldoCliente,
    estado_pago: saldoCliente >= 0 ? 'Pagó' : 'Saldo Pendiente',
    observaciones: saldoCliente === 0 ? '' : (saldoCliente > 0 ? `A favor AR$ ${saldoCliente}` : `Debe AR$ ${Math.abs(saldoCliente)}`)
  };

  // Agregar al inicio de la lista
  AppState.ventas.unshift(nuevaVenta);
  saveLocalData();

  // Si existe conexión con Google Sheets, sincronizar por POST
  if (AppState.sheetsApiUrl) {
    try {
      fetch(AppState.sheetsApiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nueva_venta', venta: nuevaVenta })
      });
    } catch (err) {
      console.warn('Error al enviar a Google Sheets en background:', err);
    }
  }

  alert(`¡Venta #${nuevaVenta.id} guardada con éxito!\nTotal: ${formatMoney(c.totalVenta)}`);

  // Opcional: mostrar ticket directo
  renderTicketModal(nuevaVenta);
  document.getElementById('ticketModal').classList.add('active');

  // Resetear formulario
  document.getElementById('posForm').reset();
  calculatePosTotals();
}

/**
 * 7. GENERACIÓN DE MENSAJE Y ENVÍO POR WHATSAPP
 */
function handleEnviarWhatsApp() {
  const clienteNombre = document.getElementById('posCliente').value.trim();
  const corte = document.getElementById('posCorte').value;
  const c = calculatePosTotals();

  if (!clienteNombre || c.totalVenta <= 0) {
    alert('Ingresa el cliente, corte y kilos antes de generar el WhatsApp.');
    return;
  }

  // Buscar teléfono del cliente
  let cliente = AppState.selectedClient;
  if (!cliente) {
    cliente = AppState.clientes.find(cl => cl.nombre.toLowerCase() === clienteNombre.toLowerCase());
  }

  const tel = cliente ? (cliente.telefono_whatsapp || cliente.telefono.replace(/\D/g, '')) : '';

  const recibido = isNaN(c.montoRecibido) ? c.totalVenta : c.montoRecibido;
  const saldo = recibido - c.totalVenta;

  let saldoTxt = '✅ Saldo: Al día ($0)';
  if (saldo > 0) saldoTxt = `🟢 Saldo a tu favor: +${formatMoney(saldo)}`;
  if (saldo < 0) saldoTxt = `⚠️ Saldo pendiente: ${formatMoney(Math.abs(saldo))}`;

  const now = new Date();
  const fechaStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const mensaje = 
`🥩 *CARNES PREMIUM — JUANITO & LUCAS*
----------------------------------------
👤 *Cliente:* ${clienteNombre}
📅 *Fecha:* ${fechaStr}
🛒 *Detalle del Pedido:*
  • ${c.kilos} Kg de ${corte || 'Carne'}
  • Precio: ${formatMoney(c.precioKg)}/Kg
----------------------------------------
💰 *TOTAL:* ${formatMoney(c.totalVenta)}
💵 *Abonado:* ${formatMoney(recibido)} (${document.getElementById('posMedioPago').value})
${saldoTxt}
----------------------------------------
¡Muchas gracias por elegirnos! 🙏`;

  const encodedMsg = encodeURIComponent(mensaje);
  const waUrl = tel ? `https://wa.me/${tel}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;

  window.open(waUrl, '_blank');
}

/**
 * 8. RENDERIZAR TICKET DIGITAL / TÉRMICO
 */
function renderTicketModal(ventaDirecta = null) {
  const c = calculatePosTotals();
  const cliente = document.getElementById('posCliente').value || (ventaDirecta ? ventaDirecta.cliente : 'Cliente');
  const corte = document.getElementById('posCorte').value || (ventaDirecta ? ventaDirecta.corte : 'Corte');
  const kilos = ventaDirecta ? ventaDirecta.kg_vendidos : c.kilos;
  const precio = ventaDirecta ? ventaDirecta.precio_x_kg : c.precioKg;
  const total = ventaDirecta ? ventaDirecta.total_venta : c.totalVenta;
  const recibido = ventaDirecta ? ventaDirecta.monto_recibido : (isNaN(c.montoRecibido) ? total : c.montoRecibido);
  const medio = ventaDirecta ? ventaDirecta.medio_pago : document.getElementById('posMedioPago').value;

  const now = new Date();
  document.getElementById('ticketFecha').textContent = now.toLocaleString('es-AR');

  const body = document.getElementById('ticketBody');
  body.innerHTML = `
    <div class="ticket-row"><span>CLIENTE:</span> <strong>${cliente}</strong></div>
    <div class="ticket-row"><span>MEDIO PAGO:</span> <span>${medio}</span></div>
    <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>
    <div class="ticket-row">
      <span>${kilos} Kg x ${formatMoney(precio)}</span>
      <strong>${formatMoney(total)}</strong>
    </div>
    <div style="font-size: 0.8rem; color: #555; margin-bottom: 6px;">${corte}</div>
    <div class="ticket-total ticket-row">
      <span>TOTAL:</span>
      <span>${formatMoney(total)}</span>
    </div>
    <div class="ticket-row"><span>ABONADO:</span> <span>${formatMoney(recibido)}</span></div>
    <div class="ticket-row">
      <span>DIFERENCIA:</span>
      <span>${recibido - total === 0 ? '$ 0 (Al día)' : formatMoney(recibido - total)}</span>
    </div>
  `;
}

/**
 * 9. RENDERIZAR DASHBOARD
 */
function renderDashboard() {
  const filterMonth = document.getElementById('dashMonthFilter').value;

  let filtered = AppState.ventas;
  if (filterMonth !== 'all') {
    filtered = AppState.ventas.filter(v => v.mes && v.mes.toLowerCase() === filterMonth.toLowerCase());
  }

  // Cálculos acumulados
  let totalFacturado = 0;
  let totalKilos = 0;
  let totalNetoJuanito = 0;

  filtered.forEach(v => {
    totalFacturado += parseFloat(v.total_venta) || 0;
    totalKilos += parseFloat(v.kg_vendidos) || 0;
    totalNetoJuanito += parseFloat(v.neto_juanito) || 0;
  });

  // Saldo con Lucas
  let saldoLucas = 0;
  if (AppState.lucas.length > 0) {
    saldoLucas = AppState.lucas[AppState.lucas.length - 1].saldo || 0;
  }

  document.getElementById('kpiTotalVentas').textContent = formatMoney(totalFacturado);
  document.getElementById('kpiVentasCount').textContent = `${filtered.length} operaciones`;
  document.getElementById('kpiTotalKilos').textContent = `${totalKilos.toFixed(1)} Kg`;
  document.getElementById('kpiNetoJuanito').textContent = formatMoney(totalNetoJuanito);

  const saldoLucasEl = document.getElementById('kpiSaldoLucas');
  saldoLucasEl.textContent = formatMoney(Math.abs(saldoLucas));
  const subLucasEl = document.getElementById('kpiEstadoLucas');

  if (saldoLucas > 0) {
    saldoLucasEl.style.color = 'var(--accent-rose)';
    subLucasEl.textContent = '⚠️ Deuda a Lucas por carne';
  } else if (saldoLucas < 0) {
    saldoLucasEl.style.color = 'var(--accent-green)';
    subLucasEl.textContent = '🟢 Saldo a favor con Lucas';
  } else {
    saldoLucasEl.style.color = '#fff';
    subLucasEl.textContent = '✅ Al día (Mano a mano)';
  }

  // Renderizar lista de ventas
  document.getElementById('ventasFiltradasBadge').textContent = `${filtered.length} ventas`;
  const container = document.getElementById('dashboardVentasList');
  container.innerHTML = '';

  filtered.slice(0, 50).forEach(v => {
    const item = document.createElement('div');
    item.className = 'list-item';

    const saldoBadge = v.saldo_cliente < 0 
      ? `<span class="badge badge-red">Debe ${formatMoney(Math.abs(v.saldo_cliente))}</span>`
      : (v.saldo_cliente > 0 ? `<span class="badge badge-green">+${formatMoney(v.saldo_cliente)} a favor</span>` : '');

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title">${v.cliente}</div>
        <div class="item-desc">${v.fecha} | ${v.corte ? v.corte + ' • ' : ''}${v.kg_vendidos ? v.kg_vendidos + ' Kg • ' : ''}${v.medio_pago || 'MP'}</div>
      </div>
      <div class="item-actions">
        ${saldoBadge}
        <strong style="color: var(--accent-green); font-size: 1rem;">${formatMoney(v.total_venta)}</strong>
      </div>
    `;
    container.appendChild(item);
  });
}

/**
 * 10. RENDERIZAR CLIENTES
 */
function renderClientes(query = '') {
  const container = document.getElementById('clientesList');
  if (!container) return;

  const q = query.toLowerCase().trim();
  const filtered = AppState.clientes.filter(c => 
    c.nombre.toLowerCase().includes(q) || 
    (c.telefono && c.telefono.includes(q)) ||
    (c.domicilio && c.domicilio.toLowerCase().includes(q))
  );

  document.getElementById('clientesCountBadge').textContent = `${filtered.length} Clientes`;
  container.innerHTML = '';

  filtered.forEach(c => {
    const item = document.createElement('div');
    item.className = 'list-item';

    const waBtn = c.telefono_whatsapp ? `
      <a href="https://wa.me/${c.telefono_whatsapp}" target="_blank" class="badge badge-green" style="text-decoration: none; padding: 6px 10px;">
        💬 WhatsApp
      </a>
    ` : '';

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title">${c.nombre}</div>
        <div class="item-desc">📞 ${c.telefono || 'Sin teléfono'}</div>
        <div class="item-desc">📍 ${c.domicilio || 'Sin domicilio registrado'}</div>
        ${c.notas ? `<div style="font-size: 0.75rem; color: var(--accent-amber); margin-top: 2px;">📌 ${c.notas}</div>` : ''}
      </div>
      <div class="item-actions">
        ${waBtn}
      </div>
    `;
    container.appendChild(item);
  });
}

/**
 * 11. RENDERIZAR CUENTA LUCAS
 */
function renderLucas() {
  const container = document.getElementById('lucasList');
  if (!container) return;

  container.innerHTML = '';
  AppState.lucas.slice().reverse().forEach(l => {
    const item = document.createElement('div');
    item.className = 'list-item';

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title">${l.concepto || 'Movimiento'}</div>
        <div class="item-desc">${l.fecha} | ${l.medio_pago || 'MercadoPago'}</div>
        ${l.notas ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${l.notas}</div>` : ''}
      </div>
      <div class="item-actions" style="text-align: right; flex-direction: column; align-items: flex-end;">
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          Costo: ${formatMoney(l.costo_carne)} | Pago: ${formatMoney(l.pago_a_lucas)}
        </div>
        <div style="font-weight: 700; color: ${l.saldo > 0 ? 'var(--accent-rose)' : 'var(--accent-green)'}">
          Saldo: ${formatMoney(l.saldo)}
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

/**
 * 12. COMPROBACIÓN Y SINCRONIZACIÓN CON GOOGLE SHEETS
 */
function checkConnectionStatus() {
  const statusEl = document.getElementById('connectionStatus');
  const textEl = document.getElementById('statusText');

  if (AppState.sheetsApiUrl && AppState.sheetsApiUrl.includes('script.google.com')) {
    statusEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    statusEl.style.color = 'var(--accent-green)';
    textEl.textContent = 'Conectado a Google Sheets';
  } else {
    statusEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    statusEl.style.color = 'var(--accent-amber)';
    textEl.textContent = 'Modo Local (Sin URL API)';
  }
}

async function syncFromSheets() {
  if (!AppState.sheetsApiUrl) {
    alert('Primero ingresa y guarda la URL de la Web App en el campo superior.');
    return;
  }

  try {
    alert('Consultando Google Sheets en tiempo real...');
    const res = await fetch(AppState.sheetsApiUrl + '?action=all');
    const json = await res.json();

    if (json.status === 'success' && json.data) {
      if (json.data.productos && json.data.productos.length > 0) AppState.productos = json.data.productos;
      if (json.data.clientes && json.data.clientes.length > 0) AppState.clientes = json.data.clientes;
      if (json.data.ventas && json.data.ventas.length > 0) AppState.ventas = json.data.ventas;
      if (json.data.lucas && json.data.lucas.length > 0) AppState.lucas = json.data.lucas;

      saveLocalData();
      populateProductSelect();
      populateClientDatalist();
      renderDashboard();
      renderClientes();
      renderLucas();

      alert('¡Sincronización completada con éxito!');
    } else {
      alert('Respuesta inesperada de Google Sheets: ' + JSON.stringify(json));
    }
  } catch (error) {
    alert('Error al sincronizar: ' + error.message);
  }
}

function exportarBackupJSON() {
  const backup = {
    fecha_respaldo: new Date().toISOString(),
    productos: AppState.productos,
    clientes: AppState.clientes,
    ventas: AppState.ventas,
    lucas: AppState.lucas
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `carniceria_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
