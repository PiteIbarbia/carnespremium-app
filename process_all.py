# -*- coding: utf-8 -*-
import csv
import json
import re
import os

# Clean Lucas data
lucas_records = []
with open('raw_lucas.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    lid = 1
    for row in reader:
        if not row or not row[0].strip() or not row[0].startswith('2026'):
            continue
        fecha = row[0].strip()
        concepto = row[1].strip() if len(row) > 1 else ""
        medio = row[2].strip() if len(row) > 2 else ""
        pago = float(row[3].strip() or 0) if len(row) > 3 else 0.0
        costo = float(row[4].strip() or 0) if len(row) > 4 else 0.0
        saldo = float(row[5].strip() or 0) if len(row) > 5 else 0.0
        notas = row[6].strip() if len(row) > 6 else ""
        if len(row) > 7 and row[7].strip():
            notas += " " + row[7].strip()
        if len(row) > 8 and row[8].strip():
            notas += " " + row[8].strip()

        lucas_records.append({
            "id": lid,
            "fecha": fecha,
            "concepto": concepto,
            "medio_pago": medio,
            "pago_a_lucas": pago,
            "costo_carne": costo,
            "saldo": saldo,
            "notas": notas.strip()
        })
        lid += 1

with open('database/lucas.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=["id", "fecha", "concepto", "medio_pago", "pago_a_lucas", "costo_carne", "saldo", "notas"])
    writer.writeheader()
    writer.writerows(lucas_records)

print(f"Lucas registros: {len(lucas_records)}")

# Also save JSON copies in database/ for the Web App to consume immediately
with open('database/productos.json', 'w', encoding='utf-8') as f:
    with open('database/productos.csv', 'r', encoding='utf-8') as cf:
        json.dump(list(csv.DictReader(cf)), f, indent=2, ensure_ascii=False)

with open('database/clientes.json', 'w', encoding='utf-8') as f:
    with open('database/clientes.csv', 'r', encoding='utf-8') as cf:
        json.dump(list(csv.DictReader(cf)), f, indent=2, ensure_ascii=False)

with open('database/lucas.json', 'w', encoding='utf-8') as f:
    json.dump(lucas_records, f, indent=2, ensure_ascii=False)

# Parse client payment logs from raw_pagos.csv
ventas_list = []
with open('raw_pagos.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)
    vid = 1
    for row in reader:
        if not row or not row[0].strip() or not (row[0].startswith('2025') or row[0].startswith('2026')):
            continue
        fecha = row[0].strip()
        cliente = row[1].strip() if len(row) > 1 else ""
        medio = row[2].strip() if len(row) > 2 else "MercadoPago"
        cobro = float(row[3].strip() or 0) if len(row) > 3 else 0.0
        venta = float(row[4].strip() or 0) if len(row) > 4 else 0.0
        saldo = float(row[5].strip() or 0) if len(row) > 5 else 0.0
        
        # Calculate month
        parts = fecha.split('-')
        meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        m_idx = int(parts[1]) if len(parts) > 1 else 1
        mes = meses[m_idx]

        ventas_list.append({
            "id": vid,
            "fecha": fecha,
            "mes": mes,
            "cliente": cliente,
            "medio_pago": medio,
            "monto_recibido": cobro,
            "total_venta": venta,
            "saldo_cliente": saldo,
            "estado_pago": "Pagó" if saldo >= 0 else "Saldo Pendiente",
            "observaciones": "" if saldo == 0 else (f"A favor AR$ {abs(saldo)}" if saldo > 0 else f"Debe AR$ {abs(saldo)}")
        })
        vid += 1

with open('database/ventas.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=["id", "fecha", "mes", "cliente", "medio_pago", "total_venta", "monto_recibido", "saldo_cliente", "estado_pago", "observaciones"])
    writer.writeheader()
    writer.writerows(ventas_list)

with open('database/ventas.json', 'w', encoding='utf-8') as f:
    json.dump(ventas_list, f, indent=2, ensure_ascii=False)

print(f"Ventas procesadas: {len(ventas_list)}")
