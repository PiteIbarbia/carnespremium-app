# -*- coding: utf-8 -*-
"""
Script para generar la base de datos histórica completa y estandarizada de Carnes Premium.
Aplica la regla de negocio:
- Hasta 2026-06-22: Ganancia compartida 50% Juan / 50% Lucas
- A partir de 2026-06-23: Ganancia 100% Juan (Lucas sumó su margen al costo)
"""

import json
import csv
import re
import os

raw_lines = """
2026-04-26,JuanMa,Colita,18000,22000,1.5,33000,6000,MercadoPago,Pagó
2026-04-27,Muncha,Picaña,17000,22000,1.2,26400,6000,Efectivo,A favor AR$600
2026-04-30,Isa,Colita,18000,22000,1.1,24200,4400,MercadoPago,Pagó
2026-04-29,Annette,Colita,18000,22000,1.8,39600,7200,MercadoPago,Pagó
2026-05-07,Ale S,Lomo,25000,29000,3.6,104400,14400,MercadoPago,Pagó
2026-05-07,Ale S,Vacio,15000,20000,4.7,94000,23500,MercadoPago,Pagó
2026-05-07,Tomi Rivero,Picaña,17000,21000,1.3,27300,5200,MercadoPago,Pagó
2026-05-11,Laura,Picaña,17000,20000,1.1,22000,3300,MercadoPago,Pagó
2026-05-11,Isa,Colita,18000,23000,0.9,20700,4500,MercadoPago,Pagó
2026-05-11,Sonia,Picaña,17000,22000,1.2,26400,6000,MercadoPago,Pagó
2026-05-11,Sonia,Colita,18000,22000,1,22000,4000,MercadoPago,Pagó
2026-05-12,Jime,Lomo,25000,29000,1.6,46400,6400,MercadoPago,Pagó
2026-05-13,Mariano,Picaña,17000,23000,2.6,59800,15600,MercadoPago,Pagó
2026-05-13,Mariano,Vacio,15000,20000,4.4,88000,22000,MercadoPago,Pagó
2026-05-13,Tomi Rivero,Vacio,15000,18000,4.5,81000,13500,MercadoPago,Pagó a través de Juan
2026-05-14,JuanMa,Bife Ch,18000,22000,2.9,63800,11600,MercadoPago,Pagó
2026-05-14,Peter,Lomo,25000,29000,2.7,78300,10800,MercadoPago,Pagó
2026-05-14,Peter,Colita,18000,23000,1.6,36800,8000,MercadoPago,Pagó
2026-05-14,Peter,Bife Ch,18000,22000,3.2,70400,12800,MercadoPago,Pagó
2026-05-15,Carlos Rivero,Colita,18000,23000,0.9,20700,4500,MercadoPago,Pagó
2026-05-15,Carlos Rivero,Vacio,15000,18000,4.3,77400,12900,MercadoPago,Pagó
2026-05-15,Carlos Rivero,Picaña,17000,23000,2.1,48300,12600,MercadoPago,Pagó
2026-05-16,Muncha,Picaña,17000,23000,1.6,36800,9600,Efectivo,Paga $36.200 (tenía a favor $600)
2026-05-19,Matias de Blasi,Vacio,15000,18000,5.4,97200,16200,MercadoPago,Pagó
2026-05-19,Matias de Blasi,Colita,18000,23000,0.8,18400,4000,MercadoPago,Pagó
2026-05-19,Mariano,Vacio,15000,18000,5,90000,15000,MercadoPago,Pagó
2026-05-19,Mariano,Colita,18000,23000,0.9,20700,4500,MercadoPago,Pagó
2026-05-19,Mariano,Picaña,17000,23000,2.5,57500,15000,MercadoPago,Pagó
2026-05-20,Zurdo,Vacio,15000,18000,3.6,64800,10800,Efectivo,Pagó
2026-05-20,Zurdo,Colita,18000,23000,0.8,18400,4000,Efectivo,Pagó
2026-05-20,Isa,Colita,18000,23000,1,23000,5000,MercadoPago,Pagó
2026-05-20,Jime,Lomo,25000,29000,1.4,40600,5600,MercadoPago,Pagó
2026-05-21,Adela,Vacio,15000,18000,4.8,86400,14400,MercadoPago,Pagó
2026-05-21,Adela,Lomo,25000,29000,1.4,40600,5600,MercadoPago,Pagó
2026-05-22,Annette,Lomo,25000,29000,1.6,46400,6400,MercadoPago,Pagó
2026-05-21,Matias,Colita,18000,23000,0.8,18400,4000,MercadoPago,Pagó
2026-05-21,Rodillo,Vacio,15000,18000,4.5,81000,13500,MercadoPago,Pagó
2026-05-22,Muncha,Picaña,17000,23000,1.8,41400,10800,Efectivo,A favor AR$200
2026-05-22,Muncha,Colita,18000,23000,0.8,18400,4000,Efectivo,Pagó
2026-05-22,Tomi,Bife Ch,18000,22000,2.7,59400,10800,MercadoPago,Pagó
2026-05-22,Breide,Vacio,15000,18000,3.9,70200,11700,MercadoPago,Pagó
2026-05-23,Carola,Peceto,17000,23000,1.5,34500,9000,Efectivo,Pagó
2026-05-26,Gaston,Lomo,25000,29000,1.8,52200,7200,Efectivo,A favor AR$100
2026-05-26,Gaston,Colita,18000,23000,0.9,20700,4500,Efectivo,Pagó
2026-05-27,Matias de Blasi,Bife Ch,18000,22000,3.2,70400,12800,MercadoPago,Pagó
2026-05-27,Matias de Blasi,Vacio,15000,18000,4,72000,12000,MercadoPago,Pagó
2026-05-27,Lourdes,Nalga sin Tapa,16500,19500,3.5,68250,10500,MercadoPago,Pagó
2026-05-27,Delia,Nalga sin Tapa,16500,19500,3.8,74100,11400,Efectivo,Pagó
2026-05-27,Jime,Lomo,25000,29000,1.6,46400,6400,MercadoPago,Pagó
2026-05-27,Jime,Vacio,15000,18000,4.2,75600,12600,MercadoPago,Pagó
2026-05-28,Laura,Peceto,17000,19500,1.5,29250,3750,MercadoPago,Pagó
2026-05-28,Laura,Colita,18000,23000,0.9,20700,4500,MercadoPago,Pagó
2026-05-28,Rochi Melazza,Picaña,17000,21000,2.3,48300,9200,MercadoPago,Pagó
2026-05-28,Rochi Melazza,Vacio,15000,18000,4.4,79200,13200,MercadoPago,Pagó
2026-05-28,Rochi Melazza,Lomo,25000,29000,1.6,46400,6400,MercadoPago,Pagó
2026-05-28,Ines,Vacio,15000,18000,5.1,91800,15300,Efectivo,Pagó
2026-05-28,Ana del Pino,Nalga sin Tapa,16500,19500,3.6,70200,10800,MercadoPago,Pagó
2026-05-28,Juan S,Picaña,17000,21000,1,21000,4000,MercadoPago,Pagó
2026-05-28,Juan S,Lomo,25000,29000,1.6,46400,6400,MercadoPago,Pagó
2026-06-01,Diego,Bife Ch,18000,22000,2.9,63800,11600,MercadoPago,Pagó
2026-06-01,Diego,Vacio,15000,20000,6.3,126000,31500,MercadoPago,Pagó
2026-06-01,Rodolfo Melazza,Vacio,15000,20000,5.4,108000,27000,MercadoPago,Pagó
2026-06-02,Adela,Peceto,17000,19500,1.8,35100,4500,MercadoPago,Pagó
2026-06-02,Laura Costu,Peceto Feteado,19000,21500,2.5,53750,6250,Efectivo,A favor AR$50
2026-06-02,Lourdes,Peceto,17000,19500,1.3,25350,3250,MercadoPago,Pagó
2026-06-03,Ale S,Lomo,25000,29000,1.8,52200,7200,MercadoPago,Pagó
2026-06-03,Ale S,Vacio,15000,20000,5,100000,25000,MercadoPago,Pagó
2026-06-03,Ale S,Bife Ch,18000,22000,2.3,50600,9200,MercadoPago,Pagó
2026-06-03,Delia,Lomo,25000,29000,1.7,49300,6800,Efectivo,A favor AR$3.400
2026-06-03,Delia,Picaña,17000,21000,1.3,27300,5200,Efectivo,Pagó
2026-06-04,Matias Ureta,Vacio,15000,20000,4.8,96000,24000,MercadoPago,Pagó
2026-06-04,Matias Ureta,Peceto,17000,19500,1.2,23400,3000,MercadoPago,Pagó
2026-06-04,Matias Ureta,Picaña,17000,21000,2.5,52500,10000,MercadoPago,Pagó
2026-06-04,Jime,Lomo,25000,29000,1.8,52200,7200,MercadoPago,Pagó
2026-06-04,Ezequiel,Vacio,15000,18000,9.8,176400,29400,Efectivo,A favor AR$100
2026-06-04,Ezequiel,Bife Ch,18000,21000,7.3,153300,21900,Efectivo,Pagó
2026-06-04,Ezequiel,Lomo,25000,27500,7,192500,17500,Efectivo,Pagó
2026-06-04,Ezequiel,Picaña,17000,21000,2.7,56700,10800,Efectivo,Pagó
2026-06-04,Breide,Colita,18000,23000,1,23000,5000,MercadoPago,Pagó
2026-06-05,Zurdo,Vacio,15000,20000,4.6,92000,23000,Efectivo,Pagó
2026-06-05,Zurdo,Colita,18000,23000,2.6,59800,13000,Efectivo,Pagó
2026-06-05,Zurdo,Bife Ch,18000,22000,2.3,50600,9200,Efectivo,Pagó
2026-06-05,Tomas Koch,Lomo,25000,29000,10.4,301600,41600,MercadoPago,Pagó
2026-06-05,Tomas Koch,Vacio,15000,20000,4.5,90000,22500,MercadoPago,Pagó
2026-06-05,Tomas Koch,Bife Ch,18000,22000,2.3,50600,9200,MercadoPago,Pagó
2026-06-05,Patricio Cabrini,Lomo,25000,29000,7.5,217500,30000,Efectivo,A favor AR$100
2026-06-09,Zurdo,Vacio,15000,20000,9.6,192000,48000,Efectivo,Pagó
2026-06-09,Laura Costu,Peceto Feteado,19000,21500,2.6,55900,6500,MercadoPago,Pagó
2026-06-09,Maria Eizayaga,Colita,18000,23000,2.4,55200,12000,MercadoPago,Pagó
2026-06-09,Matias,Lomo,25000,29000,2.9,84100,11600,MercadoPago,Pagó
2026-06-10,Fernando Zambra,Colita,18000,23000,1.6,36800,8000,Efectivo,Pagó
2026-06-10,Fernando Zambra,Picaña,17000,23000,2.5,57500,15000,Efectivo,Pagó
2026-06-10,Delia,Vacio,15000,20000,4.3,86000,21500,Efectivo,Pagó
2026-06-10,Delia,Nalga sin Tapa,16500,19500,4.2,81900,12600,Efectivo,Pagó
2026-06-10,Delia,Peceto,17000,22000,1.6,35200,8000,Efectivo,Pagó
2026-06-11,Jime,Lomo,25000,29000,1.3,37700,5200,MercadoPago,Pagó
2026-06-11,Breide,Nalga Feteada,19000,21500,1.3,27950,3250,MercadoPago,Pagó
2026-06-11,Breide,Colita,18000,23000,4,92000,20000,MercadoPago,Pagó
2026-06-11,Adela,Nalga sin Tapa,16500,19500,3.8,74100,11400,MercadoPago,Pagó
2026-06-11,Bettina,Vacio,15000,20000,3.2,64000,16000,Efectivo,A favor AR$300
2026-06-11,Bettina,Lomo,25000,29000,1.4,40600,5600,Efectivo,Pagó
2026-06-11,Bettina,Colita,18000,23000,1.7,39100,8500,Efectivo,Pagó
2026-06-12,Laura,Lomo,25000,29000,3,87000,12000,MercadoPago,Pagó
2026-06-12,Laura,Colita,18000,23000,2,46000,10000,MercadoPago,Pagó
2026-06-12,Carlos Rivero,Vacio,15000,20000,4.6,92000,23000,MercadoPago,Pagó
2026-06-12,Carlos Rivero,Bife Ch,18000,22000,2.6,57200,10400,MercadoPago,Pagó
2026-06-12,Carlos Rivero,Picada especial,14000,16000,1,16000,2000,MercadoPago,Pagó
2026-06-12,Juanito,Picaña,17000,23000,1.2,27600,7200,MercadoPago,Pagó
2026-06-16,Tomi Suarez,Colita,18000,23000,0.8,18400,4000,MercadoPago,Pagó
2026-06-16,Tomi Suarez,Picada especial,14000,16000,1.215,19440,2430,MercadoPago,Pagó
2026-06-16,Tomi Suarez,Nalga Feteada,19000,22000,1.125,24750,3375,MercadoPago,Pagó
2026-06-16,Joaquin Reichart,Lomo,25000,29000,3,87000,12000,MercadoPago,Pagó
2026-06-16,Joaquin Reichart,Colita,18000,23000,2.3,52900,11500,MercadoPago,Pagó
2026-06-16,Jaime Lorenzo,Vacio,15000,20000,4.5,90000,22500,MercadoPago,Pagó
2026-06-16,Matias de Blasi,Picaña,17000,23000,5,115000,30000,Efectivo,Pagó
2026-06-17,Jime,Picada especial,14000,16000,1.26,20160,2520,MercadoPago,Pagó
2026-06-17,Jime,Picaña,17000,23000,1,23000,6000,MercadoPago,Pagó
2026-06-17,Matias Sonzini,Picaña,17000,23000,1.4,32200,8400,MercadoPago,Pagó
2026-06-17,Annette,Nalga Feteada,19000,22000,1.15,25300,3450,MercadoPago,Pagó
2026-06-19,Pato O'Reilly,Vacio,15000,20000,5.5,110000,27500,MercadoPago,Pagó
2026-06-19,Pato O'Reilly,Lomo,25000,29000,3.1,89900,12400,MercadoPago,Pagó
2026-06-19,Isa,Colita,18000,23000,1,23000,5000,MercadoPago,Pagó
2026-06-19,Isa,Picada especial,14000,16000,1.115,17840,2230,MercadoPago,Pagó
2026-06-19,Carola,Nalga Feteada,19000,22000,1.325,29150,3975,MercadoPago,Pagó
2026-06-19,Carola,Picada especial,14000,16000,1.355,21680,2710,MercadoPago,Pagó
2026-06-23,Joaquin Reichart,Lomo,27000,29000,5.8,168200,11600,MercadoPago,Pagó
2026-06-23,Annette,Vacio,17000,20000,2.8,56000,8400,MercadoPago,Pagó
2026-06-23,Annette,Nalga Feteada,19000,22000,1.2,26400,3600,MercadoPago,Pagó
2026-06-23,Jime,Lomo,27000,29000,1.3,37700,2600,MercadoPago,Pagó
2026-06-23,Muncha,Picaña,19000,23000,1,23000,4000,Efectivo,A favor AR$4000
2026-06-23,Muncha,Peceto Feteado,19000,22000,1.8,39600,5400,Efectivo,Pagó
2026-06-23,Peter,Colita,21000,23000,1.7,39100,3400,MercadoPago,Pagó
2026-06-23,Peter,Lomo,27000,29000,1.5,43500,3000,MercadoPago,Pagó
2026-06-23,Peter,Nalga Feteada,19000,22000,2.5,55000,7500,MercadoPago,Pagó
2026-06-23,Cristina Igarzabal,Colita,21000,23000,1.5,34500,3000,MercadoPago,Pagó
2026-06-23,Cristina Igarzabal,Picaña,19000,23000,1.5,34500,6000,MercadoPago,Pagó
2026-06-23,Cristina Igarzabal,Lomo,27000,29000,1.3,37700,2600,MercadoPago,Pagó
2026-06-24,JuanMa,Colita,21000,23000,1.1,25300,2200,MercadoPago,Pagó
2026-06-25,Diego Gonzalez Bonorino,Picaña,19000,23000,1.4,32200,5600,MercadoPago,Pagó
2026-06-25,Diego Gonzalez Bonorino,Lomo,27000,29000,1.3,37700,2600,MercadoPago,Pagó
2026-06-25,Diego Gonzalez Bonorino,Colita,21000,23000,1.7,39100,3400,MercadoPago,Pagó
2026-06-29,Laura Guidi,Peceto Feteado,19000,22000,3.6,79200,10800,MercadoPago,Pagó
2026-06-29,Rochi Melazza,Vacio,17000,20000,4,80000,12000,MercadoPago,Pagó
2026-06-29,Rochi Melazza,Lomo,27000,29000,1.5,43500,3000,MercadoPago,Pagó
2026-06-30,Annette,Nalga Feteada,19000,22000,1,22000,3000,MercadoPago,Pagó
2026-06-30,Ale Silveyra,Lomo,27000,29000,5.9,171100,11800,MercadoPago,Pagó
2026-06-30,Carola,Colita,21000,23000,1,23000,2000,MercadoPago,Pagó
2026-07-01,Pato O'Reilly,Picada especial,14000,16000,3.4,54400,6800,MercadoPago,Pagó
2026-07-01,Pato O'Reilly,Nalga Feteada,19000,22000,1.1,24200,3300,MercadoPago,Pagó
2026-07-01,Pato O'Reilly,Colita,21000,23000,1.9,43700,3800,MercadoPago,Pagó
2026-07-06,Santi Breide,Nalga Feteada,19000,22000,2.2,48400,6600,MercadoPago,Pagó
2026-07-06,Santi Breide,Colita,21000,23000,0.9,20700,1800,MercadoPago,Pagó
2026-07-06,Santi Breide,Bife Ch,20000,22000,2.9,63800,5800,MercadoPago,Pagó
2026-07-07,Pato O'Reilly,Vacio,17000,20000,4.5,90000,13500,MercadoPago,Pagó
2026-07-07,Tomas Koch,Lomo,27000,29000,8.1,234900,16200,MercadoPago,Pagó
2026-07-07,Tomas Koch,Nalga Feteada,19000,22000,2.5,55000,7500,MercadoPago,Pagó
2026-07-07,Tomas Koch,Vacio,17000,22000,3.1,68200,15500,MercadoPago,Pagó
2026-07-07,Jime,Lomo,27000,29000,1.6,46400,3200,MercadoPago,Pagó
2026-07-07,Annette,Lomo,27000,29000,1.5,43500,3000,MercadoPago,Pagó
2026-07-07,Annette,Nalga Feteada,19000,22000,1,22000,3000,MercadoPago,Pagó
2026-07-08,Tomi Rivero,Vacio,17000,20000,3.2,64000,9600,MercadoPago,Pagó
2026-07-09,Jaime Lorenzo,Vacio,17000,20000,4.5,90000,13500,MercadoPago,Pagó
2026-07-09,Nacho Gabancho,Lomo,27000,29000,1.2,34800,2400,MercadoPago,Pagó
2026-07-09,Ezequiel Cardoni,Lomo,27000,29000,6.5,188500,13000,MercadoPago,Pagó
2026-07-10,Ramón,Colita,21000,23000,1,23000,2000,Efectivo,A favor AR$1.800
2026-07-10,Ramón,Peceto,19000,21000,1.2,25200,2400,Efectivo,Pagó
2026-07-13,Nacho Gabancho,Vacio,17000,22000,1.2,26400,6000,MercadoPago,Pagó
2026-07-13,Nacho Gabancho,Lomo,27000,29000,1.5,43500,3000,MercadoPago,Pagó
2026-07-13,Jime,Lomo,27000,29000,1.5,43500,3000,MercadoPago,Pagó
2026-07-13,Jime,Picada especial,14000,16000,1.2,19200,2400,MercadoPago,Pagó
2026-07-13,Laura Guidi,Peceto Feteado,19000,22000,2,44000,6000,Efectivo,Pagó
2026-07-13,Amparo Nogueira,Lomo,27000,29000,3,87000,6000,MercadoPago,Pagó
2026-07-14,Sole Ezcurra,Colita,21000,23000,0.9,20700,1800,MercadoPago,Pagó
2026-07-14,Sole Ezcurra,Lomo,27000,29000,1.3,37700,2600,MercadoPago,Pagó
2026-07-14,Isa,Picada especial,14000,16000,1.2,19200,2400,MercadoPago,Pagó
2026-07-16,JuanMa,Colita,21000,23000,0.7,16100,1400,MercadoPago,Pagó
2026-07-16,Santi Perrota,Bife Ch,20000,22000,2.5,55000,5000,MercadoPago,Pagó
2026-07-16,Santi Perrota,Lomo,27000,29000,1.5,43500,3000,MercadoPago,Pagó
2026-07-16,Santi Perrota,Vacio,17000,22000,1.255,27610,6275,MercadoPago,Pagó
2026-07-17,Muncha,Picaña,19000,23000,2.8,64400,11200,Efectivo,A favor AR$600
2026-07-17,Jaime,Vacio,17000,20000,4.3,86000,12900,MercadoPago,Pagó
2026-07-17,Fernando Zambra,Picaña,19000,23000,2.6,59800,10400,Efectivo,A favor AR$200
2026-07-23,Lourdes,Nalga sin Tapa,16500,19500,3.63,70785,10890,MercadoPago,Pagó
2026-07-23,Peter,Colita,21000,23000,2.245,51635,4490,MercadoPago,Pagó
2026-07-23,Peter,Lomo,27000,29000,1.495,43355,2990,MercadoPago,Pagó
2026-07-23,Peter,Bife Ch,20000,22000,1.815,39930,10030,MercadoPago,Pagó
2026-07-23,Peter,Vacio,17000,20000,3.295,65900,9885,MercadoPago,Pagó
2026-07-23,Isa,Colita,21000,23000,1.365,31395,2730,MercadoPago,Pagó
2026-07-23,Ezequiel,Nalga Feteada,19000,22000,1.195,26290,3585,MercadoPago,Pagó
2026-07-23,Ezequiel,Bife Ch,20000,22000,1.94,42680,3880,MercadoPago,Pagó
2026-07-23,Tomi Suarez,Picada especial,14000,16000,1.125,18000,2250,MercadoPago,Pagó
2026-07-23,Tomi Suarez,Nalga Feteada,19000,22000,1.225,26950,3675,MercadoPago,Pagó
2026-07-29,Tomas Koch,Peceto Feteado,19000,22000,2.915,64130,8745,MercadoPago,Pagó
2026-07-29,Tomas Koch,Nalga Feteada,19000,22000,3.075,67650,9225,MercadoPago,Pagó
2026-07-29,Carola,Picada especial,14000,16000,1.15,18400,2300,MercadoPago,Pagó
2026-07-29,Carola,Colita,21000,23000,1.145,26335,2290,MercadoPago,Pagó
2026-07-30,Gaston,Colita,21000,23000,1.045,24035,2090,MercadoPago,Pagó
2026-07-30,Agustin,Colita,21000,23000,5.07,116610,10140,MercadoPago,Pagó
2026-07-30,Agustin,Lomo,27000,29000,3.075,89175,6150,MercadoPago,Pagó
2026-07-30,Isa,Colita,21000,23000,1.125,25875,2250,MercadoPago,Pagó
2026-07-31,Nacho Gabancho,Lomo,27000,29000,1.64,47560,3280,MercadoPago,Pagó
2026-07-31,Nacho Gabancho,Chorizo,7500,7500,0.625,4687.5,0,MercadoPago,Pagó
2026-07-31,JuanMa,Colita,21000,23000,2.58,59340,5160,MercadoPago,Pagó
2026-08-06,Muncha,Picaña,19000,23000,1.365,31395,5460,MercadoPago,Pagó
2026-08-06,Santi Breide,Nalga Feteada,19000,22000,2.375,52250,7125,MercadoPago,Pagó
2026-08-10,Maria Aramburu,Picaña,19000,23000,2.255,51865,9020,MercadoPago,Pagó
2026-08-10,Maria Aramburu,Lomo,27000,29000,3.08,89320,6160,MercadoPago,Pagó
2026-08-10,Maria Aramburu,Vacio,17000,22000,2.625,57750,13125,MercadoPago,Pagó
2026-08-10,Laura Igarzabal,Lomo,27000,29000,3.075,89175,6150,MercadoPago,Pagó
2026-08-12,Tomi Rivero,Bife Ch,20000,22000,1.795,39490,3590,MercadoPago,Pagó
2026-08-12,Annette,Nalga Feteada,19000,22000,1.225,26950,3675,MercadoPago,Pagó
2026-08-12,Carola,Nalga Feteada,19000,22000,1.125,24750,3375,MercadoPago,Pagó
2026-08-12,Isa,Colita,21000,23000,0.885,20355,1770,MercadoPago,Pagó
2026-08-12,Laura Guidi,Peceto Feteado,19000,22000,3.305,72710,9915,MercadoPago,Pagó
2026-08-12,Bettina,Peceto,19000,21000,1.235,25935,2470,Efectivo,A favor AR$1.830
2026-08-12,Bettina,Lomo,27000,29000,4.215,122235,8430,Efectivo,Pagó
2026-08-12,Marcos Bruno,Colita,21000,23000,3.02,69460,6040,MercadoPago,Pagó
2026-08-12,Marcos Bruno,Lomo,27000,29000,7.725,224025,15450,MercadoPago,Pagó
2026-08-13,Sole Ezcurra,Vacio,17000,22000,1.715,37730,8575,MercadoPago,Pagó
2026-08-13,Sole Ezcurra,Lomo,27000,29000,1.415,41035,2830,MercadoPago,Pagó
2026-08-14,Agustin Breide,Vacio,17000,22000,2.775,61050,13875,MercadoPago,Pagó
2026-08-14,Agustin Breide,Colita,21000,23000,0.98,22540,1960,MercadoPago,Pagó
2026-08-14,Agustin Breide,Picaña,19000,23000,1.3,29900,5200,MercadoPago,Pagó
2026-08-14,Matias Sonzini,Colita,21000,23000,1.005,23115,2010,MercadoPago,Pagó
2026-08-14,Matias Sonzini,Lomo,27000,29000,1.55,44950,3100,MercadoPago,Pagó
2026-08-14,Tomi Rivero,Vacio,17000,22000,1.03,22660,5150,MercadoPago,Pagó
2026-08-14,Tomi Rivero,Picaña,19000,23000,1.305,30015,5220,MercadoPago,Pagó
2026-08-18,Cristina Igarzabal,Picaña,19000,23000,2.53,58190,10120,MercadoPago,Pagó
2026-08-18,Cristina Igarzabal,Lomo,27000,29000,1.465,42485,2930,MercadoPago,Pagó
2026-08-24,Laura Guidi,Peceto Feteado,19000,22000,2.47,54340,7410,MercadoPago,Pagó
2026-08-24,Annette,Nalga Feteada,19000,22000,1.345,29590,4035,MercadoPago,Pagó
2026-08-24,Jime,Picada especial,14000,16000,2.57,41120,5140,MercadoPago,Pagó
2026-08-24,Ana del Pino,Colita,21000,23000,1.78,40940,3560,MercadoPago,Pagó
2026-08-24,Santi Perrota,Vacio,17000,22000,1.68,36960,8400,MercadoPago,Pagó
2026-08-24,Santi Perrota,Bife Ch,20000,22000,2.98,65560,5960,MercadoPago,Pagó
2026-08-24,Santi Perrota,Picada especial,14000,16000,1.265,20240,2530,MercadoPago,Pagó
2026-08-25,Sole Ezcurra,Colita,21000,23000,2.365,54395,4730,MercadoPago,Pagó
2026-08-26,Tomi Rivero,Vacio,17000,20000,1.785,35700,5355,MercadoPago,Pagó
2026-08-26,Joaquin Reichart,Lomo,27000,29000,3.045,88305,6090,MercadoPago,Pagó
2026-08-26,Joaquin Reichart,Peceto Feteado,19000,22000,3.125,68750,9375,MercadoPago,Pagó
2026-08-26,Santiago Reichart,Colita,21000,23000,0.89,20470,1780,MercadoPago,Pagó
2026-08-26,Santiago Reichart,Lomo,27000,29000,1.565,45385,3130,MercadoPago,Pagó
2026-08-26,Santiago Reichart,Peceto Feteado,19000,22000,1.905,41910,5715,MercadoPago,Pagó
2026-08-27,Laura Guidi,Nalga Feteada,19000,22000,1.355,29810,4065,MercadoPago,Pagó
2026-09-01,Tomi Rivero,Bife Ch,20000,22000,2.22,48840,4440,MercadoPago,Pagó
2026-09-02,Tomi Suarez,Nalga sin Tapa,17500,19500,3.255,63472.5,6510,MercadoPago,Pagó
2026-09-02,Tomi Suarez,Nalga Feteada,19000,22000,1.095,24090,3285,MercadoPago,Pagó
2026-09-02,Tomi Suarez,Vacio,17000,20000,3.585,71700,10755,MercadoPago,Pagó
2026-09-02,Tomi Suarez,Colita,21000,23000,0.84,19320,1680,MercadoPago,Pagó
2026-09-02,Annette,Lomo,27000,29000,1.625,47125,3250,MercadoPago,Pagó
2026-09-02,Ana del Pino,Nalga sin Tapa,17500,19500,3.655,71272.5,7310,MercadoPago,Pagó
2026-09-02,Isa,Colita,21000,23000,0.945,21735,1890,MercadoPago,Pagó
2026-09-03,Peter,Colita,21000,23000,1.53,35190,3060,MercadoPago,Pagó
2026-09-03,Peter,Peceto Feteado,19000,22000,1.34,29480,4020,MercadoPago,Pagó
2026-09-03,Peter,Nalga Feteada,19000,22000,0.995,21890,2985,MercadoPago,Pagó
2026-09-03,Peter,Lomo,27000,29000,1.83,53070,3660,MercadoPago,Pagó
2026-09-03,Peter,Bife Ch,20000,22000,2.56,56320,5120,MercadoPago,Pagó
2026-09-03,Muncha,Picaña,19000,23000,1.34,30820,5360,MercadoPago,Pagó
2026-09-03,Jorge Galache,Lomo,27000,29000,1.48,42920,2960,MercadoPago,Pagó
2026-09-03,Jorge Galache,Picaña,19000,23000,1.16,26680,4640,MercadoPago,Pagó
2026-09-05,Amparo Nogueira,Lomo,27000,29000,3.19,92510,6380,MercadoPago,Pagó
2026-09-09,Francisco Vazquez,Chorizo,7500,7500,0.99,7425,0,MercadoPago,Pagó
2026-09-09,Santi Breide,Bife Ch,20000,22000,2.24,49280,4480,MercadoPago,Pagó
2026-09-09,Santi Breide,Colita,21000,23000,1.76,40480,3520,MercadoPago,Pagó
2026-09-11,JuanMa,Colita,21000,23000,2.155,49565,4310,MercadoPago,Pagó
2026-09-11,Laura Igarzabal,Picaña,19000,23000,1.01,23230,4040,MercadoPago,Pagó
2026-09-11,Laura Igarzabal,Colita,21000,23000,0.965,22195,1930,MercadoPago,Pagó
2026-09-15,Jime,Picada especial,14000,16000,2.455,39280,4910,MercadoPago,Pagó
2026-09-15,Jime,Peceto Feteado,19000,22000,1.32,29040,3960,MercadoPago,Pagó
2026-09-15,Tomas Koch,Peceto Feteado,19000,22000,1.7,37400,5100,MercadoPago,Pagó
2026-09-15,Tomas Koch,Nalga Feteada,19000,22000,2.165,47630,6495,MercadoPago,Pagó
2026-09-15,Tomas Koch,Lomo,27000,29000,4.2,121800,8400,MercadoPago,Pagó
2026-09-15,Santiago Reichart,Colita,21000,23000,0.915,21045,1830,MercadoPago,Pagó
2026-09-15,Santiago Reichart,Peceto,19000,21000,1.54,32340,3080,MercadoPago,Pagó
2026-09-15,Agustin Reichart,Lomo,27000,29000,4.355,126295,8710,Efectivo,A favor AR$705
2026-09-15,Muncha,Peceto Feteado,19000,22000,1.34,29480,4020,MercadoPago,Pagó
2026-09-15,Muncha,Vacio Fraccionado,17000,22000,1.535,33770,7675,MercadoPago,Pagó
2026-09-15,Muncha,Picaña,19000,23000,1.025,23575,4100,MercadoPago,Pagó
2026-09-15,Isa,Bife Ch Fraccionado,20000,24000,1.315,31560,5260,MercadoPago,Pagó
2026-09-16,Carola,Nalga Feteada,19000,22000,1.145,25190,3435,MercadoPago,Pagó
2026-09-16,Carola,Bife Ch,20000,22000,2.235,49170,4470,MercadoPago,Pagó
2026-09-17,Annette,Lomo,27000,29000,1.41,40890,2820,MercadoPago,Pagó
2026-09-17,Annette,Nalga Feteada,19000,22000,1.215,26730,3645,MercadoPago,Pagó
2026-09-17,JuanMa,Colita,21000,23000,0.805,18515,1610,MercadoPago,Pagó
2026-09-22,Pato O'Reilly,Vacio,17000,20000,5.285,105700,15855,MercadoPago,Pagó
2026-09-24,Fernando Zambra,Picaña,19000,23000,2.2,50600,8800,Efectivo,A favor AR$9.400
2026-09-25,Muncha,Picaña,19000,23000,1.395,32085,5580,MercadoPago,Pagó
2026-09-25,Muncha,Picada especial,14000,16000,1.12,17920,2240,MercadoPago,Pagó
2026-09-28,Fernando Zambra,Picaña,19000,23000,2.355,54165,9420,Efectivo,A favor AR$435
2026-09-29,Lucia Fernandez,Nalga Feteada,19000,22000,1.28,28160,3840,MercadoPago,Pagó
2026-09-29,Lucia Fernandez,Colita,21000,23000,0.935,21505,1870,MercadoPago,Pagó
2026-09-29,Jime,Peceto Feteado,19000,22000,1.41,31020,4230,MercadoPago,Pagó
2026-09-29,Jime,Picada especial,14000,16000,2.46,39360,4920,MercadoPago,Pagó
2026-10-02,Santi Breide,Bife Ch,20000,22000,4.34,95480,8680,MercadoPago,Pagó
2026-10-07,Jime,Peceto Feteado,19000,22000,1.415,31130,4245,MercadoPago,Pagó
2026-10-07,Jime,Picada especial,14000,16000,1.27,20320,2540,MercadoPago,Pagó
2026-10-07,Lucia Fernandez,Colita,21000,23000,0.88,20240,1760,Efectivo,A favor AR$60
2026-10-07,Laura Guidi,Peceto Feteado,19000,22000,1.505,33110,4515,MercadoPago,Pagó
2026-10-07,Muncha,Picaña,19000,23000,2.385,54855,9540,MercadoPago,Pagó
2026-10-08,Matias Sonzini,Colita,21000,23000,0.84,19320,1680,MercadoPago,Pagó
2026-10-08,Matias Sonzini,Lomo,27000,29000,1.555,45095,3110,MercadoPago,Pagó
2026-10-08,Annette,Nalga Feteada,19000,22000,1,22000,3000,MercadoPago,Pagó
2026-10-09,Marcos Bruno,Lomo,27000,29000,3.345,97005,6690,MercadoPago,Pagó
2026-10-09,Marcos Bruno,Colita,21000,23000,0.845,19435,1690,MercadoPago,Pagó
2026-10-13,Carola,Nalga Feteada,19000,22000,1.17,25740,3510,MercadoPago,Pagó
2026-10-13,Carola,Bife Ch,20000,22000,2.595,57090,5190,MercadoPago,Pagó
2026-10-13,Santi Breide,Colita,21000,23000,1.775,40825,3550,MercadoPago,Pagó
2026-10-13,Adela Igarzabal,Picada especial,14000,16000,2.52,40320,5040,MercadoPago,Pagó
2026-10-13,Lucia Fernandez,Lomo,27000,29000,1.725,50025,3450,Efectivo,Debe AR$25
2026-10-13,Lucia Fernandez,Colita,21000,23000,0.92,21160,1840,Efectivo,Pagó
2026-10-14,Bettina,Lomo,27000,29000,3.495,101355,6990,Efectivo,A favor AR$75
2026-10-14,Bettina,Picada especial,14000,16000,2.275,36400,4550,Efectivo,Pagó
2026-10-14,Mati Sonzini,Colita,21000,23000,2.335,53705,4670,MercadoPago,Pagó
"""

meses_es = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

ventas_procesadas = []
vid = 1

for line in raw_lines.strip().split('\n'):
    line = line.strip()
    if not line:
        continue
    parts = [p.strip() for p in line.split(',')]
    if len(parts) < 8:
        continue
    
    fecha = parts[0]
    cliente = parts[1]
    corte = parts[2]
    costo_x_kg = float(parts[3])
    precio_x_kg = float(parts[4])
    kg_vendidos = float(parts[5])
    total_venta = float(parts[6])
    margen_bruto = float(parts[7])
    medio_pago = parts[8] if len(parts) > 8 else "MercadoPago"
    obs = parts[9] if len(parts) > 9 else ""

    # Fecha parse
    m_idx = int(fecha.split('-')[1])
    mes = meses_es[m_idx]

    costo_total = round(kg_vendidos * costo_x_kg, 2)
    # Regla de ganancia:
    # Hasta 2026-06-22: 50% Juan / 50% Lucas
    # Desde 2026-06-23: 100% Juan
    if fecha <= "2026-06-22":
        ganancia_neta = round(margen_bruto * 0.5, 2)
        comision_socio = round(margen_bruto * 0.5, 2)
        etapa = "50% Compartida"
    else:
        ganancia_neta = round(margen_bruto * 1.0, 2)
        comision_socio = 0.0
        etapa = "100% Directa"

    # Saldo de cliente a partir de observaciones
    saldo_cliente = 0.0
    recibido = total_venta
    if "a favor" in obs.lower():
        match = re.search(r'([\d\.]+)', obs.replace('AR$', '').replace('$', ''))
        if match:
            try:
                dif = float(match.group(1).replace('.', ''))
                saldo_cliente = dif
                recibido = total_venta + dif
            except:
                pass
    elif "debe" in obs.lower():
        match = re.search(r'([\d\.]+)', obs.replace('AR$', '').replace('$', ''))
        if match:
            try:
                dif = float(match.group(1).replace('.', ''))
                saldo_cliente = -dif
                recibido = total_venta - dif
            except:
                pass

    ventas_procesadas.append({
        "id": vid,
        "fecha": fecha,
        "mes": mes,
        "cliente": cliente,
        "corte": corte,
        "kg_vendidos": kg_vendidos,
        "costo_x_kg": costo_x_kg,
        "costo_total": costo_total,
        "precio_x_kg": precio_x_kg,
        "total_venta": total_venta,
        "margen_bruto": margen_bruto,
        "ganancia_neta": ganancia_neta,
        "comision_socio": comision_socio,
        "etapa_margen": etapa,
        "medio_pago": medio_pago,
        "monto_recibido": recibido,
        "saldo_cliente": saldo_cliente,
        "estado_pago": "Pagó" if saldo_cliente >= 0 else "Saldo Pendiente",
        "observaciones": obs
    })
    vid += 1

# Orden cronológico inverso (lo más reciente primero)
ventas_procesadas.reverse()

target_json = r'C:\Users\Pite\Documents\Trabajo\Carne Premium-Vacío\carnespremium-app\database\ventas.json'
target_csv = r'C:\Users\Pite\Documents\Trabajo\Carne Premium-Vacío\carnespremium-app\database\ventas.csv'

with open(target_json, 'w', encoding='utf-8') as f:
    json.dump(ventas_procesadas, f, indent=2, ensure_ascii=False)

fieldnames = list(ventas_procesadas[0].keys())
with open(target_csv, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(ventas_procesadas)

print(f"Total ventas detalladas procesadas con corte y kilos: {len(ventas_procesadas)}")
kilos_totales = sum(v['kg_vendidos'] for v in ventas_procesadas)
facturacion = sum(v['total_venta'] for v in ventas_procesadas)
ganancia_total = sum(v['ganancia_neta'] for v in ventas_procesadas)
print(f"Kilos totales: {kilos_totales:.2f} Kg")
print(f"Facturacion total: ${facturacion:,.0f}")
print(f"Ganancia Neta Juan: ${ganancia_total:,.0f}")
