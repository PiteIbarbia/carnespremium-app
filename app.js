/**
 * ====================================================================
 * CARNES PREMIUM — GESTIÓN, PEDIDOS & VENTAS
 * Frontend Controller, Métricas con Chart.js, Preventa y Sincronización
 * ====================================================================
 */

// Helper para obtener la URL de Google Apps Script (desde config.js o localStorage)
const getInitialApiUrl = () => {
  if (typeof CONFIG !== 'undefined' && CONFIG.SHEETS_API_URL && CONFIG.SHEETS_API_URL.trim() !== '') {
    return CONFIG.SHEETS_API_URL.trim();
  }
  return localStorage.getItem('sheets_api_url') || '';
};

// Estado global de la aplicación
const AppState = {
  productos: [],
  clientes: [],
  ventas: [],
  pedidos: [],
  proveedor: [],
  sheetsApiUrl: getInitialApiUrl(),
  selectedClient: null,
  isSyncing: false,
  charts: {
    monthly: null,
    cuts: null
  }
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
  initDateDisplays();
  await loadInitialData();
  setupEventListeners();
  renderDashboard();
  renderPedidos();
  renderClientes();
  renderProveedor();
  checkConnectionStatus();

  // Sincronización automática silenciosa si hay URL
  if (AppState.sheetsApiUrl) {
    syncFromSheetsSilently();
  }

  // Activar observadores de segundo plano
  initAutoSync();

  // Service Worker PWA Offline
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

      if (targetTabId === 'tab-dashboard') {
        renderDashboard();
        setTimeout(renderCharts, 100);
      }
      if (targetTabId === 'tab-pedidos') renderPedidos();
      if (targetTabId === 'tab-clientes') renderClientes();
      if (targetTabId === 'tab-proveedor') renderProveedor();
    });
  });
}

function initDateDisplays() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const display = document.getElementById('currentDateDisplay');
  if (display) display.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Set today in date inputs
  const todayIso = d.toISOString().split('T')[0];
  const posFecha = document.getElementById('posFecha');
  if (posFecha && !posFecha.value) posFecha.value = todayIso;

  const orderFecha = document.getElementById('orderFechaEntrega');
  if (orderFecha && !orderFecha.value) {
    const nextSat = new Date();
    nextSat.setDate(nextSat.getDate() + (6 - nextSat.getDay() + 7) % 7);
    orderFecha.value = nextSat.toISOString().split('T')[0];
  }

  const provFecha = document.getElementById('provFecha');
  if (provFecha && !provFecha.value) provFecha.value = todayIso;
}

/**
 * 2. CARGA DE DATOS LOCALES O REMOTOS
 */
async function loadInitialData() {
  try {
    const localVentas = localStorage.getItem('carniceria_ventas');
    const localClientes = localStorage.getItem('carniceria_clientes');
    const localProductos = localStorage.getItem('carniceria_productos');
    const localPedidos = localStorage.getItem('carniceria_pedidos');
    const localProveedor = localStorage.getItem('carniceria_proveedor') || localStorage.getItem('carniceria_lucas');

    if (localVentas && localClientes && localProductos) {
      AppState.ventas = JSON.parse(localVentas);
      AppState.clientes = JSON.parse(localClientes);
      AppState.productos = JSON.parse(localProductos);
      AppState.pedidos = localPedidos ? JSON.parse(localPedidos) : [];
      AppState.proveedor = localProveedor ? JSON.parse(localProveedor) : [];
    } else {
      const [prodRes, cliRes, vtaRes, pedRes, provRes] = await Promise.all([
        fetch('./database/productos.json').then(r => r.json()).catch(() => []),
        fetch('./database/clientes.json').then(r => r.json()).catch(() => []),
        fetch('./database/ventas.json').then(r => r.json()).catch(() => []),
        fetch('./database/pedidos.json').then(r => r.json()).catch(() => []),
        fetch('./database/proveedor.json').then(r => r.json()).catch(() => [])
      ]);

      AppState.productos = prodRes;
      AppState.clientes = cliRes.map(normalizeClient);
      AppState.ventas = vtaRes;
      AppState.pedidos = pedRes;
      AppState.proveedor = provRes;

      saveLocalData();
    }

    // Calcular saldos de billetera de clientes según ventas históricas
    calculateClientBalances();

    populateProductSelects();
    populateClientDatalists();
  } catch (error) {
    console.error('Error cargando datos:', error);
  }
}

function normalizeClient(c) {
  const nombre = c.cliente || c.nombre || '';
  const tel = c.teléfono_contacto || c.telefono_contacto || c.teléfono || c.telefono || '';
  const cleanTel = String(tel).replace(/[^0-9]/g, '');
  return {
    id: c.id || nombre,
    nombre: nombre,
    telefono: tel,
    telefono_whatsapp: cleanTel,
    domicilio: c.domicilio || c.dirección || c.direccion || '',
    notas: c.notas || c.observaciones || '',
    saldo: Number(c.saldo) || 0
  };
}

function calculateClientBalances() {
  const balanceMap = {};
  AppState.ventas.forEach(v => {
    if (!v.cliente) return;
    const key = v.cliente.trim().toLowerCase();
    const saldo = Number(v.saldo_cliente) || 0;
    balanceMap[key] = (balanceMap[key] || 0) + saldo;
  });

  AppState.clientes.forEach(c => {
    if (!c.nombre) return;
    const key = c.nombre.trim().toLowerCase();
    if (balanceMap[key] !== undefined) {
      c.saldo = balanceMap[key];
    }
  });
}

function saveLocalData() {
  localStorage.setItem('carniceria_ventas', JSON.stringify(AppState.ventas));
  localStorage.setItem('carniceria_clientes', JSON.stringify(AppState.clientes));
  localStorage.setItem('carniceria_productos', JSON.stringify(AppState.productos));
  localStorage.setItem('carniceria_pedidos', JSON.stringify(AppState.pedidos));
  localStorage.setItem('carniceria_proveedor', JSON.stringify(AppState.proveedor));
}

/**
 * 3. SELECTORES & AUTOCOMPLETADO
 */
function populateProductSelects() {
  const posSelect = document.getElementById('posCorte');
  const orderSelect = document.getElementById('orderCorte');

  const optionsHtml = '<option value="">Seleccionar corte...</option>' + 
    AppState.productos.map(p => `<option value="${p.corte}">${p.corte} ($ ${Number(p.precio_kg).toLocaleString('es-AR')}/Kg)</option>`).join('');

  if (posSelect) posSelect.innerHTML = optionsHtml;
  if (orderSelect) orderSelect.innerHTML = optionsHtml;
}

function populateClientDatalists() {
  const datalist = document.getElementById('clientesDatalist');
  if (!datalist) return;

  datalist.innerHTML = AppState.clientes
    .filter(c => c.nombre)
    .map(c => `<option value="${c.nombre}"></option>`)
    .join('');
}

/**
 * 4. EVENTOS Y FORMULARIOS
 */
function setupEventListeners() {
  const clienteInput = document.getElementById('posCliente');
  const corteSelect = document.getElementById('posCorte');
  const kilosInput = document.getElementById('posKilos');
  const costoKgInput = document.getElementById('posCostoKg');
  const precioKgInput = document.getElementById('posPrecioKg');
  const montoRecibidoInput = document.getElementById('posMontoRecibido');
  const posFechaInput = document.getElementById('posFecha');
  const posForm = document.getElementById('posForm');

  corteSelect.addEventListener('change', () => {
    const corteSeleccionado = AppState.productos.find(p => p.corte === corteSelect.value);
    if (corteSeleccionado) {
      costoKgInput.value = corteSeleccionado.costo_kg;
      precioKgInput.value = corteSeleccionado.precio_kg;
      calculatePosTotals();
    }
  });

  // Detección de cliente y alerta de saldo de billetera
  clienteInput.addEventListener('input', () => {
    const val = clienteInput.value.trim().toLowerCase();
    const match = AppState.clientes.find(c => c.nombre && c.nombre.toLowerCase() === val);
    const badge = document.getElementById('clienteInfoBadge');
    const walletBox = document.getElementById('walletAlertBox');
    const walletText = document.getElementById('walletAlertText');

    if (match) {
      AppState.selectedClient = match;
      badge.style.display = 'block';
      badge.innerHTML = `📞 ${match.telefono || 'Sin teléfono'} | 📍 ${match.domicilio || 'Sin dirección'}`;

      if (match.saldo > 0) {
        walletBox.style.display = 'flex';
        walletText.innerHTML = `🟢 <strong>${match.nombre}</strong> tiene <strong>${formatMoney(match.saldo)}</strong> a favor en su billetera.`;
      } else if (match.saldo < 0) {
        walletBox.style.display = 'flex';
        walletBox.style.borderColor = 'rgba(244, 63, 94, 0.4)';
        walletBox.style.background = 'rgba(244, 63, 94, 0.15)';
        walletText.innerHTML = `🔴 <strong>${match.nombre}</strong> adeuda <strong>${formatMoney(Math.abs(match.saldo))}</strong> de compras anteriores.`;
        document.getElementById('btnApplyWalletCredit').style.display = 'none';
      } else {
        walletBox.style.display = 'none';
      }
    } else {
      AppState.selectedClient = null;
      badge.style.display = 'none';
      walletBox.style.display = 'none';
    }
  });

  // Botón para aplicar crédito a favor del cliente
  document.getElementById('btnApplyWalletCredit').addEventListener('click', () => {
    if (AppState.selectedClient && AppState.selectedClient.saldo > 0) {
      const c = calculatePosTotals();
      const montoNeto = Math.max(0, c.totalVenta - AppState.selectedClient.saldo);
      montoRecibidoInput.value = montoNeto;
      calculatePosTotals();
      alert(`Se aplicó el crédito de ${formatMoney(AppState.selectedClient.saldo)}. Monto restante a abonar: ${formatMoney(montoNeto)}`);
    }
  });

  [kilosInput, costoKgInput, precioKgInput, montoRecibidoInput, posFechaInput].forEach(inp => {
    inp.addEventListener('input', calculatePosTotals);
  });

  posForm.addEventListener('submit', handleGuardarVenta);

  // Botones WhatsApp y Ticket
  document.getElementById('btnWhatsAppTicket').addEventListener('click', handleEnviarWhatsApp);
  document.getElementById('btnVerTicket').addEventListener('click', () => {
    renderTicketModal();
    document.getElementById('ticketModal').classList.add('active');
  });
  document.getElementById('btnCloseTicket').addEventListener('click', () => {
    document.getElementById('ticketModal').classList.remove('active');
  });
  document.getElementById('btnPrintTicket').addEventListener('click', () => window.print());

  // Formulario Pedido Futuro
  const orderForm = document.getElementById('orderForm');
  if (orderForm) orderForm.addEventListener('submit', handleGuardarPedido);

  // Copiar Pedido Frigorífico
  document.getElementById('btnCopiarPedidoFrigo').addEventListener('click', handleCopiarPedidoFrigorifico);

  // Formulario Proveedor
  const provForm = document.getElementById('proveedorForm');
  if (provForm) provForm.addEventListener('submit', handleGuardarMovimientoProveedor);

  // Filtro de Dashboard
  document.getElementById('dashMonthFilter').addEventListener('change', () => {
    renderDashboard();
    renderCharts();
  });

  // Simulador de Metas
  const metaInput = document.getElementById('inputMetaGanancia');
  if (metaInput) metaInput.addEventListener('input', calculateProjectionSimulator);

  // Buscador de Clientes
  document.getElementById('searchClienteInput').addEventListener('input', (e) => {
    renderClientes(e.target.value);
  });

  // Cerrar Modal Cliente
  document.getElementById('btnCloseClientModal').addEventListener('click', () => {
    document.getElementById('clientModal').classList.remove('active');
  });

  // Configuración de API
  const apiInput = document.getElementById('sheetsApiUrlInput');
  if (apiInput) apiInput.value = AppState.sheetsApiUrl;

  document.getElementById('btnGuardarApiUrl').addEventListener('click', () => {
    const val = apiInput.value.trim();
    localStorage.setItem('sheets_api_url', val);
    AppState.sheetsApiUrl = val;
    checkConnectionStatus();
    syncFromSheetsSilently();
    alert('URL guardada. Probando conexión en tiempo real...');
  });

  document.getElementById('btnSyncFromSheets').addEventListener('click', syncFromSheets);
  document.getElementById('btnExportJson').addEventListener('click', exportarBackupJSON);
}

/**
 * 5. CÁLCULO DE TOTALES EN VIVO (CON REGLA DE NEGOCIO HISTÓRICA)
 */
function calculatePosTotals() {
  const kilos = parseFloat(document.getElementById('posKilos').value) || 0;
  const costoKg = parseFloat(document.getElementById('posCostoKg').value) || 0;
  const precioKg = parseFloat(document.getElementById('posPrecioKg').value) || 0;
  const montoRecibido = parseFloat(document.getElementById('posMontoRecibido').value);
  const fecha = document.getElementById('posFecha').value || new Date().toISOString().split('T')[0];

  const costoTotal = kilos * costoKg;
  const totalVenta = kilos * precioKg;
  const margenTotal = totalVenta - costoTotal;

  // Regla de ganancia:
  // Hasta 2026-06-22: 50%
  // Desde 2026-06-23: 100% directa (Lucas sumó ganancia al costo)
  let gananciaNeta = margenTotal;
  let splitLabel = 'Ganancia 100% Directa';

  if (fecha <= '2026-06-22') {
    gananciaNeta = margenTotal * 0.5;
    splitLabel = 'Ganancia 50% Compartida';
  }

  document.getElementById('liveCostoTotal').textContent = formatMoney(costoTotal);
  document.getElementById('liveTotalVenta').textContent = formatMoney(totalVenta);
  document.getElementById('liveMargenTotal').textContent = formatMoney(gananciaNeta);
  document.getElementById('liveSplitText').textContent = splitLabel;

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

  return { kilos, costoKg, costoTotal, precioKg, totalVenta, margenTotal, gananciaNeta, montoRecibido, fecha };
}

/**
 * 6. GUARDAR VENTA
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

  const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mIdx = parseInt(c.fecha.split('-')[1], 10);
  const mes = meses[mIdx] || 'Noviembre';

  const nuevaVenta = {
    id: Date.now().toString().slice(-6),
    fecha: c.fecha,
    mes: mes,
    cliente: clienteNombre,
    corte: corte,
    kg_vendidos: c.kilos,
    costo_x_kg: c.costoKg,
    costo_total: c.costoTotal,
    precio_x_kg: c.precioKg,
    total_venta: c.totalVenta,
    margen_bruto: c.margenTotal,
    ganancia_neta: c.gananciaNeta,
    etapa_margen: c.fecha <= '2026-06-22' ? '50% Compartida' : '100% Directa',
    medio_pago: medioPago,
    monto_recibido: recibido,
    saldo_cliente: saldoCliente,
    estado_pago: saldoCliente >= 0 ? 'Pagó' : 'Saldo Pendiente',
    observaciones: saldoCliente === 0 ? '' : (saldoCliente > 0 ? `A favor AR$ ${saldoCliente}` : `Debe AR$ ${Math.abs(saldoCliente)}`)
  };

  AppState.ventas.unshift(nuevaVenta);
  calculateClientBalances();
  saveLocalData();
  renderDashboard();
  renderClientes();

  if (AppState.sheetsApiUrl) {
    updateStatusBadge('syncing');
    fetch(AppState.sheetsApiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nueva_venta', venta: nuevaVenta })
    }).then(() => updateStatusBadge('connected')).catch(() => updateStatusBadge('offline'));
  }

  alert(`¡Venta #${nuevaVenta.id} registrada!\nTotal: ${formatMoney(c.totalVenta)}\nGanancia Neta: ${formatMoney(c.gananciaNeta)}`);

  renderTicketModal(nuevaVenta);
  document.getElementById('ticketModal').classList.add('active');

  document.getElementById('posForm').reset();
  initDateDisplays();
  calculatePosTotals();
}

/**
 * 7. GESTIÓN DE PEDIDOS PROGRAMADOS / TICKETS FUTUROS
 */
function handleGuardarPedido(e) {
  e.preventDefault();

  const cliente = document.getElementById('orderCliente').value.trim();
  const fechaEntrega = document.getElementById('orderFechaEntrega').value;
  const corte = document.getElementById('orderCorte').value;
  const kilos = parseFloat(document.getElementById('orderKilos').value) || 0;
  const notas = document.getElementById('orderNotas').value.trim();

  if (!cliente || !corte || kilos <= 0) {
    alert('Completa los campos requeridos del pedido.');
    return;
  }

  const matchClient = AppState.clientes.find(c => c.nombre && c.nombre.toLowerCase() === cliente.toLowerCase());
  const tel = matchClient ? matchClient.telefono : '';

  const prod = AppState.productos.find(p => p.corte === corte);
  const precio = prod ? prod.precio_kg : 0;

  const nuevoPedido = {
    id: 'PED-' + Date.now().toString().slice(-4),
    fecha_pedido: new Date().toISOString().split('T')[0],
    fecha_entrega: fechaEntrega,
    cliente: cliente,
    corte: corte,
    kg_estimados: kilos,
    precio_x_kg: precio,
    estado: 'Pendiente',
    notas: notas,
    telefono: tel
  };

  AppState.pedidos.unshift(nuevoPedido);
  saveLocalData();
  renderPedidos();

  alert(`¡Pedido ${nuevoPedido.id} agendado para entrega el ${fechaEntrega}!`);
  document.getElementById('orderForm').reset();
  initDateDisplays();
}

function renderPedidos() {
  const container = document.getElementById('pedidosList');
  const countBadge = document.getElementById('pedidosCountBadge');
  const frigoContainer = document.getElementById('frigoCutsContainer');
  if (!container) return;

  const activeOrders = AppState.pedidos.filter(p => p.estado !== 'Entregado');
  countBadge.textContent = `${activeOrders.length} Pendientes`;

  // Calcular consolidado para frigorífico
  const cutsTally = {};
  let totalKilosFrigo = 0;

  activeOrders.forEach(p => {
    cutsTally[p.corte] = (cutsTally[p.corte] || 0) + (p.kg_estimados || 0);
    totalKilosFrigo += (p.kg_estimados || 0);
  });

  if (frigoContainer) {
    if (Object.keys(cutsTally).length === 0) {
      frigoContainer.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted);">No hay pedidos pendientes para esta semana.</span>';
    } else {
      frigoContainer.innerHTML = Object.entries(cutsTally)
        .map(([corte, kg]) => `<div class="frigo-cut-tag">🥩 ${corte}: <strong>${kg.toFixed(2)} Kg</strong></div>`)
        .join('') + `<div class="frigo-cut-tag" style="background: rgba(16, 185, 129, 0.2); border-color: var(--accent-green);">TOTAL: <strong>${totalKilosFrigo.toFixed(2)} Kg</strong></div>`;
    }
  }

  container.innerHTML = '';
  if (AppState.pedidos.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No hay pedidos agendados.</div>';
    return;
  }

  AppState.pedidos.forEach(p => {
    const item = document.createElement('div');
    item.className = 'list-item';

    let badgeClass = 'badge-yellow';
    if (p.estado === 'Para Armar') badgeClass = 'badge-blue';
    if (p.estado === 'En Reparto') badgeClass = 'badge-purple';
    if (p.estado === 'Entregado') badgeClass = 'badge-green';

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title">${p.cliente} <span class="badge ${badgeClass}" style="margin-left: 6px;">${p.estado}</span></div>
        <div class="item-desc">📅 Entrega: <strong>${p.fecha_entrega}</strong> | 🥩 ${p.corte} (~${p.kg_estimados} Kg)</div>
        ${p.notas ? `<div style="font-size: 0.75rem; color: var(--accent-amber);">📝 ${p.notas}</div>` : ''}
      </div>
      <div class="item-actions">
        ${p.estado !== 'Entregado' ? `
          <button class="btn btn-sm btn-primary" onclick="convertirPedidoAVenta('${p.id}')">
            ✅ Pesar y Vender
          </button>
        ` : ''}
        ${p.telefono ? `
          <a href="https://wa.me/${p.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${p.cliente}! Tu pedido de ${p.corte} para el ${p.fecha_entrega} está agendado en Carnes Premium.`)}" target="_blank" class="badge badge-green" style="text-decoration: none; padding: 6px 10px;">
            📲 WhatsApp
          </a>
        ` : ''}
      </div>
    `;
    container.appendChild(item);
  });
}

// Convertir pedido futuro en venta rápida
window.convertirPedidoAVenta = function(pedidoId) {
  const p = AppState.pedidos.find(x => x.id === pedidoId);
  if (!p) return;

  // Cambiar a pestaña Vender
  document.querySelector('.nav-item[data-tab="tab-pos"]').click();

  document.getElementById('posCliente').value = p.cliente;
  document.getElementById('posCorte').value = p.corte;
  document.getElementById('posKilos').value = p.kg_estimados;

  const prod = AppState.productos.find(x => x.corte === p.corte);
  if (prod) {
    document.getElementById('posCostoKg').value = prod.costo_kg;
    document.getElementById('posPrecioKg').value = prod.precio_kg;
  }

  // Disparar input event para actualizar alerta de billetera
  document.getElementById('posCliente').dispatchEvent(new Event('input'));
  calculatePosTotals();

  // Marcar pedido como Entregado
  p.estado = 'Entregado';
  saveLocalData();
};

function handleCopiarPedidoFrigorifico() {
  const activeOrders = AppState.pedidos.filter(p => p.estado !== 'Entregado');
  if (activeOrders.length === 0) {
    alert('No hay pedidos pendientes para encargar.');
    return;
  }

  const cutsTally = {};
  let totalKg = 0;
  activeOrders.forEach(p => {
    cutsTally[p.corte] = (cutsTally[p.corte] || 0) + (p.kg_estimados || 0);
    totalKg += (p.kg_estimados || 0);
  });

  let msg = `🥩 *PEDIDO PROVEEDOR / FRIGORÍFICO — CARNES PREMIUM*\n----------------------------------------\n`;
  for (const [corte, kg] of Object.entries(cutsTally)) {
    msg += `• ${corte}: *${kg.toFixed(2)} Kg*\n`;
  }
  msg += `----------------------------------------\n*TOTAL A RETIRAR: ${totalKg.toFixed(2)} Kg*`;

  navigator.clipboard.writeText(msg).then(() => {
    alert('¡Lista copiada al portapapeles! Ya puedes pegarla en WhatsApp al proveedor.');
  }).catch(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  });
}

/**
 * 8. WHATSAPP & TICKETS (NEUTRAL - CARNES PREMIUM)
 */
function handleEnviarWhatsApp() {
  const clienteNombre = document.getElementById('posCliente').value.trim();
  const corte = document.getElementById('posCorte').value;
  const c = calculatePosTotals();

  if (!clienteNombre || c.totalVenta <= 0) {
    alert('Ingresa el cliente, corte y kilos antes de generar el comprobante.');
    return;
  }

  let cliente = AppState.selectedClient;
  if (!cliente) {
    cliente = AppState.clientes.find(cl => cl.nombre && cl.nombre.toLowerCase() === clienteNombre.toLowerCase());
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
`🥩 *CARNES PREMIUM*
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
 * 9. DASHBOARD, GRÁFICAS (CHART.JS) & PROYECCIONES
 */
function renderDashboard() {
  const filterMonth = document.getElementById('dashMonthFilter').value;

  let filtered = AppState.ventas;
  if (filterMonth !== 'all') {
    filtered = AppState.ventas.filter(v => v.mes && v.mes.toLowerCase() === filterMonth.toLowerCase());
  }

  let totalFacturado = 0;
  let totalKilos = 0;
  let totalNeto = 0;

  filtered.forEach(v => {
    totalFacturado += parseFloat(v.total_venta) || 0;
    totalKilos += parseFloat(v.kg_vendidos) || 0;
    totalNeto += parseFloat(v.ganancia_neta) || 0;
  });

  const margenPromedio = totalKilos > 0 ? (totalNeto / totalKilos) : 0;

  document.getElementById('kpiTotalVentas').textContent = formatMoney(totalFacturado);
  document.getElementById('kpiVentasCount').textContent = `${filtered.length} operaciones`;
  document.getElementById('kpiTotalKilos').textContent = `${totalKilos.toFixed(1)} Kg`;
  document.getElementById('kpiNetoTotal').textContent = formatMoney(totalNeto);
  document.getElementById('kpiMargenPromedio').textContent = `${formatMoney(margenPromedio)}/Kg`;

  // Render lista de ventas
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

  calculateProjectionSimulator();
}

function calculateProjectionSimulator() {
  const metaGanancia = parseFloat(document.getElementById('inputMetaGanancia').value) || 1500000;

  // Promedio mensual real del histórico
  const mesesDistintos = new Set(AppState.ventas.map(v => v.mes)).size || 6;
  const totalFacturadoHist = AppState.ventas.reduce((acc, v) => acc + (v.total_venta || 0), 0);
  const totalGananciaHist = AppState.ventas.reduce((acc, v) => acc + (v.ganancia_neta || 0), 0);
  const totalKilosHist = AppState.ventas.reduce((acc, v) => acc + (v.kg_vendidos || 0), 0);

  const facturacionPromMes = totalFacturadoHist / mesesDistintos;
  const gananciaPromMes = totalGananciaHist / mesesDistintos;
  const margenPromKg = totalKilosHist > 0 ? (totalGananciaHist / totalKilosHist) : 2500;

  document.getElementById('projFacturacionMes').textContent = formatMoney(facturacionPromMes);
  document.getElementById('projGananciaMes').textContent = formatMoney(gananciaPromMes);

  const kilosNecesarios = metaGanancia / (margenPromKg || 2500);
  document.getElementById('metaKilosResult').textContent = `Para ganar ${formatMoney(metaGanancia)} netos necesitas vender ~${kilosNecesarios.toFixed(0)} Kg este mes.`;
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  // 1. Datos mensuales
  const mesesOrdenados = ["Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre"];
  const salesByMonth = {};
  const profitByMonth = {};

  mesesOrdenados.forEach(m => {
    salesByMonth[m] = 0;
    profitByMonth[m] = 0;
  });

  AppState.ventas.forEach(v => {
    if (v.mes && salesByMonth[v.mes] !== undefined) {
      salesByMonth[v.mes] += (v.total_venta || 0);
      profitByMonth[v.mes] += (v.ganancia_neta || 0);
    }
  });

  // Gráfico 1: Evolución Mensual
  const ctxMonthly = document.getElementById('monthlyEvolutionChart');
  if (ctxMonthly) {
    if (AppState.charts.monthly) AppState.charts.monthly.destroy();

    AppState.charts.monthly = new Chart(ctxMonthly, {
      type: 'bar',
      data: {
        labels: mesesOrdenados,
        datasets: [
          {
            label: 'Facturación ($)',
            data: mesesOrdenados.map(m => salesByMonth[m]),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderRadius: 6
          },
          {
            label: 'Ganancia Neta ($)',
            data: mesesOrdenados.map(m => profitByMonth[m]),
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3756' } }
        }
      }
    });
  }

  // Gráfico 2: Demanda por Corte (Kilos)
  const cutsTally = {};
  AppState.ventas.forEach(v => {
    if (v.corte) {
      cutsTally[v.corte] = (cutsTally[v.corte] || 0) + (v.kg_vendidos || 0);
    }
  });

  const sortedCuts = Object.entries(cutsTally).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const ctxCuts = document.getElementById('cutsVolumeChart');
  if (ctxCuts) {
    if (AppState.charts.cuts) AppState.charts.cuts.destroy();

    AppState.charts.cuts = new Chart(ctxCuts, {
      type: 'bar',
      data: {
        labels: sortedCuts.map(c => c[0]),
        datasets: [{
          label: 'Kilos Vendidos',
          data: sortedCuts.map(c => c[1]),
          backgroundColor: [
            'rgba(16, 185, 129, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(244, 63, 94, 0.8)',
            'rgba(20, 184, 166, 0.8)',
            'rgba(99, 102, 241, 0.8)'
          ],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: '#2a3756' } },
          y: { ticks: { color: '#fff', font: { weight: 'bold' } }, grid: { display: false } }
        }
      }
    });
  }
}

/**
 * 10. FICHA DE CLIENTE 360° & HISTORIAL
 */
function renderClientes(query = '') {
  const container = document.getElementById('clientesList');
  if (!container) return;

  const q = query.toLowerCase().trim();
  const filtered = AppState.clientes.filter(c => 
    (c.nombre && c.nombre.toLowerCase().includes(q)) || 
    (c.telefono && String(c.telefono).includes(q)) ||
    (c.domicilio && c.domicilio.toLowerCase().includes(q))
  );

  document.getElementById('clientesCountBadge').textContent = `${filtered.length} Clientes`;
  container.innerHTML = '';

  filtered.forEach(c => {
    const item = document.createElement('div');
    item.className = 'list-item';

    let saldoBadge = '';
    if (c.saldo > 0) saldoBadge = `<span class="badge badge-green">+${formatMoney(c.saldo)} a favor</span>`;
    if (c.saldo < 0) saldoBadge = `<span class="badge badge-red">Debe ${formatMoney(Math.abs(c.saldo))}</span>`;

    item.innerHTML = `
      <div class="item-main" onclick="abrirFichaCliente('${c.nombre.replace(/'/g, "\\'")}')">
        <div class="item-title">${c.nombre} ${saldoBadge}</div>
        <div class="item-desc">📞 ${c.telefono || 'Sin teléfono'}</div>
        <div class="item-desc">📍 ${c.domicilio || 'Sin domicilio registrado'}</div>
        ${c.notas ? `<div style="font-size: 0.75rem; color: var(--accent-amber); margin-top: 2px;">📌 ${c.notas}</div>` : ''}
      </div>
      <div class="item-actions">
        ${c.telefono_whatsapp ? `
          <a href="https://wa.me/${c.telefono_whatsapp}" target="_blank" class="badge badge-green" style="text-decoration: none; padding: 6px 10px;">
            💬 WA
          </a>
        ` : ''}
      </div>
    `;
    container.appendChild(item);
  });
}

window.abrirFichaCliente = function(nombreCliente) {
  const cliente = AppState.clientes.find(c => c.nombre === nombreCliente);
  if (!cliente) return;

  document.getElementById('clientModalName').textContent = cliente.nombre;
  document.getElementById('clientModalContact').innerHTML = `📞 ${cliente.telefono || 'Sin teléfono'} | 📍 ${cliente.domicilio || 'Sin dirección'}`;

  // Compras de este cliente
  const compras = AppState.ventas.filter(v => v.cliente && v.cliente.toLowerCase() === cliente.nombre.toLowerCase());
  const totalFacturado = compras.reduce((acc, v) => acc + (v.total_venta || 0), 0);
  const totalKilos = compras.reduce((acc, v) => acc + (v.kg_vendidos || 0), 0);

  document.getElementById('clientModalTotalVentas').textContent = formatMoney(totalFacturado);
  document.getElementById('clientModalTotalKilos').textContent = `${totalKilos.toFixed(1)} Kg`;

  const saldoEl = document.getElementById('clientModalSaldo');
  if (cliente.saldo > 0) {
    saldoEl.textContent = `+${formatMoney(cliente.saldo)}`;
    saldoEl.style.color = 'var(--accent-green)';
  } else if (cliente.saldo < 0) {
    saldoEl.textContent = `-${formatMoney(Math.abs(cliente.saldo))}`;
    saldoEl.style.color = 'var(--accent-rose)';
  } else {
    saldoEl.textContent = '$ 0 (Al día)';
    saldoEl.style.color = '#fff';
  }

  // Enlace WhatsApp
  const btnWa = document.getElementById('btnClientModalWhatsApp');
  if (cliente.telefono_whatsapp) {
    btnWa.style.display = 'inline-flex';
    btnWa.href = `https://wa.me/${cliente.telefono_whatsapp}`;
  } else {
    btnWa.style.display = 'none';
  }

  // Botón Tomar Pedido
  document.getElementById('btnClientModalNewOrder').onclick = () => {
    document.getElementById('clientModal').classList.remove('active');
    document.querySelector('.nav-item[data-tab="tab-pedidos"]').click();
    document.getElementById('orderCliente').value = cliente.nombre;
  };

  // Render historial
  const historyList = document.getElementById('clientModalHistoryList');
  historyList.innerHTML = '';
  if (compras.length === 0) {
    historyList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px;">Sin compras registradas aún.</div>';
  } else {
    compras.forEach(v => {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.style.padding = '8px 10px';
      row.innerHTML = `
        <div class="item-main">
          <div style="font-weight: 700; font-size: 0.85rem;">${v.fecha} — ${v.corte || 'Carne'}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${v.kg_vendidos ? v.kg_vendidos + ' Kg • ' : ''}${v.medio_pago || 'MP'}</div>
        </div>
        <div style="font-weight: 800; color: var(--accent-green); font-size: 0.9rem;">
          ${formatMoney(v.total_venta)}
        </div>
      `;
      historyList.appendChild(row);
    });
  }

  document.getElementById('clientModal').classList.add('active');
};

/**
 * 11. CUENTA PROVEEDOR
 */
function handleGuardarMovimientoProveedor(e) {
  e.preventDefault();

  const fecha = document.getElementById('provFecha').value;
  const concepto = document.getElementById('provConcepto').value.trim();
  const pago = parseFloat(document.getElementById('provPago').value) || 0;
  const costo = parseFloat(document.getElementById('provCosto').value) || 0;
  const medio = document.getElementById('provMedio').value;

  const ultimoSaldo = AppState.proveedor.length > 0 ? (AppState.proveedor[0].saldo || 0) : 0;
  const nuevoSaldo = ultimoSaldo + costo - pago;

  const nuevoMov = {
    id: Date.now().toString().slice(-5),
    fecha: fecha,
    concepto: concepto,
    medio_pago: medio,
    pago_a_proveedor: pago,
    costo_carne: costo,
    saldo: nuevoSaldo,
    notas: ''
  };

  AppState.proveedor.unshift(nuevoMov);
  saveLocalData();
  renderProveedor();

  alert('Movimiento de proveedor registrado.');
  document.getElementById('proveedorForm').reset();
  initDateDisplays();
}

function renderProveedor() {
  const container = document.getElementById('proveedorList');
  const saldoBadge = document.getElementById('proveedorSaldoBadge');
  if (!container) return;

  const ultimoSaldo = AppState.proveedor.length > 0 ? (AppState.proveedor[0].saldo || 0) : 0;
  if (saldoBadge) {
    saldoBadge.textContent = `Saldo: ${formatMoney(Math.abs(ultimoSaldo))}`;
    if (ultimoSaldo > 0) {
      saldoBadge.className = 'badge badge-red';
      saldoBadge.textContent += ' (Deuda carne)';
    } else if (ultimoSaldo < 0) {
      saldoBadge.className = 'badge badge-green';
      saldoBadge.textContent += ' (A favor)';
    } else {
      saldoBadge.className = 'badge badge-green';
      saldoBadge.textContent = 'Al día ($0)';
    }
  }

  container.innerHTML = '';
  AppState.proveedor.forEach(l => {
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
          Costo: ${formatMoney(l.costo_carne)} | Pago: ${formatMoney(l.pago_a_proveedor)}
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
 * 12. AUTO-SYNC & STATUS
 */
function initAutoSync() {
  window.addEventListener('focus', () => syncFromSheetsSilently());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncFromSheetsSilently();
  });
  window.addEventListener('online', () => syncFromSheetsSilently());

  const interval = (typeof CONFIG !== 'undefined' && CONFIG.AUTO_SYNC_INTERVAL) ? CONFIG.AUTO_SYNC_INTERVAL : 60000;
  setInterval(() => {
    if (document.visibilityState === 'visible') syncFromSheetsSilently();
  }, interval);
}

function updateStatusBadge(state) {
  const statusEl = document.getElementById('connectionStatus');
  const textEl = document.getElementById('statusText');
  if (!statusEl || !textEl) return;

  if (state === 'syncing') {
    statusEl.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    statusEl.style.color = 'var(--accent-blue)';
    textEl.textContent = 'Sincronizando...';
  } else if (state === 'connected') {
    statusEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    statusEl.style.color = 'var(--accent-green)';
    textEl.textContent = 'En vivo (Google Sheets)';
  } else if (state === 'offline') {
    statusEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    statusEl.style.color = 'var(--accent-amber)';
    textEl.textContent = 'Modo Local (Offline)';
  }
}

function checkConnectionStatus() {
  if (AppState.sheetsApiUrl && AppState.sheetsApiUrl.includes('script.google.com')) {
    updateStatusBadge('connected');
  } else {
    updateStatusBadge('offline');
  }
}

async function syncFromSheetsSilently() {
  if (!AppState.sheetsApiUrl || AppState.isSyncing) return;
  AppState.isSyncing = true;
  updateStatusBadge('syncing');

  try {
    const res = await fetch(AppState.sheetsApiUrl + '?action=all');
    const json = await res.json();

    if (json.status === 'success' && json.data) {
      if (json.data.productos && json.data.productos.length > 0) AppState.productos = json.data.productos;
      if (json.data.clientes && json.data.clientes.length > 0) {
        AppState.clientes = json.data.clientes.map(normalizeClient);
      }
      if (json.data.ventas && json.data.ventas.length > 0) {
        AppState.ventas = json.data.ventas;
      }
      if (json.data.pedidos && json.data.pedidos.length > 0) {
        AppState.pedidos = json.data.pedidos;
      }
      if (json.data.lucas && json.data.lucas.length > 0) {
        AppState.proveedor = json.data.lucas;
      }

      calculateClientBalances();
      saveLocalData();
      populateProductSelects();
      populateClientDatalists();
      renderDashboard();
      renderPedidos();
      renderClientes();
      renderProveedor();
      updateStatusBadge('connected');
    }
  } catch (err) {
    updateStatusBadge('offline');
  } finally {
    AppState.isSyncing = false;
  }
}

async function syncFromSheets() {
  if (!AppState.sheetsApiUrl) {
    alert('Ingresa y guarda la URL de la Web App en el campo superior.');
    return;
  }
  await syncFromSheetsSilently();
  alert('¡Datos sincronizados con Google Sheets con éxito!');
}

function exportarBackupJSON() {
  const backup = {
    fecha_respaldo: new Date().toISOString(),
    empresa: "Carnes Premium",
    productos: AppState.productos,
    clientes: AppState.clientes,
    ventas: AppState.ventas,
    pedidos: AppState.pedidos,
    proveedor: AppState.proveedor
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `carnespremium_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
