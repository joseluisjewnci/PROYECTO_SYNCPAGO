-- ============================================================
-- SCRIPT DE INSERCIÓN DE DATOS: 03_INSERTAR_DATOS.sql
-- ============================================================
-- Versión segura: NO borra ni reinicia nada y se puede ejecutar varias veces.
-- Solo para pruebas o demostración.

-- 1. Usuarios (si el correo o el teléfono ya existen, se omite)
INSERT INTO usuarios (telefono, nombre, correo, contrasena) VALUES
    ('3001234567', 'Carlos Pérez', 'carlos@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$hOZNFB0qUz8yFMPjYf/caQ$8z8fQt3FPn0gr0erv4acYEWp+C+XefEVoYzYKTsrfy4'),
    ('3019876543', 'María Gómez', 'maria@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$xBRwbS5eIfxWlvbzmPHWLw$hVKka1YqYBOkgSFek0QMauvHXWAvA8A1AyhWTyTJJpA'),
    ('3154567890', 'Juan Rodríguez', 'juan@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$6ZOQMWdPJZcrHhhyu0CikA$fItSjXg8j0ygMCIKGANdzICWaWO++qShKc/Pm9e6WSw'),
    ('3201112233', 'Laura Martínez', 'laura@gmail.com', '$argon2id$v=19$m=65536,t=3,p=4$7sapvlUasisvdKzsXxntrw$2ZPEWKgZpZCF00teDnsNcpygrrpwDQVLxCnwkPo8Jmg')
ON CONFLICT DO NOTHING;

-- 2. Tipos de gasto (se resuelve el usuario por su correo)
INSERT INTO tipo_gasto (id_usuario, clase, detalle)
SELECT u.id_usuario, v.clase, v.detalle
FROM (VALUES
    ('carlos@gmail.com', 'entretenimiento', 'Cine y plataformas'),
    ('carlos@gmail.com', 'vital', 'Alimentación'),
    ('carlos@gmail.com', 'vital', 'Servicios públicos'),
    ('carlos@gmail.com', 'varios', 'Compras personales'),
    ('maria@gmail.com', 'vital', 'Mercado'),
    ('maria@gmail.com', 'vital', 'Transporte'),
    ('maria@gmail.com', 'entretenimiento', 'Restaurantes'),
    ('juan@gmail.com', 'vital', 'Arriendo'),
    ('juan@gmail.com', 'vital', 'Servicios'),
    ('juan@gmail.com', 'varios', 'Educación'),
    ('laura@gmail.com', 'vital', 'Alimentación'),
    ('laura@gmail.com', 'entretenimiento', 'Viajes')
) AS v(correo, clase, detalle)
JOIN usuarios u ON u.correo = v.correo
WHERE NOT EXISTS (
    SELECT 1 FROM tipo_gasto t WHERE t.id_usuario = u.id_usuario AND t.detalle = v.detalle
);

-- 3. Gastos
-- NOTA: Al insertar cada fila, los triggers disparan automáticamente
-- las entradas correspondientes en 'trazabilidad' y 'recordatorio'.
INSERT INTO gasto (id_tipo, fecha_vencimiento, precio, estado)
SELECT t.id_tipo, v.fecha_vencimiento::timestamp, v.precio, v.estado
FROM (VALUES
    ('carlos@gmail.com', 'Cine y plataformas', '2026-08-10 23:59:00', 75000.00, 'pagado'),
    ('carlos@gmail.com', 'Alimentación', '2026-08-15 18:00:00', 450000.00, 'pendiente'),
    ('carlos@gmail.com', 'Servicios públicos', '2026-08-20 20:00:00', 180000.00, 'pendiente'),
    ('carlos@gmail.com', 'Compras personales', '2026-08-25 17:30:00', 120000.00, 'pendiente'),
    ('maria@gmail.com', 'Mercado', '2026-08-18 12:00:00', 380000.00, 'pendiente'),
    ('maria@gmail.com', 'Transporte', '2026-08-16 19:00:00', 150000.00, 'pagado'),
    ('maria@gmail.com', 'Restaurantes', '2026-08-22 21:00:00', 90000.00, 'pendiente'),
    ('juan@gmail.com', 'Arriendo', '2026-08-05 13:00:00', 850000.00, 'pagado'),
    ('juan@gmail.com', 'Servicios', '2026-08-19 18:30:00', 220000.00, 'pendiente'),
    ('juan@gmail.com', 'Educación', '2026-08-30 23:59:00', 300000.00, 'pendiente'),
    ('laura@gmail.com', 'Alimentación', '2026-08-17 14:00:00', 420000.00, 'pendiente'),
    ('laura@gmail.com', 'Viajes', '2026-09-05 16:00:00', 600000.00, 'pendiente')
) AS v(correo, detalle, fecha_vencimiento, precio, estado)
JOIN usuarios u ON u.correo = v.correo
JOIN tipo_gasto t ON t.id_usuario = u.id_usuario AND t.detalle = v.detalle
WHERE NOT EXISTS (
    SELECT 1 FROM gasto g
    WHERE g.id_tipo = t.id_tipo AND g.fecha_vencimiento = v.fecha_vencimiento::timestamp AND g.precio = v.precio
);

-- 4. Finanzas
INSERT INTO finanzas (id_usuario, fecha, entrada_dinero, presupuesto_gastos)
SELECT u.id_usuario, v.fecha::date, v.entrada_dinero, v.presupuesto_gastos
FROM (VALUES
    ('carlos@gmail.com', '2026-08-01', 3500000.00, 1800000.00),
    ('maria@gmail.com', '2026-08-01', 2800000.00, 1500000.00),
    ('juan@gmail.com', '2026-08-01', 4200000.00, 2500000.00),
    ('laura@gmail.com', '2026-08-01', 3200000.00, 1800000.00)
) AS v(correo, fecha, entrada_dinero, presupuesto_gastos)
JOIN usuarios u ON u.correo = v.correo
WHERE NOT EXISTS (
    SELECT 1 FROM finanzas f WHERE f.id_usuario = u.id_usuario AND f.fecha = v.fecha::date
);
