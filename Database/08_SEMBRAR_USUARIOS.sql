-- ============================================================ 
-- 08b. SEMBRAR 25 USUARIOS DE EJEMPLO CON CONTRASEÑA HASHEADA, SIN TRUNCAR NADA 
-- ============================================================ 
-- No borra ni modifica datos existentes: solo agrega usuarios que NO existan por correo o teléfono.
-- Es repetible: la segunda vez no inserta nada. Los ids siguen la secuencia actual.
-- Contraseña de todos: 123456, guardada como hash Argon2id no esta en texto plano.
-- Requiere haber ejecutado antes 01, 02 y los scripts 09, 10 y 11. 
-- Solo para pruebas no para entorno de produccion. 

DO $$ 
DECLARE 
    v_id tipo_gasto.id_usuario%TYPE; 
    t_arriendo tipo_gasto.id_tipo%TYPE;
    t_servicios tipo_gasto.id_tipo%TYPE;
    t_mercado tipo_gasto.id_tipo%TYPE;
    t_transporte tipo_gasto.id_tipo%TYPE;
    t_entretenimiento tipo_gasto.id_tipo%TYPE;
    t_cat_id tipo_gasto.id_tipo%TYPE;
    i INT;
    j INT;
    v_fecha TIMESTAMP;
    v_precio NUMERIC(12,2);
    v_estado VARCHAR(20);
    v_nuevos INT := 0;

    nombres TEXT[] := ARRAY[ 
        'Carlos Alberto', 'María Fernanda', 'Juan David', 'Ana Sofía', 'Alejandro',
        'Valentina', 'Andrés Felipe', 'Camila', 'Santiago', 'Daniela',
        'Mateo', 'Laura Victoria', 'Sebastian', 'Mariana', 'Diego Armando',
        'Gabriela', 'Nicolas', 'Natalia', 'Julian Esteban', 'Paula Andrea',
        'Samuel', 'Isabella', 'Cristian Camilo', 'Vanessa', 'Javier Eduardo'
    ];

    apellidos TEXT[] := ARRAY[
        'Gómez Rodríguez', 'Martínez López', 'Rodríguez Silva', 'Hernández Pérez', 'García Morales',
        'López Ramírez', 'González Castro', 'Pérez Torres', 'Sánchez Vargas', 'Ramírez Mendoza',
        'Torres Rojas', 'Díaz Guerrero', 'Vargas Ortiz', 'Castro Jiménez', 'Morales Moreno',
        'Herrera Medina', 'Jiménez Castillo', 'Rojas Romero', 'Medina Álvarez', 'Silva Salazar',
        'Vásquez Guzmán', 'Vargas Suárez', 'Ríos Franco', 'Mendoza Cardona', 'Espinosa Mejía'
    ];

    hashes TEXT[] := ARRAY[
        '$argon2id$v=19$m=65536,t=3,p=4$hOZNFB0qUz8yFMPjYf/caQ$8z8fQt3FPn0gr0erv4acYEWp+C+XefEVoYzYKTsrfy4', 
        '$argon2id$v=19$m=65536,t=3,p=4$xBRwbS5eIfxWlvbzmPHWLw$hVKka1YqYBOkgSFek0QMauvHXWAvA8A1AyhWTyTJJpA', 
        '$argon2id$v=19$m=65536,t=3,p=4$6ZOQMWdPJZcrHhhyu0CikA$fItSjXg8j0ygMCIKGANdzICWaWO++qShKc/Pm9e6WSw', 
        '$argon2id$v=19$m=65536,t=3,p=4$7sapvlUasisvdKzsXxntrw$2ZPEWKgZpZCF00teDnsNcpygrrpwDQVLxCnwkPo8Jmg', 
        '$argon2id$v=19$m=65536,t=3,p=4$NZTjyi9DTC90px9IWRNIoA$oSBa4bhp2Mo6FiGq8O/j563GncqxjPw1Mi7yfVh2CW0', 
        '$argon2id$v=19$m=65536,t=3,p=4$G1FIR0nVGEoVH4978dgwtw$P17ioR1tRI8Wt2pnF7Avr8NDcVy5JxBrP3OCW9smElU', 
        '$argon2id$v=19$m=65536,t=3,p=4$F8LWeg6oMnR12YMQDXsCkQ$QVt924+r0Kbt0Bks+aeNE5HUWP/0VpSrlW+vpMRVlm8', 
        '$argon2id$v=19$m=65536,t=3,p=4$M7kPlUd7ROztQgx9CqIfVg$AZsn7QlgK8vMDRXKu6oBiQfZxKjy7vUbWumm+NB6+uE', 
        '$argon2id$v=19$m=65536,t=3,p=4$+gLkuGxq84F6CP6CptysTA$d4JpQy3HNb4Pnv5HfrboztIoXgv6ZnTb3hytfnFbjvk', 
        '$argon2id$v=19$m=65536,t=3,p=4$+JCaMbshWhLa2mA9yMB/IA$anEGGWrp684eRkxa+NuELLk3Pcd+OEky+Hd7jfSp69w', 
        '$argon2id$v=19$m=65536,t=3,p=4$g83K1BsqyVJ85/EaYX18QA$8Ob4eJfSn36oymIOlX0t10QLv2mL6fY3fjml+wf7QxQ', 
        '$argon2id$v=19$m=65536,t=3,p=4$NhSp0rinqaGuTMLqDVaaYw$4dkSK7DLvsSyfAwQmVy2rqOW3LpTI8JW/hx4n9rQbCM', 
        '$argon2id$v=19$m=65536,t=3,p=4$e8Bw8mFzDQ/cTjFXBErb5w$GP+Kjy5l9VnMlmCPcRz5tlxsY0DyMqZhSrN1g5XkvS4', 
        '$argon2id$v=19$m=65536,t=3,p=4$DvWUiCLbB4sJv6vmBXNuFw$h8+1HQAVj85NH6lNi+b7RLE1GwB4i2x6zdK/ipKpJXY', 
        '$argon2id$v=19$m=65536,t=3,p=4$XkKo6xeHc2uB3mJ6nPndQQ$llyF+SVOKWNsviQtcfmK4YIlzzdlBVUK+EKX4LLwQVg', 
        '$argon2id$v=19$m=65536,t=3,p=4$Yrz7JttxaUDI7evwaGWAbw$x2XJ0cpuKVfpSurcmw+wgfV07owkxVmWQlbL+gOeHNU', 
        '$argon2id$v=19$m=65536,t=3,p=4$Ipu0AYtBYr3wtO5DAPbaow$zfLEae6Ur0p9o/ArIl/2Zp43CjDcm3+uSslmGt2YSVY', 
        '$argon2id$v=19$m=65536,t=3,p=4$/dXCYxtngRGgJAwX7TAO4g$Baf48vOEg6nxFh3Udy7t+tq41/TA6IsVETGt7IldJm0', 
        '$argon2id$v=19$m=65536,t=3,p=4$1gNYry/v6LdRxk4kcJ4IUA$m4OS0m/wRSlu57xrjANFIUk9ciMC1PYd7kCWgFd8Ybo', 
        '$argon2id$v=19$m=65536,t=3,p=4$ewxhPqqz2iDH+x1gyGGo7Q$13UNx7qwVtk1YZ8WryH1M7CVjxRHKYTExllYOCJ0dUs', 
        '$argon2id$v=19$m=65536,t=3,p=4$cUJdKP2LiUD7G6sRYSxBOw$xrSGd12Q+DtTuTrkHcASRRyBEveqLHebPjnoXaFOyUM', 
        '$argon2id$v=19$m=65536,t=3,p=4$JRnkbRwziqqCDuIJN2EGkQ$onnEJwArfQGMbRbT6D9UZRRJhGY5c61y5uGHtL2G3Hw', 
        '$argon2id$v=19$m=65536,t=3,p=4$nq6yLIhyWVxl4eo596WEcg$PsEtFxprrYxTqgn4opQ4xCOcCWtDuSE4upAPCiwaR4U', 
        '$argon2id$v=19$m=65536,t=3,p=4$6C8LkLmW213XyiXm+W9l9A$FBiWnU9ag9+k7YW9BPdVRyiNsIOSyZE2jdlPvdF88sM', 
        '$argon2id$v=19$m=65536,t=3,p=4$HYb9yU7bnZ6DB88QL7UTCQ$PjR+f/TCNUVose8xFxvjlY6BMKSp4fGVO+V979Z4EyE' 
    ]; 

    v_correo TEXT; 
BEGIN 
    FOR i IN 1..25 LOOP 
        v_correo := LOWER( 
            REPLACE(SPLIT_PART(nombres[i], ' ', 1), 'á', 'a') || '.' || 
            REPLACE(SPLIT_PART(apellidos[i], ' ', 1), 'á', 'a') || i || '@email.com' 
        ); 
        v_correo := TRANSLATE(v_correo, 'éíóúñ', 'eioun'); 

        v_id := NULL; 
        -- ON CONFLICT sin objetivo: si el correo O el teléfono ya existen, no inserta y no falla. 
        INSERT INTO usuarios (nombre, correo, contrasena, telefono) 
        VALUES ( 
            nombres[i] || ' ' || apellidos[i], 
            v_correo, 
            hashes[i], 
            '300' || LPAD((1000000 + i * 12345)::text, 7, '0') 
        ) 
        ON CONFLICT DO NOTHING 
        RETURNING id_usuario INTO v_id; 

        -- Solo se siembran categorías, finanzas y gastos para los usuarios que se acaban de crear 
        IF v_id IS NOT NULL THEN 
            v_nuevos := v_nuevos + 1; 

            INSERT INTO tipo_gasto (id_usuario, clase, detalle) VALUES (v_id, 'vital', 'Arriendo/Hipoteca') RETURNING id_tipo INTO t_arriendo; 
            INSERT INTO tipo_gasto (id_usuario, clase, detalle) VALUES (v_id, 'vital', 'Servicios Públicos') RETURNING id_tipo INTO t_servicios; 
            INSERT INTO tipo_gasto (id_usuario, clase, detalle) VALUES (v_id, 'vital', 'Mercado y Víveres') RETURNING id_tipo INTO t_mercado; 
            INSERT INTO tipo_gasto (id_usuario, clase, detalle) VALUES (v_id, 'varios', 'Transporte / Gasolina') RETURNING id_tipo INTO t_transporte; 
            INSERT INTO tipo_gasto (id_usuario, clase, detalle) VALUES (v_id, 'entretenimiento', 'Suscripciones y Salidas') RETURNING id_tipo INTO t_entretenimiento; 

            INSERT INTO finanzas (id_usuario, fecha, entrada_dinero, presupuesto_gastos) 
            VALUES 
                (v_id, '2026-08-01', 3500000.00, 2200000.00), 
                (v_id, '2026-09-01', 3500000.00, 2200000.00); 

            FOR j IN 1..15 LOOP 
                v_fecha := '2026-08-01 08:00:00'::timestamp + (random() * (interval '60 days')); 

                CASE (j % 5) 
                    WHEN 0 THEN 
                        v_precio := (800000 + (random() * 200000))::NUMERIC(12,2); 
                        t_cat_id := t_arriendo; 
                    WHEN 1 THEN 
                        v_precio := (120000 + (random() * 80000))::NUMERIC(12,2); 
                        t_cat_id := t_servicios; 
                    WHEN 2 THEN 
                        v_precio := (250000 + (random() * 150000))::NUMERIC(12,2); 
                        t_cat_id := t_mercado; 
                    WHEN 3 THEN 
                        v_precio := (50000 + (random() * 50000))::NUMERIC(12,2); 
                        t_cat_id := t_transporte; 
                    ELSE 
                        v_precio := (30000 + (random() * 70000))::NUMERIC(12,2); 
                        t_cat_id := t_entretenimiento; 
                END CASE; 

                IF v_fecha < '2026-09-01 00:00:00' THEN 
                    v_estado := 'pagado'; 
                ELSE 
                    v_estado := CASE WHEN random() > 0.4 THEN 'pendiente' ELSE 'pagado' END; 
                END IF; 

                INSERT INTO gasto (id_tipo, fecha_vencimiento, precio, estado) 
                VALUES (t_cat_id, v_fecha, v_precio, v_estado); 
            END LOOP; 
        END IF; 
    END LOOP; 

    RAISE NOTICE 'Usuarios nuevos sembrados: % (los que ya existían no se tocaron)', v_nuevos; 
END $$; 
