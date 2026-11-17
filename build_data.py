# -*- coding: utf-8 -*-
import csv
import json
import os
import re

# We will create the 4 master data files:
# 1. database/productos.csv
# 2. database/clientes.csv
# 3. database/ventas.csv
# 4. database/lucas.csv

os.makedirs('database', exist_ok=True)

# 1. PRODUCTOS
productos = [
    {"id": 1, "corte": "Bife Ch", "costo_kg": 20000, "precio_kg": 22000, "ganancia_kg": 2000, "notas": ""},
    {"id": 2, "corte": "Bife Ch Fraccionado", "costo_kg": 20000, "precio_kg": 24000, "ganancia_kg": 4000, "notas": ""},
    {"id": 3, "corte": "Colita de Cuadril", "costo_kg": 21000, "precio_kg": 23000, "ganancia_kg": 2000, "notas": ""},
    {"id": 4, "corte": "Lomo", "costo_kg": 27000, "precio_kg": 29000, "ganancia_kg": 2000, "notas": ""},
    {"id": 5, "corte": "Nalga Feteada", "costo_kg": 19000, "precio_kg": 22000, "ganancia_kg": 3000, "notas": ""},
    {"id": 6, "corte": "Nalga sin Tapa", "costo_kg": 17500, "precio_kg": 19500, "ganancia_kg": 2000, "notas": "Actualizado 30-07-2026"},
    {"id": 7, "corte": "Peceto", "costo_kg": 19000, "precio_kg": 21000, "ganancia_kg": 2000, "notas": ""},
    {"id": 8, "corte": "Peceto Feteado", "costo_kg": 19000, "precio_kg": 22000, "ganancia_kg": 3000, "notas": ""},
    {"id": 9, "corte": "Picada especial", "costo_kg": 14000, "precio_kg": 16000, "ganancia_kg": 2000, "notas": ""},
    {"id": 10, "corte": "Picaña", "costo_kg": 19000, "precio_kg": 23000, "ganancia_kg": 4000, "notas": ""},
    {"id": 11, "corte": "Vacio", "costo_kg": 17000, "precio_kg": 20000, "ganancia_kg": 3000, "notas": ""},
    {"id": 12, "corte": "Vacio Fraccionado", "costo_kg": 17000, "precio_kg": 22000, "ganancia_kg": 5000, "notas": ""},
    {"id": 13, "corte": "Ojo de Bife", "costo_kg": 26000, "precio_kg": 29000, "ganancia_kg": 3000, "notas": "Revisado"},
    {"id": 14, "corte": "Chorizo", "costo_kg": 7500, "precio_kg": 9000, "ganancia_kg": 1500, "notas": ""},
    {"id": 15, "corte": "Cuadrada feteada", "costo_kg": 16000, "precio_kg": 19000, "ganancia_kg": 3000, "notas": ""}
]

with open('database/productos.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=["id", "corte", "costo_kg", "precio_kg", "ganancia_kg", "notas"])
    writer.writeheader()
    writer.writerows(productos)

print(f"Productos guardados: {len(productos)}")

# 2. CLIENTES
clientes_raw = """Adela Igarzabal,54 911-3261-4129,,
Ale Silveyra,54 911-5720-1983,"Victoria Ocampo 738, Beccar",Coordinar con Silvina
Ana del Pino,,,
Annette,54 911-6227-8629,"Suipacha 2365, Beccar",
Bettina Helvadjian,54 911-4889-5676,"Diagonal Tucumán 671, Martinez",
Carlos Rivero,,,
Carola Alfonzo,54 911-6369-0104,,Mamá Fran Rodillo
Cristina Igarzabal,54 911-3245-6070,,
Delia,,,
Diego,,,
Diego Gonzalez Bonorino,54 911-4041-3480,"Nicolás Avellaneda 2262, San Isidro",
Ezequiel,54 911-6589-4002,"Barrio Sunny, Tigre",Lote 24
Fran Rodillo,,,
Gaston,,,
Gaston Uzin,54 911-3245-7669,,
Inés Igarzabal,54 911-6494-8444,"Jacinto Diaz 2080, San Isidro",
Isabel Lopez Lacarrere (Isa),54 911-4444-7034,"Barrio Sunny, Tigre",Lote 49
Jaime Lorenzo,,,
Jime Gonzalez Mathys,54 911-3090-2166,"Rosario de Santa Fe 649, Beccar",
Joaquin Reichart,56 9 9851-6389,"Bolivar 290, Beccar",Casa de los padres
Juan Sw,,,
Juanito,,,
JuanMa,54 911-3209-0844,,
Laura Guidi,54 911-3930-7437,"J. F. Kennedy, Victoria",Costurera/Limpieza
Laura Igarzabal,,,
Lourdes,,,
Maria Eizayaga,,,
Mariano,,,
Matias de Blasi,54 911-6299-2667,,
Matias Sonzini,54 911-3593-2039,"Ohiggins 450, San Isidro",1A
Matias Ureta,,,
Muncha,54 911-4416-8375,"Murature 732, San Isidro",Mamá de Naco y Juan Ortega
Pato O'Reilly,,,
Patricio Cabrini,,,
Peter,54 911-5452-4573,"Vicente Fidel López 388, Martinez",2A
Rochi Melazza,,,
Rodolfo Melazza,,,
Santi Breide,54 911-3904-5214,,
Sonia Haddad,507 6354-0567,"Monseñor Alberti 474, San Isidro",3A
Tomas Koch,54 911-3004-1596,"Comandante Luis Piedrabuena 3311, Victoria",
Tomi Rivero,,,
Tomi Suarez,,,
Ezequiel Cardoni,,,
Nacho Gabancho,,,
Amparo Nogueira,54 911-6959-1241,"Juan Jose Diaz 1068, San Isidro",Casa 1
Fernando Zambra,,,
Sole Ezcurra,,,
Santi Perrota,,,
Agustin Reichart,,,
María Aramburu Igarzabal,54 911-6208-0177,Pacheco Golf,Lote 77
Marcos Bruno,54 911-3676-9054,"Santa Catalina 6105, en victoria",Barrio Cerrado Greenlands Lote 5
Jorge Galache,,,
Santiago Reichart,,,
Francisco Vazquez (Pela),,,
Lucia Fernandez,,"Santa Catalina 6105, en victoria",Lote 71"""

import io
clientes = []
reader = csv.reader(io.StringIO(clientes_raw))
cid = 1
for row in reader:
    if not row or not row[0].strip():
        continue
    nombre = row[0].strip()
    tel = row[1].strip() if len(row) > 1 else ""
    domicilio = row[2].strip() if len(row) > 2 else ""
    notas = row[3].strip() if len(row) > 3 else ""
    # clean phone number for whatsapp
    clean_tel = re.sub(r'[^0-9]', '', tel)
    clientes.append({
        "id": cid,
        "nombre": nombre,
        "telefono": tel,
        "telefono_whatsapp": clean_tel,
        "domicilio": domicilio,
        "notas": notas
    })
    cid += 1

with open('database/clientes.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=["id", "nombre", "telefono", "telefono_whatsapp", "domicilio", "notas"])
    writer.writeheader()
    writer.writerows(clientes)

print(f"Clientes guardados: {len(clientes)}")

# 3. VENTAS (Parse and harmonize all sales blocks)

# Read the full raw prompt from file or raw text
with open('raw_input.txt', 'w', encoding='utf-8') as f:
    pass
