# -*- coding: utf-8 -*-
import json

with open(r'C:\Users\Pite\Documents\Trabajo\Carne Premium-Vacío\carnespremium-app\database\lucas.json', 'r', encoding='utf-8') as f:
    lucas_data = json.load(f)

proveedor_data = []
for item in lucas_data:
    concepto = item.get('concepto', '')
    notas = item.get('notas', '')
    # Remove references to Lucas in concept/notes
    concepto_clean = concepto.replace('PAGO A LUCAS', 'Pago a Proveedor').replace('lucas', 'proveedor').replace('Lucas', 'Proveedor')
    notas_clean = notas.replace('lucas', 'proveedor').replace('Lucas', 'Proveedor')

    proveedor_data.append({
        "id": item.get('id'),
        "fecha": item.get('fecha'),
        "concepto": concepto_clean,
        "medio_pago": item.get('medio_pago', 'MercadoPago'),
        "pago_a_proveedor": item.get('pago_a_lucas', 0),
        "costo_carne": item.get('costo_carne', 0),
        "saldo": item.get('saldo', 0),
        "notas": notas_clean
    })

with open(r'C:\Users\Pite\Documents\Trabajo\Carne Premium-Vacío\carnespremium-app\database\proveedor.json', 'w', encoding='utf-8') as f:
    json.dump(proveedor_data, f, indent=2, ensure_ascii=False)

print(f"Proveedor data guardada: {len(proveedor_data)} filas")
