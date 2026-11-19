/**
 * ====================================================================
 * CARNES PREMIUM — GESTIÓN, PEDIDOS & VENTAS
 * Controller Integral PWA / Web App
 * Soporta:
 *  - Carrito Multi-Corte por Ticket (Opción A en Google Sheets)
 *  - Medios de Pago Mixtos (Efectivo + Digital)
 *  - CRUD Completo de Cortes de Carne (Costos & Precios)
 *  - CRUD Completo de Ofertas & Promociones (Detección en Balanza)
 *  - CRUD Completo de Clientes & Ficha 360°
 *  - Preventa / Pedidos Programados & Consolidado Frigorífico
 *  - Métricas Chart.js & Proyecciones con Regla Histórica de Ganancia
 *  - Sincronización Automática Bidireccional con Google Sheets
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
  ofertas: [],
  posCart: [],           // Cortes cargados en el ticket actual
  lastSavedTicket: null, // Último ticket guardado para imprimir o WhatsApp
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

// ====================================================================
// INICIALIZACIÓN DE LA APLICACIÓN AL CARGAR EL DOM
// ====================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initDateDisplays();
  await loadInitialData();
  setupEventListeners();
  renderPosCart();
  calculatePosTotals();
  renderDashboard();
  renderPedidos();
  renderCortesCatalog();
  renderOffersList();
  renderClientes();
  renderProveedor();
  checkConnectionStatus();

  // Sincronización automática silenciosa si hay URL configurada
  if (AppState.sheetsApiUrl) {
    syncFromSheetsSilently();
  }

  // Activar observadores de segundo plano para sincronizar al volver a la app
  initAutoSync();

  // Registrar Service Worker para soporte PWA y modo Offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
  }
});

// ====================================================================
// 1. NAVEGACIÓN POR PESTAÑAS
// ====================================================================
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
        setTimeout(renderCharts, 120);
      }
      if (targetTabId === 'tab-pedidos') renderPedidos();
      if (targetTabId === 'tab-cortes') {
        renderOffersList();
        renderCortesCatalog();
      }
      if (targetTabId === 'tab-clientes') renderClientes();
      if (targetTabId === 'tab-config') renderProveedor();
      if (targetTabId === 'tab-pos') {
        calculatePosTotals();
      }
    });
  });
}

function initDateDisplays() {
  const d = new Date();
  const dateStr = d.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const display = document.getElementById('currentDateDisplay');
  if (display) display.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

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

// ====================================================================
// 2. CARGA DE DATOS LOCALES O REMOTOS
// ====================================================================
async function loadInitialData() {
  try {
    const localVentas = localStorage.getItem('carniceria_ventas');
    const localClientes = localStorage.getItem('carniceria_clientes');
    const localProductos = localStorage.getItem('carniceria_productos');
    const localPedidos = localStorage.getItem('carniceria_pedidos');
    const localProveedor = localStorage.getItem('carniceria_proveedor') || localStorage.getItem('carniceria_lucas');
    const localOfertas = localStorage.getItem('carniceria_ofertas');

    if (localVentas && localClientes && localProductos) {
      AppState.ventas = JSON.parse(localVentas);
      AppState.clientes = JSON.parse(localClientes);
      AppState.productos = JSON.parse(localProductos);
      AppState.pedidos = localPedidos ? JSON.parse(localPedidos) : [];
      AppState.proveedor = localProveedor ? JSON.parse(localProveedor) : [];
      AppState.ofertas = localOfertas ? JSON.parse(localOfertas) : [];
    } else {
      const [prodRes, cliRes, vtaRes, pedRes, provRes, ofRes] = await Promise.all([
        fetch('./database/productos.json').then(r => r.json()).catch(() => []),
        fetch('./database/clientes.json').then(r => r.json()).catch(() => []),
        fetch('./database/ventas.json').then(r => r.json()).catch(() => []),
        fetch('./database/pedidos.json').then(r => r.json()).catch(() => []),
        fetch('./database/proveedor.json').then(r => r.json()).catch(() => []),
        fetch('./database/ofertas.json').then(r => r.json()).catch(() => [])
      ]);

      AppState.productos = prodRes;
      AppState.clientes = cliRes.map(normalizeClient);
      AppState.ventas = vtaRes;
      AppState.pedidos = pedRes;
      AppState.proveedor = provRes;
      AppState.ofertas = ofRes;

      saveLocalData();
    }

    calculateClientBalances();
    populateProductSelects();
    populateClientDatalists();
  } catch (error) {
    console.error('Error cargando base de datos inicial:', error);
  }
}

function normalizeClient(c) {
  const nombre = c.cliente || c.nombre || '';
  const tel = c.teléfono_contacto || c.telefono_contacto || c.teléfono || c.telefono || '';
  const cleanTel = String(tel).replace(/[^0-9]/g, '');
  return {
    id: c.id || String(Date.now() + Math.random()),
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
  localStorage.setItem('carniceria_ofertas', JSON.stringify(AppState.ofertas));
}

// ====================================================================
// 3. SELECTORES & AUTOCOMPLETADO
// ====================================================================
function populateProductSelects() {
  const posSelect = document.getElementById('posCorte');
  const orderSelect = document.getElementById('orderCorte');
  const offerSelect = document.getElementById('offerCut');
  const editOrderSelect = document.getElementById('editOrderCorte');
  const editSaleSelect = document.getElementById('editSaleCorte');

  const optionsHtml = '<option value="">Seleccionar corte...</option>' + 
    AppState.productos.map(p => `<option value="${p.corte}">${p.corte} ($ ${Number(p.precio_kg).toLocaleString('es-AR')}/Kg)</option>`).join('');

  if (posSelect) posSelect.innerHTML = optionsHtml;
  if (orderSelect) orderSelect.innerHTML = optionsHtml;
  if (offerSelect) offerSelect.innerHTML = optionsHtml;
  if (editOrderSelect) editOrderSelect.innerHTML = optionsHtml;
  if (editSaleSelect) editSaleSelect.innerHTML = optionsHtml;
}

function populateClientDatalists() {
  const datalist = document.getElementById('clientesDatalist');
  if (!datalist) return;

  datalist.innerHTML = AppState.clientes
    .filter(c => c.nombre)
    .map(c => `<option value="${c.nombre}"></option>`)
    .join('');
}

// ====================================================================
// 4. CONFIGURACIÓN DE EVENTOS PRINCIPALES
// ====================================================================
function setupEventListeners() {
  const clienteInput = document.getElementById('posCliente');
  const corteSelect = document.getElementById('posCorte');
  const kilosInput = document.getElementById('posKilos');
  const costoKgInput = document.getElementById('posCostoKg');
  const precioKgInput = document.getElementById('posPrecioKg');
  const posDescuentoInput = document.getElementById('posDescuento');
  const posMedioPagoSelect = document.getElementById('posMedioPago');
  const montoRecibidoInput = document.getElementById('posMontoRecibido');
  const pagoEfectivoInput = document.getElementById('posPagoEfectivo');
  const pagoDigitalInput = document.getElementById('posPagoDigital');
  const posFechaInput = document.getElementById('posFecha');
  const posForm = document.getElementById('posForm');

  // Selección de corte: auto-completar costo, precio y chequear ofertas activas
  corteSelect.addEventListener('change', () => {
    const corteSeleccionado = AppState.productos.find(p => p.corte === corteSelect.value);
    const offerBadge = document.getElementById('activeOfferBadge');

    if (corteSeleccionado) {
      costoKgInput.value = corteSeleccionado.costo_kg;
      precioKgInput.value = corteSeleccionado.precio_kg;

      // Buscar si este corte tiene una oferta activa
      const promo = AppState.ofertas.find(o => o.activa && o.corte.toLowerCase() === corteSeleccionado.corte.toLowerCase());
      if (promo) {
        offerBadge.style.display = 'block';
        offerBadge.innerHTML = `🔥 <strong>${promo.nombre}:</strong> $${Number(promo.valor).toLocaleString('es-AR')}/Kg (${promo.descripcion || 'Especial'}) 
          <button type="button" class="btn btn-sm btn-primary" style="margin-left:8px; padding:2px 8px; font-size:0.75rem;" onclick="aplicarOfertaAlCorte(${promo.valor})">Aplicar Precio Oferta</button>`;
      } else {
        offerBadge.style.display = 'none';
      }

      calculatePosTotals();
    } else {
      offerBadge.style.display = 'none';
    }
  });

  // Detección de cliente y alerta de saldo de billetera
  clienteInput.addEventListener('input', () => {
    const val = clienteInput.value.trim().toLowerCase();
    const match = AppState.clientes.find(c => c.nombre && c.nombre.toLowerCase() === val);
    const badge = document.getElementById('clienteInfoBadge');
    const walletBox = document.getElementById('walletAlertBox');
    const walletText = document.getElementById('walletAlertText');
    const btnApply = document.getElementById('btnApplyWalletCredit');

    if (match) {
      AppState.selectedClient = match;
      badge.style.display = 'block';
      badge.innerHTML = `📞 ${match.telefono || 'Sin teléfono'} | 📍 ${match.domicilio || 'Sin dirección'}`;

      if (match.saldo > 0) {
        walletBox.style.display = 'flex';
        walletBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        walletBox.style.background = 'rgba(16, 185, 129, 0.15)';
        btnApply.style.display = 'inline-block';
        walletText.innerHTML = `🟢 <strong>${match.nombre}</strong> tiene <strong>${formatMoney(match.saldo)}</strong> a favor en su billetera.`;
      } else if (match.saldo < 0) {
        walletBox.style.display = 'flex';
        walletBox.style.borderColor = 'rgba(244, 63, 94, 0.4)';
        walletBox.style.background = 'rgba(244, 63, 94, 0.15)';
        btnApply.style.display = 'none';
        walletText.innerHTML = `🔴 <strong>${match.nombre}</strong> adeuda <strong>${formatMoney(Math.abs(match.saldo))}</strong> de compras anteriores.`;
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
      alert(`Se aplicó el crédito de ${formatMoney(AppState.selectedClient.saldo)}. Saldo a abonar: ${formatMoney(montoNeto)}`);
    }
  });

  // Manejo de pago mixto vs pago individual
  posMedioPagoSelect.addEventListener('change', () => {
    const isMixto = posMedioPagoSelect.value === 'Mixto';
    const mixedBox = document.getElementById('mixedPaymentBox');
    const singleGroup = document.getElementById('singlePaymentGroup');

    if (isMixto) {
      mixedBox.style.display = 'block';
      singleGroup.style.display = 'none';
    } else {
      mixedBox.style.display = 'none';
      singleGroup.style.display = 'block';
    }
    calculatePosTotals();
  });

  // Evento botón "➕ Agregar Corte al Ticket"
  document.getElementById('btnAddItemToCart').addEventListener('click', handleAddItemToCart);

  // Recálculos en vivo
  [kilosInput, costoKgInput, precioKgInput, posDescuentoInput, montoRecibidoInput, pagoEfectivoInput, pagoDigitalInput, posFechaInput].forEach(inp => {
    if (inp) inp.addEventListener('input', calculatePosTotals);
  });

  // Envío del Ticket completo de Venta
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

  // Formulario Pedido Futuro (Preventa)
  const orderForm = document.getElementById('orderForm');
  if (orderForm) orderForm.addEventListener('submit', handleGuardarPedido);

  // Copiar Pedido Frigorífico
  document.getElementById('btnCopiarPedidoFrigo').addEventListener('click', handleCopiarPedidoFrigorifico);

  // Formulario Movimiento Proveedor
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

  // Cerrar Modal Ficha Cliente 360°
  document.getElementById('btnCloseClientModal').addEventListener('click', () => {
    document.getElementById('clientModal').classList.remove('active');
  });

  // Buscador y Filtro de Pedidos
  const searchPed = document.getElementById('searchPedidoInput');
  if (searchPed) searchPed.addEventListener('input', () => renderPedidos());
  const filterPed = document.getElementById('filterPedidoEstado');
  if (filterPed) filterPed.addEventListener('change', () => renderPedidos());

  // Modal Editar Pedido
  const closeOrderEditBtn = document.getElementById('btnCloseOrderEditModal');
  if (closeOrderEditBtn) closeOrderEditBtn.addEventListener('click', () => {
    document.getElementById('orderEditModal').classList.remove('active');
  });
  const orderEditForm = document.getElementById('orderEditForm');
  if (orderEditForm) orderEditForm.addEventListener('submit', handleSaveOrderEdit);
  const deleteOrderModalBtn = document.getElementById('btnDeleteOrderFromModal');
  if (deleteOrderModalBtn) deleteOrderModalBtn.addEventListener('click', handleDeleteOrderFromModal);

  // Buscador y Filtro de Histórico de Ventas
  const searchVta = document.getElementById('searchVentaInput');
  if (searchVta) searchVta.addEventListener('input', () => renderDashboard());
  const filterVta = document.getElementById('filterVentaPago');
  if (filterVta) filterVta.addEventListener('change', () => renderDashboard());

  // Modal Editar Venta
  const closeSaleEditBtn = document.getElementById('btnCloseSaleEditModal');
  if (closeSaleEditBtn) closeSaleEditBtn.addEventListener('click', () => {
    document.getElementById('saleEditModal').classList.remove('active');
  });
  const saleEditForm = document.getElementById('saleEditForm');
  if (saleEditForm) saleEditForm.addEventListener('submit', handleSaveSaleEdit);
  const deleteSaleModalBtn = document.getElementById('btnDeleteSaleFromModal');
  if (deleteSaleModalBtn) deleteSaleModalBtn.addEventListener('click', handleDeleteSaleFromModal);

  // MODAL CORTES: Abrir / Cerrar / Guardar
  document.getElementById('btnOpenNewCutModal').addEventListener('click', openNewCutModal);
  document.getElementById('btnCloseCutModal').addEventListener('click', () => {
    document.getElementById('cutModal').classList.remove('active');
  });
  document.getElementById('cutForm').addEventListener('submit', handleSaveCut);

  // MODAL OFERTAS: Abrir / Cerrar / Guardar
  document.getElementById('btnOpenNewOfferModal').addEventListener('click', openNewOfferModal);
  document.getElementById('btnCloseOfferModal').addEventListener('click', () => {
    document.getElementById('offerModal').classList.remove('active');
  });
  document.getElementById('offerForm').addEventListener('submit', handleSaveOffer);

  // MODAL CLIENTES: Abrir / Cerrar / Guardar
  document.getElementById('btnOpenNewClientModal').addEventListener('click', openNewClientModal);
  document.getElementById('btnCloseClientEditModal').addEventListener('click', () => {
    document.getElementById('clientEditModal').classList.remove('active');
  });
  document.getElementById('clientEditForm').addEventListener('submit', handleSaveClient);

  // Configuración de API Google Sheets
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

// Función global para aplicar oferta al input de precio
window.aplicarOfertaAlCorte = function(valorPromo) {
  document.getElementById('posPrecioKg').value = valorPromo;
  calculatePosTotals();
};

// ====================================================================
// 5. GESTIÓN DEL CARRITO MULTI-CORTE (TICKET MULTI-ITEM)
// ====================================================================
function handleAddItemToCart() {
  const corteSelect = document.getElementById('posCorte');
  const kilosInput = document.getElementById('posKilos');
  const costoKgInput = document.getElementById('posCostoKg');
  const precioKgInput = document.getElementById('posPrecioKg');

  const corte = corteSelect.value;
  const kilos = parseFloat(kilosInput.value) || 0;
  const costoKg = parseFloat(costoKgInput.value) || 0;
  let precioKg = parseFloat(precioKgInput.value) || 0;

  if (!corte) {
    alert('Por favor selecciona un corte de carne.');
    return;
  }
  if (kilos <= 0) {
    alert('Ingresa los kilos válidos para este corte (ej: 2.350).');
    return;
  }
  if (precioKg <= 0) {
    const prod = AppState.productos.find(p => p.corte === corte);
    if (prod) precioKg = parseFloat(prod.precio_kg) || 0;
  }

  const subtotal = kilos * precioKg;
  const costoTotal = kilos * costoKg;
  const margenBruto = subtotal - costoTotal;

  AppState.posCart.push({
    id: 'ITM-' + Date.now().toString().slice(-4) + Math.floor(Math.random() * 100),
    corte: corte,
    kg_vendidos: kilos,
    costo_x_kg: costoKg,
    costo_total: costoTotal,
    precio_x_kg: precioKg,
    subtotal: subtotal,
    margen_bruto: margenBruto
  });

  // Limpiar campos de agregado
  corteSelect.value = '';
  kilosInput.value = '';
  costoKgInput.value = '';
  precioKgInput.value = '';
  document.getElementById('activeOfferBadge').style.display = 'none';

  renderPosCart();
  calculatePosTotals();
}

window.removeItemFromCart = function(index) {
  AppState.posCart.splice(index, 1);
  renderPosCart();
  calculatePosTotals();
};

function renderPosCart() {
  const container = document.getElementById('posCartContainer');
  const countBadge = document.getElementById('cartCountBadge');
  if (!container) return;

  countBadge.textContent = AppState.posCart.length;

  if (AppState.posCart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 12px; border: 1px dashed var(--border-color); border-radius: var(--radius-sm);">
        Todavía no agregaste ningún corte. Elige corte y kilos arriba y toca "➕ Agregar Este Corte al Ticket".
      </div>
    `;
    return;
  }

  container.innerHTML = AppState.posCart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-main">
        <div style="font-weight: 700; font-size: 0.95rem; color: #fff;">
          🥩 ${item.corte}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          ${item.kg_vendidos} Kg × ${formatMoney(item.precio_x_kg)}/Kg
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <strong style="color: var(--accent-green); font-size: 1rem;">
          ${formatMoney(item.subtotal)}
        </strong>
        <button type="button" class="btn-remove-item" onclick="removeItemFromCart(${idx})" title="Eliminar corte">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

// ====================================================================
// 6. CÁLCULO DE TOTALES EN VIVO (CON REGLA DE NEGOCIO HISTÓRICA)
// ====================================================================
function calculatePosTotals() {
  const fecha = document.getElementById('posFecha').value || new Date().toISOString().split('T')[0];
  const descuento = parseFloat(document.getElementById('posDescuento').value) || 0;
  const medioPago = document.getElementById('posMedioPago').value;

  let totalKilos = 0;
  let costoTotal = 0;
  let subtotalVenta = 0;

  // Si hay cortes en el carrito, calcular sobre el carrito
  if (AppState.posCart.length > 0) {
    AppState.posCart.forEach(it => {
      totalKilos += it.kg_vendidos;
      costoTotal += it.costo_total;
      subtotalVenta += it.subtotal;
    });
  } else {
    // Si todavía no agregó al carrito, calcular preview del corte en los inputs
    const kilos = parseFloat(document.getElementById('posKilos').value) || 0;
    const costoKg = parseFloat(document.getElementById('posCostoKg').value) || 0;
    const precioKg = parseFloat(document.getElementById('posPrecioKg').value) || 0;
    totalKilos = kilos;
    costoTotal = kilos * costoKg;
    subtotalVenta = kilos * precioKg;
  }

  const totalVenta = Math.max(0, subtotalVenta - descuento);
  const margenTotal = totalVenta - costoTotal;

  // REGLA HISTÓRICA DE GANANCIA:
  // Hasta 2026-06-22: 50% Compartida
  // Desde 2026-06-23: 100% Directa (Lucas sumó su ganancia al costo)
  let gananciaNeta = margenTotal;
  let splitLabel = 'Ganancia 100% Directa';

  if (fecha <= '2026-06-22') {
    gananciaNeta = margenTotal * 0.5;
    splitLabel = 'Ganancia 50% Compartida';
  }

  document.getElementById('liveTotalKilos').textContent = `${totalKilos.toFixed(2)} Kg`;
  document.getElementById('liveCostoTotal').textContent = formatMoney(costoTotal);
  document.getElementById('liveSubtotalVenta').textContent = formatMoney(subtotalVenta);
  document.getElementById('liveTotalVenta').textContent = formatMoney(totalVenta);
  document.getElementById('liveMargenTotal').textContent = formatMoney(gananciaNeta);
  document.getElementById('liveSplitText').textContent = splitLabel;

  // Manejo del cobro recibido
  let montoRecibido = 0;
  let cobroEfectivo = 0;
  let cobroDigital = 0;

  if (medioPago === 'Mixto') {
    cobroEfectivo = parseFloat(document.getElementById('posPagoEfectivo').value) || 0;
    cobroDigital = parseFloat(document.getElementById('posPagoDigital').value) || 0;
    montoRecibido = cobroEfectivo + cobroDigital;
  } else {
    const rawRecibido = parseFloat(document.getElementById('posMontoRecibido').value);
    montoRecibido = isNaN(rawRecibido) ? totalVenta : rawRecibido;
    if (medioPago === 'Efectivo') cobroEfectivo = montoRecibido;
    else cobroDigital = montoRecibido;
  }

  const saldoBox = document.getElementById('saldoDiferenciaBox');
  if (totalVenta > 0 && !isNaN(montoRecibido)) {
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

  return {
    totalKilos,
    costoTotal,
    subtotalVenta,
    descuento,
    totalVenta,
    margenTotal,
    gananciaNeta,
    montoRecibido,
    cobroEfectivo,
    cobroDigital,
    fecha,
    medioPago
  };
}

// ====================================================================
// 7. GUARDAR TICKET DE VENTA (OPCIÓN A: RELACIONAL EN GOOGLE SHEETS)
// ====================================================================
async function handleGuardarVenta(e) {
  e.preventDefault();

  // Si no hay cortes en el carrito pero los inputs tienen datos, auto-agregar
  if (AppState.posCart.length === 0) {
    const corteSelect = document.getElementById('posCorte');
    const kilosInput = document.getElementById('posKilos');
    if (corteSelect.value && parseFloat(kilosInput.value) > 0) {
      handleAddItemToCart();
    } else {
      alert('Por favor agrega al menos un corte al ticket antes de guardar.');
      return;
    }
  }

  const c = calculatePosTotals();
  if (c.totalKilos <= 0 || c.totalVenta <= 0) {
    alert('El ticket debe tener kilos y monto válidos.');
    return;
  }

  const clienteNombre = document.getElementById('posCliente').value.trim();
  if (!clienteNombre) {
    alert('Ingresa el nombre del cliente.');
    return;
  }

  const motivoDescuento = document.getElementById('posMotivoDescuento').value.trim();
  const saldoCliente = c.montoRecibido - c.totalVenta;
  const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mIdx = parseInt(c.fecha.split('-')[1], 10);
  const mes = meses[mIdx] || 'Noviembre';

  const idTicket = 'TCK-' + Date.now().toString().slice(-6);

  // Armar objeto del Ticket Consolidado
  const ticketData = {
    id_ticket: idTicket,
    fecha: c.fecha,
    mes: mes,
    cliente: clienteNombre,
    items: [...AppState.posCart],
    subtotal: c.subtotalVenta,
    descuento: c.descuento,
    motivo_descuento: motivoDescuento,
    total_venta: c.totalVenta,
    costo_total: c.costoTotal,
    ganancia_neta: c.gananciaNeta,
    medio_pago: c.medioPago,
    cobro_efectivo: c.cobroEfectivo,
    cobro_digital: c.cobroDigital,
    monto_recibido: c.montoRecibido,
    saldo_cliente: saldoCliente,
    estado_pago: saldoCliente >= 0 ? 'Pagó' : 'Saldo Pendiente',
    observaciones: motivoDescuento
  };

  // Guardar en AppState.ventas según la OPCIÓN A:
  // Una fila por cada corte compartiendo el ID_TICKET para análisis en tablas dinámicas
  AppState.posCart.forEach((item, idx) => {
    const itemDiscount = c.subtotalVenta > 0 ? (item.subtotal / c.subtotalVenta) * c.descuento : 0;
    const itemNeto = item.subtotal - itemDiscount - item.costo_total;
    const itemGanancia = c.fecha <= '2026-06-22' ? itemNeto * 0.5 : itemNeto;

    AppState.ventas.unshift({
      id: idTicket + '-' + (idx + 1),
      id_ticket: idTicket,
      fecha: c.fecha,
      mes: mes,
      cliente: clienteNombre,
      corte: item.corte,
      kg_vendidos: item.kg_vendidos,
      costo_x_kg: item.costo_x_kg,
      costo_total: item.costo_total,
      precio_x_kg: item.precio_x_kg,
      subtotal_venta: item.subtotal,
      descuento_ticket: c.descuento,
      total_ticket: c.totalVenta,
      total_venta: item.subtotal - itemDiscount,
      margen_bruto: item.subtotal - item.costo_total,
      ganancia_neta: itemGanancia,
      etapa_margen: c.fecha <= '2026-06-22' ? '50% Compartida' : '100% Directa',
      medio_pago: c.medioPago,
      cobro_efectivo: c.cobroEfectivo,
      cobro_digital: c.cobroDigital,
      monto_recibido: c.montoRecibido,
      saldo_cliente: saldoCliente,
      estado_pago: saldoCliente >= 0 ? 'Pagó' : 'Saldo Pendiente',
      observaciones: motivoDescuento
    });
  });

  AppState.lastSavedTicket = ticketData;

  // Actualizar saldos y guardar localmente
  calculateClientBalances();
  saveLocalData();
  renderDashboard();
  renderClientes();

  // Enviar a Google Sheets vía POST (Opción A)
  if (AppState.sheetsApiUrl) {
    updateStatusBadge('syncing');
    fetch(AppState.sheetsApiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nuevo_ticket_multicorte', ticket: ticketData })
    }).then(() => updateStatusBadge('connected')).catch(() => updateStatusBadge('offline'));
  }

  // Notificar al usuario y abrir Ticket
  alert(`¡Ticket #${idTicket} registrado con éxito!\nTotal: ${formatMoney(c.totalVenta)}\nCortes: ${AppState.posCart.length}\nGanancia Neta: ${formatMoney(c.gananciaNeta)}`);

  renderTicketModal(ticketData);
  document.getElementById('ticketModal').classList.add('active');

  // Resetear Carrito y Formulario
  AppState.posCart = [];
  renderPosCart();
  document.getElementById('posForm').reset();
  initDateDisplays();
  calculatePosTotals();
}

// ====================================================================
// 8. TICKET TÉRMICO / DIGITAL & COMPROBANTES DE WHATSAPP
// ====================================================================
function handleEnviarWhatsApp() {
  const clienteNombre = document.getElementById('posCliente').value.trim();
  const c = calculatePosTotals();

  // Si hay un ticket guardado recientemente, usarlo; si no, armar del actual
  let t = AppState.lastSavedTicket;
  if (!t || t.cliente.toLowerCase() !== clienteNombre.toLowerCase()) {
    if (AppState.posCart.length === 0 && (!clienteNombre || c.totalVenta <= 0)) {
      alert('Ingresa el cliente y agrega cortes al ticket antes de generar el comprobante.');
      return;
    }
    t = {
      id_ticket: 'TCK-' + Date.now().toString().slice(-4),
      cliente: clienteNombre,
      fecha: c.fecha,
      items: AppState.posCart.length > 0 ? AppState.posCart : [{
        corte: document.getElementById('posCorte').value || 'Carne',
        kg_vendidos: parseFloat(document.getElementById('posKilos').value) || 0,
        precio_x_kg: parseFloat(document.getElementById('posPrecioKg').value) || 0,
        subtotal: c.subtotalVenta
      }],
      subtotal: c.subtotalVenta,
      descuento: c.descuento,
      motivo_descuento: document.getElementById('posMotivoDescuento').value,
      total_venta: c.totalVenta,
      medio_pago: c.medioPago,
      cobro_efectivo: c.cobroEfectivo,
      cobro_digital: c.cobroDigital,
      monto_recibido: c.montoRecibido,
      saldo_cliente: c.montoRecibido - c.totalVenta
    };
  }

  let cliente = AppState.selectedClient;
  if (!cliente) {
    cliente = AppState.clientes.find(cl => cl.nombre && cl.nombre.toLowerCase() === t.cliente.toLowerCase());
  }

  const tel = cliente ? (cliente.telefono_whatsapp || cliente.telefono.replace(/\D/g, '')) : '';

  let saldoTxt = '✅ *Saldo:* Al día ($0)';
  if (t.saldo_cliente > 0) saldoTxt = `🟢 *Saldo a tu favor:* +${formatMoney(t.saldo_cliente)}`;
  if (t.saldo_cliente < 0) saldoTxt = `⚠️ *Saldo pendiente:* ${formatMoney(Math.abs(t.saldo_cliente))}`;

  let detalleItems = t.items.map(it => `  • ${it.kg_vendidos} Kg de ${it.corte} (${formatMoney(it.precio_x_kg)}/Kg) → *${formatMoney(it.subtotal)}*`).join('\n');

  let pagoDetalle = `${t.medio_pago}`;
  if (t.medio_pago === 'Mixto') {
    pagoDetalle = `Mixto (Efectivo: ${formatMoney(t.cobro_efectivo)} | Digital/MP: ${formatMoney(t.cobro_digital)})`;
  }

  let descTxt = '';
  if (t.descuento > 0) {
    descTxt = `\n🏷️ *Descuento Especial:* -${formatMoney(t.descuento)}${t.motivo_descuento ? ` (${t.motivo_descuento})` : ''}`;
  }

  const mensaje = 
`🥩 *CARNES PREMIUM*
----------------------------------------
👤 *Cliente:* ${t.cliente}
📅 *Fecha:* ${t.fecha}
🧾 *Ticket:* #${t.id_ticket}
🛒 *Detalle del Pedido:*
${detalleItems}
----------------------------------------
📦 *Kilos Totales:* ${t.items.reduce((acc, it) => acc + (it.kg_vendidos || 0), 0).toFixed(2)} Kg
💵 *Subtotal:* ${formatMoney(t.subtotal)}${descTxt}
💰 *TOTAL A ABONAR:* ${formatMoney(t.total_venta)}
💳 *Medio de Pago:* ${pagoDetalle}
💵 *Monto Abonado:* ${formatMoney(t.monto_recibido)}
${saldoTxt}
----------------------------------------
¡Muchas gracias por elegirnos! 🙏`;

  const encodedMsg = encodeURIComponent(mensaje);
  const waUrl = tel ? `https://wa.me/${tel}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;

  window.open(waUrl, '_blank');
}

function renderTicketModal(ticketData = null) {
  const t = ticketData || AppState.lastSavedTicket || {
    id_ticket: 'TCK-' + Date.now().toString().slice(-4),
    fecha: new Date().toLocaleDateString('es-AR'),
    cliente: document.getElementById('posCliente').value || 'Cliente',
    items: AppState.posCart,
    subtotal: calculatePosTotals().subtotalVenta,
    descuento: calculatePosTotals().descuento,
    total_venta: calculatePosTotals().totalVenta,
    medio_pago: document.getElementById('posMedioPago').value,
    monto_recibido: calculatePosTotals().montoRecibido,
    saldo_cliente: calculatePosTotals().montoRecibido - calculatePosTotals().totalVenta
  };

  document.getElementById('ticketFecha').textContent = `${t.fecha} — #${t.id_ticket}`;

  let itemsHtml = '';
  if (t.items && t.items.length > 0) {
    itemsHtml = t.items.map(it => `
      <div class="ticket-row" style="margin-top: 4px;">
        <span>${it.kg_vendidos} Kg x ${formatMoney(it.precio_x_kg)}</span>
        <strong>${formatMoney(it.subtotal)}</strong>
      </div>
      <div style="font-size: 0.78rem; color: #555; margin-bottom: 4px;">${it.corte}</div>
    `).join('');
  } else {
    itemsHtml = `<div class="ticket-row"><span>Corte de Carne</span><strong>${formatMoney(t.total_venta)}</strong></div>`;
  }

  const body = document.getElementById('ticketBody');
  body.innerHTML = `
    <div class="ticket-row"><span>CLIENTE:</span> <strong>${t.cliente}</strong></div>
    <div class="ticket-row"><span>MEDIO PAGO:</span> <span>${t.medio_pago}</span></div>
    <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>
    ${itemsHtml}
    <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>
    <div class="ticket-row"><span>SUBTOTAL:</span> <span>${formatMoney(t.subtotal || t.total_venta)}</span></div>
    ${t.descuento > 0 ? `<div class="ticket-row" style="color: #b91c1c;"><span>DESCUENTO:</span> <span>-${formatMoney(t.descuento)}</span></div>` : ''}
    <div class="ticket-total ticket-row">
      <span>TOTAL:</span>
      <span>${formatMoney(t.total_venta)}</span>
    </div>
    <div class="ticket-row"><span>ABONADO:</span> <span>${formatMoney(t.monto_recibido)}</span></div>
    <div class="ticket-row">
      <span>SALDO:</span>
      <span>${t.saldo_cliente === 0 ? '$ 0 (Al día)' : (t.saldo_cliente > 0 ? `+${formatMoney(t.saldo_cliente)} a favor` : `${formatMoney(t.saldo_cliente)} pendiente`)}</span>
    </div>
  `;
}

// ====================================================================
// 9. GESTIÓN DE PEDIDOS PROGRAMADOS / PREVENTA (SIN ANTICIPO)
// ====================================================================
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
    estado: 'Pendiente', // No requiere adelanto ni seña
    notas: notas,
    telefono: tel
  };

  AppState.pedidos.unshift(nuevoPedido);
  saveLocalData();
  renderPedidos();

  // Sincronizar pedido con Google Sheets
  if (AppState.sheetsApiUrl) {
    fetch(AppState.sheetsApiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nuevo_pedido', pedido: nuevoPedido })
    }).catch(console.error);
  }

  alert(`¡Pedido agendado para ${cliente} el ${fechaEntrega}!`);
  document.getElementById('orderForm').reset();
  initDateDisplays();
}

function renderPedidos() {
  const container = document.getElementById('pedidosList');
  const countBadge = document.getElementById('pedidosCountBadge');
  const frigoContainer = document.getElementById('frigoCutsContainer');
  if (!container) return;

  const searchQuery = (document.getElementById('searchPedidoInput')?.value || '').toLowerCase().trim();
  const estadoFilter = document.getElementById('filterPedidoEstado')?.value || 'pendientes';

  // Consolidado para frigorífico: siempre sobre los pedidos pendientes de entrega
  const activeOrders = AppState.pedidos.filter(p => p.estado !== 'Entregado');
  const cutsTally = {};
  let totalKilosFrigo = 0;

  activeOrders.forEach(p => {
    cutsTally[p.corte] = (cutsTally[p.corte] || 0) + (p.kg_estimados || 0);
    totalKilosFrigo += (p.kg_estimados || 0);
  });

  if (frigoContainer) {
    if (Object.keys(cutsTally).length === 0) {
      frigoContainer.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-muted);">No hay pedidos pendientes para encargar esta semana.</span>';
    } else {
      frigoContainer.innerHTML = Object.entries(cutsTally)
        .map(([corte, kg]) => `<div class="frigo-cut-tag">🥩 ${corte}: <strong>${kg.toFixed(2)} Kg</strong></div>`)
        .join('') + `<div class="frigo-cut-tag" style="background: rgba(16, 185, 129, 0.2); border-color: var(--accent-green);">TOTAL: <strong>${totalKilosFrigo.toFixed(2)} Kg</strong></div>`;
    }
  }

  // Filtrado de la lista de pedidos
  let filtered = AppState.pedidos;
  if (estadoFilter === 'pendientes') {
    filtered = filtered.filter(p => p.estado !== 'Entregado');
  } else if (estadoFilter === 'entregados') {
    filtered = filtered.filter(p => p.estado === 'Entregado');
  }

  if (searchQuery) {
    filtered = filtered.filter(p =>
      (p.cliente && p.cliente.toLowerCase().includes(searchQuery)) ||
      (p.corte && p.corte.toLowerCase().includes(searchQuery)) ||
      (p.notas && p.notas.toLowerCase().includes(searchQuery)) ||
      (p.telefono && String(p.telefono).includes(searchQuery)) ||
      (p.id && String(p.id).toLowerCase().includes(searchQuery))
    );
  }

  if (countBadge) countBadge.textContent = `${filtered.length} Pedidos`;

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No se encontraron pedidos con los filtros seleccionados.</div>';
    return;
  }

  filtered.forEach(p => {
    const item = document.createElement('div');
    item.className = 'list-item';

    let badgeClass = 'badge-yellow';
    if (p.estado === 'Para Armar') badgeClass = 'badge-blue';
    if (p.estado === 'En Reparto') badgeClass = 'badge-purple';
    if (p.estado === 'Entregado') badgeClass = 'badge-green';

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title">
          ${p.cliente} <span class="badge ${badgeClass}" style="margin-left: 6px;">${p.estado}</span>
        </div>
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
            📲 WA
          </a>
        ` : ''}
        <button type="button" class="btn-icon" onclick="openEditOrderModal('${p.id}')" title="Editar / Corregir pedido">
          ✏️
        </button>
        <button type="button" class="btn-icon danger" onclick="deletePedido('${p.id}')" title="Eliminar pedido">
          🗑️
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

// Modal Editar Pedido
window.openEditOrderModal = function(orderId) {
  const p = AppState.pedidos.find(x => String(x.id) === String(orderId));
  if (!p) return;

  populateProductSelects();
  document.getElementById('editOrderId').value = p.id;
  document.getElementById('editOrderCliente').value = p.cliente;
  document.getElementById('editOrderFechaEntrega').value = p.fecha_entrega;
  document.getElementById('editOrderCorte').value = p.corte;
  document.getElementById('editOrderKilos').value = p.kg_estimados;
  document.getElementById('editOrderEstado').value = p.estado || 'Pendiente';
  document.getElementById('editOrderTelefono').value = p.telefono || '';
  document.getElementById('editOrderNotas').value = p.notas || '';

  document.getElementById('orderEditModal').classList.add('active');
};

function handleSaveOrderEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editOrderId').value;
  const p = AppState.pedidos.find(x => String(x.id) === String(id));
  if (!p) return;

  p.cliente = document.getElementById('editOrderCliente').value.trim();
  p.fecha_entrega = document.getElementById('editOrderFechaEntrega').value;
  p.corte = document.getElementById('editOrderCorte').value;
  p.kg_estimados = parseFloat(document.getElementById('editOrderKilos').value) || 0;
  p.estado = document.getElementById('editOrderEstado').value;
  p.telefono = document.getElementById('editOrderTelefono').value.trim();
  p.notas = document.getElementById('editOrderNotas').value.trim();

  saveLocalData();
  renderPedidos();
  document.getElementById('orderEditModal').classList.remove('active');
  alert(`¡Pedido de ${p.cliente} actualizado con éxito!`);
}

function handleDeleteOrderFromModal() {
  const id = document.getElementById('editOrderId').value;
  if (!id) return;
  deletePedido(id);
  document.getElementById('orderEditModal').classList.remove('active');
}

window.deletePedido = function(orderId) {
  const p = AppState.pedidos.find(x => String(x.id) === String(orderId));
  if (!p) return;

  if (confirm(`¿Estás seguro de eliminar el pedido de ${p.cliente} (${p.corte})?`)) {
    AppState.pedidos = AppState.pedidos.filter(x => String(x.id) !== String(orderId));
    saveLocalData();
    renderPedidos();
    alert('Pedido eliminado correctamente.');
  }
};

// Convertir pedido futuro en venta en POS
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

  document.getElementById('posCliente').dispatchEvent(new Event('input'));
  calculatePosTotals();

  // Marcar pedido como Entregado
  p.estado = 'Entregado';
  saveLocalData();
  renderPedidos();
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

// ====================================================================
// 10. CRUD CORTES & CATÁLOGO DE PRECIOS
// ====================================================================
function renderCortesCatalog() {
  const container = document.getElementById('cutsCatalogList');
  const countBadge = document.getElementById('cutsCountBadge');
  if (!container) return;

  if (countBadge) countBadge.textContent = `${AppState.productos.length} Cortes`;
  container.innerHTML = '';

  AppState.productos.forEach(c => {
    const item = document.createElement('div');
    item.className = 'list-item';

    const costo = Number(c.costo_kg) || 0;
    const precio = Number(c.precio_kg) || 0;
    const ganancia = precio - costo;

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title" style="font-size: 1rem;">🥩 ${c.corte}</div>
        <div class="item-desc">
          Costo: <strong>${formatMoney(costo)}/Kg</strong> | Venta: <strong style="color: var(--accent-green);">${formatMoney(precio)}/Kg</strong>
        </div>
        <div style="font-size: 0.75rem; color: var(--accent-blue); margin-top: 2px;">
          Margen: +${formatMoney(ganancia)}/Kg ${c.notas ? `• 📌 ${c.notas}` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button type="button" class="btn-icon" onclick="openEditCutModal('${c.id || c.corte}')" title="Editar precio o costo">
          ✏️
        </button>
        <button type="button" class="btn-icon danger" onclick="deleteCut('${c.id || c.corte}')" title="Eliminar corte">
          🗑️
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

function openNewCutModal() {
  document.getElementById('cutModalTitle').textContent = 'Nuevo Corte de Carne';
  document.getElementById('editCutId').value = '';
  document.getElementById('cutName').value = '';
  document.getElementById('cutCost').value = '';
  document.getElementById('cutPrice').value = '';
  document.getElementById('cutNotes').value = '';
  document.getElementById('cutModal').classList.add('active');
}

window.openEditCutModal = function(cutId) {
  const cut = AppState.productos.find(p => (p.id && String(p.id) === String(cutId)) || p.corte === cutId);
  if (!cut) return;

  document.getElementById('cutModalTitle').textContent = 'Editar Corte de Carne';
  document.getElementById('editCutId').value = cut.id || cut.corte;
  document.getElementById('cutName').value = cut.corte;
  document.getElementById('cutCost').value = cut.costo_kg;
  document.getElementById('cutPrice').value = cut.precio_kg;
  document.getElementById('cutNotes').value = cut.notas || '';

  document.getElementById('cutModal').classList.add('active');
};

function handleSaveCut(e) {
  e.preventDefault();
  const id = document.getElementById('editCutId').value;
  const name = document.getElementById('cutName').value.trim();
  const cost = parseFloat(document.getElementById('cutCost').value) || 0;
  const price = parseFloat(document.getElementById('cutPrice').value) || 0;
  const notes = document.getElementById('cutNotes').value.trim();

  if (!name || cost <= 0 || price <= 0) {
    alert('Ingresa el nombre, costo y precio de venta válidos.');
    return;
  }

  let cutObj;
  if (id) {
    cutObj = AppState.productos.find(p => (p.id && String(p.id) === String(id)) || p.corte === id);
    if (cutObj) {
      cutObj.corte = name;
      cutObj.costo_kg = cost;
      cutObj.precio_kg = price;
      cutObj.ganancia_kg = price - cost;
      cutObj.notas = notes;
    }
  } else {
    cutObj = {
      id: String(Date.now()),
      corte: name,
      costo_kg: cost,
      precio_kg: price,
      ganancia_kg: price - cost,
      notas: notes
    };
    AppState.productos.push(cutObj);
  }

  saveLocalData();
  populateProductSelects();
  renderCortesCatalog();
  document.getElementById('cutModal').classList.remove('active');

  // Sincronizar corte con Google Sheets
  if (AppState.sheetsApiUrl) {
    fetch(AppState.sheetsApiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'guardar_corte', corte: cutObj })
    }).catch(console.error);
  }

  alert(`¡Corte "${name}" guardado correctamente!`);
}

window.deleteCut = function(cutId) {
  const cut = AppState.productos.find(p => (p.id && String(p.id) === String(cutId)) || p.corte === cutId);
  if (!cut) return;

  if (confirm(`¿Estás seguro de eliminar el corte "${cut.corte}" del catálogo?`)) {
    AppState.productos = AppState.productos.filter(p => p !== cut);
    saveLocalData();
    populateProductSelects();
    renderCortesCatalog();
  }
};

// ====================================================================
// 11. CRUD OFERTAS & PROMOCIONES
// ====================================================================
function renderOffersList() {
  const container = document.getElementById('offersList');
  const countBadge = document.getElementById('offersCountBadge');
  if (!container) return;

  if (countBadge) countBadge.textContent = `${AppState.ofertas.length} Ofertas`;
  container.innerHTML = '';

  if (AppState.ofertas.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px; text-align: center;">No hay ofertas configuradas. Crea una nueva con el botón superior.</div>';
    return;
  }

  AppState.ofertas.forEach(o => {
    const item = document.createElement('div');
    item.className = 'list-item';

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title" style="color: var(--accent-amber);">
          🔥 ${o.nombre} <span class="badge ${o.activa ? 'badge-green' : 'badge-yellow'}" style="margin-left: 6px;">${o.activa ? 'Activa' : 'Pausada'}</span>
        </div>
        <div class="item-desc">
          🥩 Corte: <strong>${o.corte}</strong> | Precio Promo: <strong style="color: #fff;">${formatMoney(o.valor)}/Kg</strong>
        </div>
        ${o.descripcion ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">📌 ${o.descripcion}</div>` : ''}
      </div>
      <div class="item-actions">
        <button type="button" class="btn btn-sm ${o.activa ? 'btn-secondary' : 'btn-primary'}" onclick="toggleOffer('${o.id}')">
          ${o.activa ? 'Pausar' : 'Activar'}
        </button>
        <button type="button" class="btn-icon" onclick="openEditOfferModal('${o.id}')" title="Editar oferta">
          ✏️
        </button>
        <button type="button" class="btn-icon danger" onclick="deleteOffer('${o.id}')" title="Eliminar oferta">
          🗑️
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

function openNewOfferModal() {
  populateProductSelects();
  document.getElementById('offerModalTitle').textContent = 'Crear Oferta Especial';
  document.getElementById('editOfferId').value = '';
  document.getElementById('offerName').value = '';
  document.getElementById('offerCut').value = '';
  document.getElementById('offerValue').value = '';
  document.getElementById('offerDesc').value = '';
  document.getElementById('offerModal').classList.add('active');
}

window.openEditOfferModal = function(offerId) {
  const o = AppState.ofertas.find(x => x.id === offerId);
  if (!o) return;

  populateProductSelects();
  document.getElementById('offerModalTitle').textContent = 'Editar Oferta Especial';
  document.getElementById('editOfferId').value = o.id;
  document.getElementById('offerName').value = o.nombre;
  document.getElementById('offerCut').value = o.corte;
  document.getElementById('offerValue').value = o.valor;
  document.getElementById('offerDesc').value = o.descripcion || '';
  document.getElementById('offerModal').classList.add('active');
};

function handleSaveOffer(e) {
  e.preventDefault();
  const id = document.getElementById('editOfferId').value;
  const name = document.getElementById('offerName').value.trim();
  const cut = document.getElementById('offerCut').value;
  const value = parseFloat(document.getElementById('offerValue').value) || 0;
  const desc = document.getElementById('offerDesc').value.trim();

  if (!name || !cut || value <= 0) {
    alert('Completa los campos requeridos de la oferta.');
    return;
  }

  if (id) {
    const o = AppState.ofertas.find(x => x.id === id);
    if (o) {
      o.nombre = name;
      o.corte = cut;
      o.valor = value;
      o.descripcion = desc;
    }
  } else {
    AppState.ofertas.push({
      id: 'OF-' + Date.now().toString().slice(-4),
      nombre: name,
      corte: cut,
      tipo: 'precio_fijo',
      valor: value,
      descripcion: desc,
      activa: true
    });
  }

  saveLocalData();
  renderOffersList();
  document.getElementById('offerModal').classList.remove('active');
  alert(`¡Oferta "${name}" guardada!`);
}

window.toggleOffer = function(offerId) {
  const o = AppState.ofertas.find(x => x.id === offerId);
  if (!o) return;
  o.activa = !o.activa;
  saveLocalData();
  renderOffersList();
};

window.deleteOffer = function(offerId) {
  if (confirm('¿Deseas eliminar esta oferta?')) {
    AppState.ofertas = AppState.ofertas.filter(x => x.id !== offerId);
    saveLocalData();
    renderOffersList();
  }
};

// ====================================================================
// 12. CRUD CLIENTES & FICHA 360°
// ====================================================================
function renderClientes(query = '') {
  const container = document.getElementById('clientesList');
  const countBadge = document.getElementById('clientesCountBadge');
  if (!container) return;

  const q = query.toLowerCase().trim();
  const filtered = AppState.clientes.filter(c => 
    (c.nombre && c.nombre.toLowerCase().includes(q)) || 
    (c.telefono && String(c.telefono).includes(q)) ||
    (c.domicilio && c.domicilio.toLowerCase().includes(q))
  );

  if (countBadge) countBadge.textContent = `${filtered.length} Clientes`;
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
        <button type="button" class="btn-icon" onclick="openEditClientModal('${c.id || c.nombre.replace(/'/g, "\\'")}')" title="Editar cliente">
          ✏️
        </button>
        <button type="button" class="btn-icon danger" onclick="deleteClient('${c.id || c.nombre.replace(/'/g, "\\'")}')" title="Eliminar cliente">
          🗑️
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

function openNewClientModal() {
  document.getElementById('clientEditModalTitle').textContent = 'Nuevo Cliente';
  document.getElementById('editClientId').value = '';
  document.getElementById('clientEditName').value = '';
  document.getElementById('clientEditPhone').value = '';
  document.getElementById('clientEditAddress').value = '';
  document.getElementById('clientEditNotes').value = '';
  document.getElementById('clientEditModal').classList.add('active');
}

window.openEditClientModal = function(clientId) {
  const c = AppState.clientes.find(x => (x.id && String(x.id) === String(clientId)) || x.nombre === clientId);
  if (!c) return;

  document.getElementById('clientEditModalTitle').textContent = 'Editar Cliente';
  document.getElementById('editClientId').value = c.id || c.nombre;
  document.getElementById('clientEditName').value = c.nombre;
  document.getElementById('clientEditPhone').value = c.telefono;
  document.getElementById('clientEditAddress').value = c.domicilio;
  document.getElementById('clientEditNotes').value = c.notas;

  document.getElementById('clientEditModal').classList.add('active');
};

function handleSaveClient(e) {
  e.preventDefault();
  const id = document.getElementById('editClientId').value;
  const name = document.getElementById('clientEditName').value.trim();
  const phone = document.getElementById('clientEditPhone').value.trim();
  const address = document.getElementById('clientEditAddress').value.trim();
  const notes = document.getElementById('clientEditNotes').value.trim();

  if (!name) {
    alert('Ingresa el nombre del cliente.');
    return;
  }

  const cleanTel = phone.replace(/[^0-9]/g, '');
  let clientObj;

  if (id) {
    clientObj = AppState.clientes.find(x => (x.id && String(x.id) === String(id)) || x.nombre === id);
    if (clientObj) {
      clientObj.nombre = name;
      clientObj.telefono = phone;
      clientObj.telefono_whatsapp = cleanTel;
      clientObj.domicilio = address;
      clientObj.notas = notes;
    }
  } else {
    clientObj = {
      id: String(Date.now()),
      nombre: name,
      telefono: phone,
      telefono_whatsapp: cleanTel,
      domicilio: address,
      notas: notes,
      saldo: 0
    };
    AppState.clientes.push(clientObj);
  }

  saveLocalData();
  populateClientDatalists();
  renderClientes();
  document.getElementById('clientEditModal').classList.remove('active');

  // Sincronizar cliente con Google Sheets
  if (AppState.sheetsApiUrl) {
    fetch(AppState.sheetsApiUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'guardar_cliente', cliente: clientObj })
    }).catch(console.error);
  }

  alert(`¡Cliente "${name}" guardado!`);
}

window.deleteClient = function(clientId) {
  const c = AppState.clientes.find(x => (x.id && String(x.id) === String(clientId)) || x.nombre === clientId);
  if (!c) return;

  if (confirm(`¿Estás seguro de eliminar a ${c.nombre} del directorio de clientes?`)) {
    AppState.clientes = AppState.clientes.filter(x => x !== c);
    saveLocalData();
    populateClientDatalists();
    renderClientes();
  }
};

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
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong style="color: var(--accent-green); font-size: 0.9rem;">${formatMoney(v.total_venta)}</strong>
          <button type="button" class="btn-icon" onclick="event.stopPropagation(); verTicketHistorico('${v.id_ticket || v.id}')" title="Ver comprobante">📄</button>
          <button type="button" class="btn-icon" onclick="event.stopPropagation(); document.getElementById('clientModal').classList.remove('active'); openEditSaleModal('${v.id}')" title="Editar venta">✏️</button>
        </div>
      `;
      historyList.appendChild(row);
    });
  }

  document.getElementById('clientModal').classList.add('active');
};

// ====================================================================
// 13. CUENTA CORRIENTE PROVEEDOR (CONCILIACIÓN)
// ====================================================================
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

// ====================================================================
// 14. DASHBOARD, MÉTRICAS & CHART.JS
// ====================================================================
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

  // Filtros de búsqueda y estado de cobro para el listado histórico
  const searchVentaQuery = (document.getElementById('searchVentaInput')?.value || '').toLowerCase().trim();
  const filterPago = document.getElementById('filterVentaPago')?.value || 'todos';

  let listFiltered = filtered;

  if (filterPago === 'pagados') {
    listFiltered = listFiltered.filter(v => (v.saldo_cliente || 0) === 0);
  } else if (filterPago === 'pendientes') {
    listFiltered = listFiltered.filter(v => (v.saldo_cliente || 0) < 0);
  } else if (filterPago === 'favor') {
    listFiltered = listFiltered.filter(v => (v.saldo_cliente || 0) > 0);
  }

  if (searchVentaQuery) {
    listFiltered = listFiltered.filter(v =>
      (v.cliente && v.cliente.toLowerCase().includes(searchVentaQuery)) ||
      (v.id_ticket && v.id_ticket.toLowerCase().includes(searchVentaQuery)) ||
      (v.id && String(v.id).toLowerCase().includes(searchVentaQuery)) ||
      (v.corte && v.corte.toLowerCase().includes(searchVentaQuery)) ||
      (v.medio_pago && v.medio_pago.toLowerCase().includes(searchVentaQuery)) ||
      (v.observaciones && v.observaciones.toLowerCase().includes(searchVentaQuery))
    );
  }

  // Render lista de ventas
  document.getElementById('ventasFiltradasBadge').textContent = `${listFiltered.length} ventas`;
  const container = document.getElementById('dashboardVentasList');
  container.innerHTML = '';

  if (listFiltered.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 16px; text-align: center;">No se encontraron registros con los filtros seleccionados.</div>';
    calculateProjectionSimulator();
    return;
  }

  listFiltered.slice(0, 70).forEach(v => {
    const item = document.createElement('div');
    item.className = 'list-item';

    let saldoBadge = '';
    const saldo = Number(v.saldo_cliente) || 0;
    if (saldo < 0) {
      saldoBadge = `<span class="badge badge-red">Debe ${formatMoney(Math.abs(saldo))}</span>`;
    } else if (saldo > 0) {
      saldoBadge = `<span class="badge badge-green">+${formatMoney(saldo)} a favor</span>`;
    } else {
      saldoBadge = `<span class="badge badge-green">Pagó exacto</span>`;
    }

    const ticketId = v.id_ticket || v.id || '';

    item.innerHTML = `
      <div class="item-main">
        <div class="item-title">
          ${v.cliente} <span style="font-size: 0.75rem; color: var(--accent-blue); font-weight: normal;">#${ticketId}</span>
        </div>
        <div class="item-desc">
          ${v.fecha} | ${v.corte ? v.corte + ' • ' : ''}${v.kg_vendidos ? v.kg_vendidos + ' Kg • ' : ''}${v.medio_pago || 'MP'}
        </div>
        ${v.observaciones ? `<div style="font-size: 0.75rem; color: var(--accent-amber); margin-top: 2px;">📌 ${v.observaciones}</div>` : ''}
      </div>
      <div class="item-actions" style="flex-direction: column; align-items: flex-end; gap: 4px;">
        <div style="display: flex; gap: 6px; align-items: center;">
          ${saldoBadge}
          <strong style="color: var(--accent-green); font-size: 1rem;">${formatMoney(v.total_venta || (v.kg_vendidos * v.precio_x_kg))}</strong>
        </div>
        <div style="display: flex; gap: 4px; margin-top: 2px;">
          <button type="button" class="btn-icon" onclick="verTicketHistorico('${ticketId}')" title="Ver / Imprimir Comprobante">
            📄
          </button>
          <button type="button" class="btn-icon" onclick="reenviarWhatsAppVenta('${ticketId}')" title="Enviar comprobante por WhatsApp">
            📲
          </button>
          <button type="button" class="btn-icon" onclick="openEditSaleModal('${v.id}')" title="Editar / Corregir venta">
            ✏️
          </button>
          <button type="button" class="btn-icon danger" onclick="deleteVenta('${v.id}')" title="Eliminar registro">
            🗑️
          </button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });

  calculateProjectionSimulator();
}

// Modal Editar / Corregir Venta
window.openEditSaleModal = function(saleId) {
  const v = AppState.ventas.find(x => String(x.id) === String(saleId));
  if (!v) return;

  populateProductSelects();
  document.getElementById('editSaleId').value = v.id;
  document.getElementById('editSaleTicketLabel').textContent = '#' + (v.id_ticket || v.id);
  document.getElementById('editSaleFecha').value = v.fecha;
  document.getElementById('editSaleCliente').value = v.cliente;
  document.getElementById('editSaleCorte').value = v.corte || '';
  document.getElementById('editSaleKilos').value = v.kg_vendidos || 0;
  document.getElementById('editSaleCostoKg').value = v.costo_x_kg || 0;
  document.getElementById('editSalePrecioKg').value = v.precio_x_kg || 0;
  document.getElementById('editSaleMedioPago').value = v.medio_pago || 'MercadoPago';
  document.getElementById('editSaleRecibido').value = v.monto_recibido || v.total_venta || 0;
  document.getElementById('editSaleObs').value = v.observaciones || '';

  document.getElementById('saleEditModal').classList.add('active');
};

function handleSaveSaleEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editSaleId').value;
  const v = AppState.ventas.find(x => String(x.id) === String(id));
  if (!v) return;

  const fecha = document.getElementById('editSaleFecha').value;
  const cliente = document.getElementById('editSaleCliente').value.trim();
  const corte = document.getElementById('editSaleCorte').value;
  const kilos = parseFloat(document.getElementById('editSaleKilos').value) || 0;
  const costoKg = parseFloat(document.getElementById('editSaleCostoKg').value) || 0;
  const precioKg = parseFloat(document.getElementById('editSalePrecioKg').value) || 0;
  const medioPago = document.getElementById('editSaleMedioPago').value;
  const montoRecibido = parseFloat(document.getElementById('editSaleRecibido').value) || 0;
  const obs = document.getElementById('editSaleObs').value.trim();

  const meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mIdx = parseInt(fecha.split('-')[1], 10);
  const mes = meses[mIdx] || v.mes;

  const subtotal = kilos * precioKg;
  const costoTotal = kilos * costoKg;
  const totalVenta = subtotal;
  const margenTotal = totalVenta - costoTotal;

  // Regla de ganancia histórica
  let gananciaNeta = margenTotal;
  if (fecha <= '2026-06-22') {
    gananciaNeta = margenTotal * 0.5;
  }

  const saldoCliente = montoRecibido - totalVenta;

  v.fecha = fecha;
  v.mes = mes;
  v.cliente = cliente;
  v.corte = corte;
  v.kg_vendidos = kilos;
  v.costo_x_kg = costoKg;
  v.costo_total = costoTotal;
  v.precio_x_kg = precioKg;
  v.subtotal_venta = subtotal;
  v.total_venta = totalVenta;
  v.margen_bruto = margenTotal;
  v.ganancia_neta = gananciaNeta;
  v.etapa_margen = fecha <= '2026-06-22' ? '50% Compartida' : '100% Directa';
  v.medio_pago = medioPago;
  v.monto_recibido = montoRecibido;
  v.saldo_cliente = saldoCliente;
  v.estado_pago = saldoCliente >= 0 ? 'Pagó' : 'Saldo Pendiente';
  v.observaciones = obs;

  calculateClientBalances();
  saveLocalData();
  renderDashboard();
  renderClientes();
  document.getElementById('saleEditModal').classList.remove('active');
  alert(`¡Venta #${v.id} corregida con éxito!`);
}

function handleDeleteSaleFromModal() {
  const id = document.getElementById('editSaleId').value;
  if (!id) return;
  deleteVenta(id);
  document.getElementById('saleEditModal').classList.remove('active');
}

window.deleteVenta = function(saleId) {
  const v = AppState.ventas.find(x => String(x.id) === String(saleId));
  if (!v) return;

  const ticketId = v.id_ticket || v.id;
  const itemsEnTicket = AppState.ventas.filter(x => (x.id_ticket && x.id_ticket === ticketId) || String(x.id) === String(ticketId));

  let confirmMsg = `¿Estás seguro de eliminar este registro de venta (${v.cliente} — ${v.corte})?`;
  if (itemsEnTicket.length > 1) {
    confirmMsg = `Este corte pertenece al Ticket #${ticketId} que tiene ${itemsEnTicket.length} cortes.\n¿Deseas eliminar este registro de venta?`;
  }

  if (confirm(confirmMsg)) {
    AppState.ventas = AppState.ventas.filter(x => String(x.id) !== String(saleId));
    calculateClientBalances();
    saveLocalData();
    renderDashboard();
    renderClientes();
    alert('Venta eliminada. Se recalcularon los saldos del cliente y métricas.');
  }
};

window.verTicketHistorico = function(idTicket) {
  const matching = AppState.ventas.filter(v => (v.id_ticket && v.id_ticket === idTicket) || String(v.id) === String(idTicket));
  if (matching.length === 0) return;

  const first = matching[0];
  const items = matching.map(m => ({
    corte: m.corte,
    kg_vendidos: m.kg_vendidos,
    precio_x_kg: m.precio_x_kg,
    subtotal: m.total_venta || (m.kg_vendidos * m.precio_x_kg)
  }));

  const subtotal = matching.reduce((acc, m) => acc + (m.total_venta || 0), 0);
  const total = first.total_ticket || subtotal;
  const recibido = first.monto_recibido || total;

  const ticketData = {
    id_ticket: first.id_ticket || first.id,
    fecha: first.fecha,
    cliente: first.cliente,
    items: items,
    subtotal: subtotal,
    descuento: first.descuento_ticket || 0,
    motivo_descuento: first.observaciones || '',
    total_venta: total,
    medio_pago: first.medio_pago,
    monto_recibido: recibido,
    saldo_cliente: first.saldo_cliente || (recibido - total)
  };

  AppState.lastSavedTicket = ticketData;
  renderTicketModal(ticketData);
  document.getElementById('ticketModal').classList.add('active');
};

window.reenviarWhatsAppVenta = function(idTicket) {
  window.verTicketHistorico(idTicket);
  handleEnviarWhatsApp();
};

function calculateProjectionSimulator() {
  const metaGanancia = parseFloat(document.getElementById('inputMetaGanancia').value) || 1500000;

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

// ====================================================================
// 15. AUTO-SYNC & ESTADO DE CONEXIÓN
// ====================================================================
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
      if (json.data.ofertas && json.data.ofertas.length > 0) {
        AppState.ofertas = json.data.ofertas;
      }

      calculateClientBalances();
      saveLocalData();
      populateProductSelects();
      populateClientDatalists();
      renderDashboard();
      renderPedidos();
      renderCortesCatalog();
      renderOffersList();
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
    proveedor: AppState.proveedor,
    ofertas: AppState.ofertas
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `carnespremium_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
